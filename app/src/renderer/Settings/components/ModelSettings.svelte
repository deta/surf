<script lang="ts" context="module">
  // prettier-ignore
  export type ModelUpdate = { id: string, updates: Partial<Model> };

  export type ModelProvider = {
    /** Model ID if custom provider otherwise provider label */
    id: string
    type: 'custom' | 'built-in'
    label: string
    icon: string
    model: Model
  }
</script>

<script lang="ts">
  import { derived, writable, type Writable } from 'svelte/store'
  import {
    BUILT_IN_MODELS,
    BUILT_IN_PROVIDER_DEFINITIONS,
    CUSTOM_MODEL_DEFINITIONS,
    CUSTOM_MODELS,
    ModelTiers,
    OPEN_AI_PATH_SUFFIX,
    Provider,
    ProviderLabels,
    ProviderIcons,
    type Model
  } from '@deta/types/src/ai.types'
  import {
    FormField,
    Expandable,
    SelectDropdown,
    SelectDropdownItem,
    type SelectItem
  } from '@deta/ui/legacy'
  import { Icon } from '@deta/icons'
  import { generateID, truncate } from '@deta/utils'
  import { createEventDispatcher, onMount } from 'svelte'
  import { Button, Dropdown, type DropdownItem, openDialog } from '@deta/ui'

  export let selectedModelId: Writable<string>
  export let models: Writable<Model[]>

  const AI_MODEL_DOCS = 'https://github.com/deta/surf/blob/main/docs/AI_MODELS.md'
  const dispatch = createEventDispatcher<{
    'select-model': string
    'update-model': ModelUpdate
    'delete-model': string
    'created-model': Model
  }>()

  const modelSelectorOpen = writable(false)

  // Provider-level API keys
  let openAIApiKey = ''
  let anthropicApiKey = ''
  let googleApiKey = ''

  let isUpdatingKeys = false

  let statusMessage = ''
  let statusTimeout: number | null = null

  const getProviderModels = (provider: Provider) => {
    return BUILT_IN_MODELS.filter((model) => model.provider === provider)
  }

  const showStatus = (message: string) => {
    statusMessage = message
    if (statusTimeout) clearTimeout(statusTimeout)
    statusTimeout = setTimeout(() => {
      statusMessage = ''
      statusTimeout = null
    }, 3000) as unknown as number
  }

  // Update API key for all models of a built-in provider
  const updateProviderApiKey = (provider: Provider, apiKey: string) => {
    isUpdatingKeys = true
    const modelsForProvider = BUILT_IN_MODELS.filter((m) => m.provider === provider)

    modelsForProvider.forEach((model) => {
      updateModel(model.id, { custom_key: apiKey })
    })

    // Show feedback to user
    const providerName = ProviderLabels[provider]
    if (apiKey) {
      showStatus(`${providerName} API key updated successfully`)
    } else {
      showStatus(`${providerName} API key cleared`)
    }

    // Reset flag after a short delay to allow store updates to complete
    setTimeout(() => {
      isUpdatingKeys = false
    }, 100)
  }

  const allModels = derived([models], ([models]) => {
    const customModels = models.filter((m) => m.provider === Provider.Custom)

    const configuredBuiltInModels = BUILT_IN_MODELS.map((model) => {
      const customModel = models.find((m) => m.id === model.id)
      return {
        ...model,
        ...customModel
      }
    })

    return [...customModels, ...configuredBuiltInModels]
  })

  const selectedModel = derived([allModels, selectedModelId], ([allModels, selectedModelId]) => {
    const model = allModels.find((model) => model.id === selectedModelId)
    return model
  })

  const modelItems = derived([allModels], ([allModels]) => {
    return allModels.map(
      (model) =>
        ({
          id: model.id,
          label: model.label,
          icon: model.icon,
          descriptionIcon: !model.vision ? 'vision.off' : '',
          description: !model.vision ? 'Vision not supported' : undefined
        }) as SelectItem
    )
  })

  const customModels = derived([models], ([models]) => {
    return models.filter((m) => m.provider === Provider.Custom)
  })

  const updateModel = (id: string, updates: Partial<Model>) => {
    dispatch('update-model', { id, updates })
  }

  const selectModel = (id: string) => {
    selectedModelId.set(id)
    dispatch('select-model', id)
  }

  const handleSelectedModelChange = (event: CustomEvent<string>) => {
    const model = $allModels.find((model) => model.id === event.detail)

    if (model) {
      selectModel(model.id)
    } else {
      modelSelectorOpen.set(false)
    }
  }

  const handleCreateNewModel = async (type: 'custom' | CUSTOM_MODELS) => {
    let newCustomModel = {
      id: generateID(),
      provider: Provider.Custom,
      tier: ModelTiers.Premium,
      custom_key: '',
      max_tokens: 128_000,
      vision: false,
      supports_json_format: false,
      skip_append_open_ai_suffix: true
    } as Model

    if (type === 'custom') {
      newCustomModel = {
        ...newCustomModel,
        label: 'Custom',
        icon: 'sparkles',
        custom_model_name: '',
        provider_url: ''
      }
    } else {
      const matchingConfig = CUSTOM_MODEL_DEFINITIONS[type]
      newCustomModel = {
        ...newCustomModel,
        label: matchingConfig.label,
        icon: matchingConfig.icon,
        custom_model_name: matchingConfig.model_name,
        provider_url: matchingConfig.provider_url
      }
    }

    dispatch('created-model', newCustomModel)
  }

  const handleDeleteModel = async (modelId: string) => {
    const model = $customModels.find((m) => m.id === modelId)
    if (!model) return

    const { closeType: confirmed } = await openDialog({
      icon: 'trash',
      title: `Delete <i>${truncate(model.label, 26)}</i>`,
      message: `This can't be undone.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return

    if ($selectedModel?.id === model.id) {
      selectedModelId.set(null)
    }

    dispatch('delete-model', model.id)
  }

  onMount(() => {
    // Load provider-level API keys from any configured model for each provider
    return models.subscribe((allModels) => {
      // Skip reloading if we're currently updating keys to prevent loop
      if (isUpdatingKeys) return

      // Load OpenAI API key
      const openAIModel = allModels.find((m) => m.provider === Provider.OpenAI && m.custom_key)
      openAIApiKey = openAIModel?.custom_key ?? ''

      // Load Anthropic API key
      const anthropicModel = allModels.find(
        (m) => m.provider === Provider.Anthropic && m.custom_key
      )
      anthropicApiKey = anthropicModel?.custom_key ?? ''

      // Load Google API key
      const googleModel = allModels.find((m) => m.provider === Provider.Google && m.custom_key)
      googleApiKey = googleModel?.custom_key ?? ''
    })
  })
</script>

<div class="wrapper">
  <div class="dev-wrapper">
    <div class="space-y-3">
      <div class="w-full flex items-center justify-between">
        <h2 class="text-xl font-medium">Active Model</h2>

        <div class="block">
          <SelectDropdown
            items={modelItems}
            search="disabled"
            selected={$selectedModel?.id ?? null}
            open={modelSelectorOpen}
            side="bottom"
            closeOnMouseLeave={false}
            keepHeightWhileSearching
            skipViewManager
            on:select={handleSelectedModelChange}
          >
            <button
              class="whitespace-nowrap disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center gap-2 px-2 py-2 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100"
            >
              {#if $selectedModel}
                <Icon name={$selectedModel.icon} />
              {/if}

              {$selectedModel ? $selectedModel.label : 'Select Model'}

              {#if $modelSelectorOpen}
                <Icon name="chevron.up" className="opacity-60" />
              {:else}
                <Icon name="chevron.down" className="opacity-60" />
              {/if}
            </button>

            <div slot="item" class="w-full" let:item>
              <SelectDropdownItem {item} />
            </div>
          </SelectDropdown>
        </div>
      </div>

      <div class="details-text">
        <p>
          Your selected model will be used across all Surf features. Surf may switch to more
          efficient models from the same provider for certain features.
        </p>
      </div>
    </div>
  </div>

  <div class="dev-wrapper">
    <div class="space-y-3">
      <div class="w-full flex items-center justify-between">
        <h2 class="text-xl font-medium">Configure Models</h2>
      </div>

      <div class="details-text">
        <p>
          Configure built-in providers by providing an API key which will be used for all models of
          that provider or add custom models. Visit our <a href={AI_MODEL_DOCS} target="_blank"
            >manual</a
          > for more information.
        </p>
      </div>
    </div>

    <!-- OpenAI Provider -->
    <Expandable title="OpenAI" expanded={false}>
      <div slot="pre-title" class="flex items-center gap-2">
        <Icon name={ProviderIcons[Provider.OpenAI]} />
      </div>

      <div class="provider-config">
        <FormField
          label="API Key"
          placeholder="your API key"
          infoLink={BUILT_IN_PROVIDER_DEFINITIONS[Provider.OpenAI]?.api_key_page}
          infoText="Get Key"
          type="password"
          bind:value={openAIApiKey}
          on:save={() => updateProviderApiKey(Provider.OpenAI, openAIApiKey)}
        />

        <div class="model-list">
          <p class="model-list-title">Available Models:</p>
          <div class="model-chips">
            {#each getProviderModels(Provider.OpenAI) as model}
              <div class="model-chip">
                <Icon name={model.icon} />
                {model.label}
                {#if !model.vision}
                  <Icon name="vision.off" className="opacity-60" />
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    </Expandable>

    <!-- Anthropic Provider -->
    <Expandable title="Anthropic" expanded={false}>
      <div slot="pre-title" class="flex items-center gap-2">
        <Icon name={ProviderIcons[Provider.Anthropic]} />
      </div>

      <div class="provider-config">
        <FormField
          label="API Key"
          placeholder="your API key"
          infoLink={BUILT_IN_PROVIDER_DEFINITIONS[Provider.Anthropic]?.api_key_page}
          infoText="Get Key"
          type="password"
          bind:value={anthropicApiKey}
          on:save={() => updateProviderApiKey(Provider.Anthropic, anthropicApiKey)}
        />

        <div class="model-list">
          <p class="model-list-title">Available Models:</p>
          <div class="model-chips">
            {#each getProviderModels(Provider.Anthropic) as model}
              <div class="model-chip">
                <Icon name={model.icon} />
                {model.label}
                {#if !model.vision}
                  <Icon name="vision.off" className="opacity-60" />
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    </Expandable>

    <!-- Google Provider -->
    <Expandable title="Google" expanded={false}>
      <div slot="pre-title" class="flex items-center gap-2">
        <Icon name={ProviderIcons[Provider.Google]} />
      </div>

      <div class="provider-config">
        <FormField
          label="API Key"
          placeholder="your API key"
          infoLink={BUILT_IN_PROVIDER_DEFINITIONS[Provider.Google]?.api_key_page}
          infoText="Get Key"
          type="password"
          bind:value={googleApiKey}
          on:save={() => updateProviderApiKey(Provider.Google, googleApiKey)}
        />

        <div class="model-list">
          <p class="model-list-title">Available Models:</p>
          <div class="model-chips">
            {#each getProviderModels(Provider.Google) as model}
              <div class="model-chip">
                <Icon name={model.icon} />
                {model.label}
                {#if !model.vision}
                  <Icon name="vision.off" className="opacity-60" />
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    </Expandable>

    <!-- Custom Models Section -->
    <div class="space-y-3">
      <div class="w-full flex items-center justify-between gap-4">
        <span class="custom-kok">Custom Models</span>
        <hr />
        <Dropdown
          items={[
            ...Object.values(CUSTOM_MODEL_DEFINITIONS).map((def) => ({
              id: def.id,
              label: def.label,
              icon: def.icon,
              action: () => handleCreateNewModel(def.id)
            })),
            {
              id: 'custom',
              label: 'Custom',
              icon: 'sparkles',
              action: () => handleCreateNewModel('custom')
            }
          ]}
          align="end"
        >
          <Button size="sm" class="add-model-button">
            <Icon name="add" />
            Add Model
          </Button>
        </Dropdown>
      </div>

      {#if $customModels.length > 0}
        <div class="custom-model-list">
          {#each $customModels as model}
            {@const modelDefinition = Object.values(CUSTOM_MODEL_DEFINITIONS).find(
              (def) => def.label === model.label
            )}

            <Expandable title="" expanded={false}>
              <div slot="title" class="flex items-center gap-2">
                <Icon name={model.icon} />
                <span>{model.label}</span>
                {#if !model.vision}
                  <Icon name="vision.off" className="opacity-60" />
                {/if}
              </div>

              <div slot="header">
                <Button
                  size="md"
                  onclick={() => handleDeleteModel(model.id)}
                  class="delete-model-button"
                >
                  <Icon name="trash" size="1em" />
                </Button>
              </div>

              <div class="provider-config">
                <FormField
                  label="Model Label"
                  placeholder="My Custom Model"
                  infoText="Give your custom model a name so you can identify it within Surf's UI"
                  value={model.label}
                  on:save={(e) => updateModel(model.id, { label: e.detail })}
                />

                {#if !!modelDefinition}
                  <FormField
                    label="Model ID"
                    placeholder="llama3.2"
                    infoText="View List"
                    infoLink={modelDefinition?.model_page}
                    value={model.custom_model_name ?? ''}
                    on:save={(e) => updateModel(model.id, { custom_model_name: e.detail })}
                  />
                {:else}
                  <FormField
                    label="Provider Model ID"
                    placeholder="llama3.2"
                    infoText="The ID of the model from the provider's API"
                    value={model.custom_model_name ?? ''}
                    on:save={(e) => updateModel(model.id, { custom_model_name: e.detail })}
                  />
                {/if}

                <FormField
                  label="API Key {modelDefinition && !modelDefinition?.api_key_page
                    ? '(optional)'
                    : ''}"
                  placeholder="{modelDefinition && !modelDefinition?.api_key_page
                    ? 'optional '
                    : ''}API key"
                  infoText="Get Key"
                  infoLink={modelDefinition?.api_key_page}
                  type="password"
                  value={model.custom_key ?? ''}
                  on:save={(e) => updateModel(model.id, { custom_key: e.detail })}
                />

                <FormField
                  label="API Endpoint"
                  placeholder="https://<hostname>/v1/chat/completions"
                  infoText="Full URL of the model provider's OpenAI compatible API endpoint"
                  value={model.provider_url ?? ''}
                  on:save={(e) => updateModel(model.id, { provider_url: e.detail })}
                />

                <FormField
                  label="Context Size (tokens)"
                  placeholder="128000"
                  infoText="Maximum number of tokens the model supports in the context window"
                  type="number"
                  value={model.max_tokens ?? 128_000}
                  on:save={(e) => {
                    const tokens = parseInt(e.detail)
                    if (!isNaN(tokens) && tokens > 0) {
                      updateModel(model.id, { max_tokens: tokens })
                    }
                  }}
                />

                <FormField
                  label="Supports Vision"
                  infoText="Does the model support vision features like image tagging"
                  type="checkbox"
                  value={model.vision ?? false}
                  on:save={(e) => updateModel(model.id, { vision: e.detail })}
                />

                <FormField
                  label="Supports JSON Format"
                  infoText="Does the model support outputing in JSON format"
                  type="checkbox"
                  value={model.supports_json_format ?? false}
                  on:save={(e) => updateModel(model.id, { supports_json_format: e.detail })}
                />
              </div>
            </Expandable>
          {/each}
        </div>
      {:else}
        <p class="no-custom-models">
          No custom models configured. Add a custom model to get started.
        </p>
      {/if}
    </div>
  </div>
</div>

{#if statusMessage}
  <div class="status-message">
    <Icon name="check.circle" />
    <span>{statusMessage}</span>
  </div>
{/if}

<style lang="scss">
  .status-message {
    position: absolute;
    left: 1rem;
    top: 1rem;
    right: 1rem;
    z-index: 999999;

    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: light-dark(#ecfdf5, #064e3b);
    border: 1px solid light-dark(#10b981, #059669);
    border-radius: 0.5rem;
    color: light-dark(#065f46, #d1fae5);
    font-size: 0.875rem;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .wrapper {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    h2 {
      color: light-dark(#1f2937, #cbd5f5);
    }

    p {
      color: light-dark(#374151, #94a3b8);
      line-height: 1.6;
    }

    a {
      color: light-dark(#0284c7, #38bdf8);
      text-decoration: underline;

      &:hover {
        color: light-dark(#0369a1, #0ea5e9);
      }
    }
  }

  .dev-wrapper {
    position: relative;
    width: 100%;
    background: radial-gradient(
      290.88% 100% at 50% 0%,
      rgba(237, 246, 255, 0.96) 0%,
      rgba(246, 251, 255, 0.93) 100%
    );
    border: 0.5px solid rgba(255, 255, 255, 0.8);
    border-radius: 11px;
    padding: 1.25rem;
    margin: 1rem 0;
    box-shadow:
      0 -0.5px 1px 0 rgba(119, 189, 255, 0.15) inset,
      0 1px 1px 0 #fff inset,
      0 3px 3px 0 rgba(62, 71, 80, 0.02),
      0 1px 2px 0 rgba(62, 71, 80, 0.02),
      0 1px 1px 0 rgba(0, 0, 0, 0.05),
      0 0 1px 0 rgba(0, 0, 0, 0.09);
    transition:
      background-color 90ms ease-out,
      box-shadow 90ms ease-out;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;

    @media (prefers-color-scheme: dark) {
      background: radial-gradient(
        290.88% 100% at 50% 0%,
        rgba(30, 41, 59, 0.96) 0%,
        rgba(15, 23, 42, 0.93) 100%
      );
      border: 0.5px solid rgba(71, 85, 105, 0.6);
      box-shadow:
        0 -0.5px 1px 0 rgba(129, 146, 255, 0.15) inset,
        0 1px 1px 0 rgba(71, 85, 105, 0.3) inset,
        0 3px 3px 0 rgba(0, 0, 0, 0.3),
        0 1px 2px 0 rgba(0, 0, 0, 0.2),
        0 1px 1px 0 rgba(0, 0, 0, 0.4),
        0 0 1px 0 rgba(0, 0, 0, 0.5);
    }
  }

  .details-text {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    p {
      color: light-dark(#374151, #94a3b8);
      line-height: 1.6;
    }

    a {
      color: light-dark(#0284c7, #38bdf8);

      &:hover {
        color: light-dark(#0369a1, #0ea5e9);
      }
    }
  }

  .provider-config {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-bottom: 1rem;

    p {
      color: light-dark(#374151, #94a3b8);
      line-height: 1.6;
    }

    a {
      color: light-dark(#0284c7, #38bdf8);

      &:hover {
        color: light-dark(#0369a1, #0ea5e9);
      }
    }
  }

  :global(.delete-model-button[data-button-root]) {
    background-color: light-dark(oklch(96.5% 0 0), oklch(15% 0.05 250));
    color: light-dark(oklch(55.3% 0 0), oklch(70.3% 0 0));
    padding: 8px;
    border-radius: 10px;

    &:hover {
      background-color: light-dark(oklch(0.93 0.05 17.43), oklch(25% 0.05 250));
      color: light-dark(#b91c1c, oklch(80.3% 0 0));
    }
  }

  .model-list {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.1));
  }

  .model-list-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: light-dark(#374151, #94a3b8);
    margin-bottom: 0.5rem;
  }

  .model-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .model-chip {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: light-dark(#374151, #cbd5f5);
  }

  .custom-model-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .no-custom-models {
    color: light-dark(#6b7280, #94a3b8);
    font-size: 0.875rem;
    text-align: center;
    padding: 1rem;
  }

  :global(.add-model-button[data-button-root]) {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  hr {
    border: 1px solid light-dark(rgba(0, 0, 0, 0.035), rgba(255, 255, 255, 0.04));
    width: 100%;
  }
  .custom-kok {
    text-transform: uppercase;
    width: max-content;
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 450;
    opacity: 0.5;
    letter-spacing: 0.022em;
  }
</style>
