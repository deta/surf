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
    ModelTiers,
    OPEN_AI_PATH_SUFFIX,
    Provider,
    ProviderLabels,
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
  import { appendURLPath, generateID } from '@deta/utils'
  import { createEventDispatcher, onMount } from 'svelte'
  import { contextMenu, type CtxItem } from '@deta/ui'

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
  const providerSelectorOpen = writable(false)
  const showProviderSettings = writable(false)
  const selectedProvider = writable<ModelProvider | null>(null)

  let customProviderName = ''
  let customModelName = ''
  let customProviderUrl = ''
  let customMaxTokens = 128_000
  let customVisionSupport = false
  let customSupportsJsonFormat = false
  let customApiKey = ''

  const selectConfigureItem = {
    id: 'configure',
    label: 'Custom Provider',
    icon: 'add'
  } as SelectItem

  const modelToProvider = (model: Model) => {
    if (model.provider === Provider.Custom) {
      return {
        id: model.id,
        type: 'custom',
        label: model.label,
        icon: model.icon,
        model
      } as ModelProvider
    }

    return {
      id: model.provider,
      type: 'built-in',
      label: ProviderLabels[model.provider],
      icon: model.icon,
      model
    } as ModelProvider
  }

  const providerToModel = (providerId: string) => {
    const provider = $providerItems.find((item) => item.id === providerId)
    if (!provider) return null

    return provider.data.model as Model
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

  const providerItems = derived([allModels, selectedProvider], ([allModels, _selectedProvider]) => {
    const items = Array.from(
      new Set(
        allModels.map((model) => (model.provider === Provider.Custom ? model.id : model.provider))
      )
    )

    return items.map((item) => {
      const matchingModel = allModels.find((model) => {
        const hasSiblings = allModels.filter((m) => m.provider === item).length > 1

        if (model.provider !== Provider.Custom) {
          if (model.provider !== item) return false

          if (hasSiblings) {
            return model.tier === ModelTiers.Premium
          }

          return true
        }

        return model.id === item
      })

      const provider = modelToProvider(matchingModel)

      return {
        id: provider.id,
        label: provider.label,
        icon: provider.icon,
        data: provider
      } as SelectItem
    })
  })

  const updateModel = (id: string, updates: Partial<Model>) => {
    dispatch('update-model', { id, updates })
  }

  const selectModel = (id: string) => {
    selectedModelId.set(id)
    dispatch('select-model', id)
  }

  const handleCreateNewModel = async () => {
    const newCustomModel = {
      id: generateID(),
      provider: Provider.Custom,
      tier: ModelTiers.Premium,
      label: 'Custom',
      icon: 'sparkles',
      custom_model_name: '',
      custom_key: '',
      max_tokens: 128_000,
      vision: false,
      supports_json_format: false,
      provider_url: '',
      skip_append_open_ai_suffix: true
    } as Model

    const provider = modelToProvider(newCustomModel)
    selectedProvider.set(provider)
    showProviderSettings.set(true)

    dispatch('created-model', newCustomModel)
  }

  const handleSelectedProviderChange = (event: CustomEvent<string>) => {
    if (event.detail === 'configure') {
      modelSelectorOpen.set(false)
      handleCreateNewModel()
      return
    }

    const providerItem = $providerItems.find((item) => item.id === event.detail)
    if (providerItem) {
      selectedProvider.set(providerItem.data)
    }

    providerSelectorOpen.set(false)
    showProviderSettings.set(true)
  }

  const handleSelectedModelChange = (event: CustomEvent<string>) => {
    const model = $allModels.find((model) => model.id === event.detail)

    if (model) {
      selectModel(model.id)
    } else {
      modelSelectorOpen.set(false)
    }
  }

  const handleModelChange = (changes: Partial<Model>) => {
    const model = $selectedProvider.model
    if (!model) return

    if (changes.label) {
      $selectedProvider.label = changes.label
    }

    updateModel(model.id, changes)
  }

  const getProviderItemContextMenu = (item: SelectItem) => {
    if (!item) return []

    const model = providerToModel(item.id)
    if (!model) return []

    return [
      {
        text: 'Delete',
        type: 'action',
        icon: 'trash',
        disabled: model?.provider !== Provider.Custom,
        action: () => {
          if ($selectedProvider.model.id === model.id) {
            selectedProvider.set(null)
            showProviderSettings.set(false)
          }

          dispatch('delete-model', model.id)
        }
      }
    ] as CtxItem[]
  }

  const getModelItemContextMenu = (item: SelectItem) => {
    if (!item) return []

    const model = $allModels.find((m) => m.id === item.id)

    return [
      {
        text: 'Delete',
        type: 'action',
        icon: 'trash',
        disabled: model?.provider !== Provider.Custom,
        action: () => {
          dispatch('delete-model', model.id)
        }
      }
    ] as CtxItem[]
  }

  onMount(() => {
    if ($selectedModel) {
      const provider = modelToProvider($selectedModel)
      selectedProvider.set(provider)
    }

    return selectedProvider.subscribe((provider) => {
      if (!provider) return

      if (provider.type === 'custom') {
        customProviderName = provider.label
        customModelName = provider.model?.custom_model_name ?? ''
        customMaxTokens = provider.model?.max_tokens ?? 128_000
        customVisionSupport = provider.model?.vision ?? false
        customSupportsJsonFormat = provider.model?.supports_json_format ?? false
        customApiKey = provider.model?.custom_key ?? ''

        if (provider.model?.provider_url) {
          if (provider.model?.skip_append_open_ai_suffix !== true) {
            customProviderUrl = appendURLPath(provider.model.provider_url, OPEN_AI_PATH_SUFFIX)
            updateModel(provider.model.id, {
              provider_url: customProviderUrl,
              skip_append_open_ai_suffix: true
            })
          } else {
            customProviderUrl = provider.model.provider_url
          }
        } else {
          customProviderUrl = ''
        }
      } else {
        customProviderName = ''
        customModelName = ''
        customProviderUrl = ''
        customMaxTokens = 128_000
        customVisionSupport = false
        customSupportsJsonFormat = false
        customApiKey = provider.model?.custom_key ?? ''
      }
    })
  })
</script>

<div class="wrapper">
  <div class="dev-wrapper">
    <div class="space-y-3">
      <div class="w-full flex items-center justify-between">
        <h2 class="text-xl font-medium">Selected AI Model</h2>

        <div class="block">
          <SelectDropdown
            items={modelItems}
            search="disabled"
            selected={$selectedModel.id ?? null}
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

            <div
              slot="item"
              class="w-full"
              let:item
              use:contextMenu={{
                items: getModelItemContextMenu(item)
              }}
            >
              <SelectDropdownItem {item} />
            </div>
          </SelectDropdown>
        </div>
      </div>

      <div class="details-text">
        <p>
          Choose from built-in AI models by OpenAI and Anthropic, or configure your own custom model
          below. Your selected model will be used across all Surf features.
        </p>

        <p>Surf may switch to more efficient models from the same provider for certain features.</p>
      </div>
    </div>
  </div>

  <div class="dev-wrapper">
    <div class="space-y-3">
      <div class="w-full flex items-center justify-between">
        <h2 class="text-xl font-medium">Configure your AI Models</h2>
      </div>

      <div class="details-text">
        <p>
          Configure the built-in AI providers or add your own custom models. Visit our <a
            href={AI_MODEL_DOCS}
            target="_blank">manual</a
          > for more information and setup instructions on how to configure your own models.
        </p>
      </div>
    </div>

    <Expandable
      title={$selectedProvider?.type === Provider.Custom
        ? 'Configure Custom Model'
        : 'Configure Built-In Provider'}
      expanded={!!($showProviderSettings && $selectedProvider)}
    >
      <div slot="header" class="flex items-center gap-2">
        <button
          on:click={handleCreateNewModel}
          class="whitespace-nowrap disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center gap-2 px-2 py-2 hover:bg-gray-700/10 dark:hover:bg-gray-700/80 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100"
        >
          <Icon name="add" />
        </button>

        <SelectDropdown
          items={providerItems}
          search="disabled"
          selected={$selectedProvider ? $selectedProvider.id : null}
          open={providerSelectorOpen}
          footerItem={selectConfigureItem}
          side="bottom"
          closeOnMouseLeave={false}
          keepHeightWhileSearching
          on:select={handleSelectedProviderChange}
        >
          <button
            class="whitespace-nowrap disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center gap-2 px-2 py-2 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100"
          >
            {#if $selectedProvider}
              <Icon name={$selectedProvider.icon} />
            {/if}

            {$selectedProvider ? $selectedProvider.label : 'Select model to configure'}

            {#if $providerSelectorOpen}
              <Icon name="chevron.up" className="opacity-60" />
            {:else}
              <Icon name="chevron.down" className="opacity-60" />
            {/if}
          </button>

          <div
            slot="item"
            class="w-full"
            let:item
            use:contextMenu={{
              items: getProviderItemContextMenu(item)
            }}
          >
            <SelectDropdownItem {item} />
          </div>
        </SelectDropdown>
      </div>

      {#if $selectedProvider?.type === Provider.Custom}
        <div class="provider-config">
          <p>
            Here you can configure your own custom model and provider. Checkout the
            <a href={AI_MODEL_DOCS} target="_blank">manual</a> for more details on how to configure it.
          </p>

          <FormField
            label="Model Label"
            placeholder="My Custom Model"
            infoText="Give your custom model a name so you can identify it within Surf's UI"
            bind:value={customProviderName}
            on:save={() => handleModelChange({ label: customProviderName })}
          />

          <FormField
            label="Provider Model ID"
            placeholder="llama3.2"
            infoText="The ID of the model from the provider's API"
            bind:value={customModelName}
            on:save={() => handleModelChange({ custom_model_name: customModelName })}
          />

          <FormField
            label="Provider API Endpoint"
            placeholder="https://<hostname>/v1/chat/completions"
            infoText="Full URL of the model provider's OpenAI compatible API endpoint"
            bind:value={customProviderUrl}
            on:save={() => handleModelChange({ provider_url: customProviderUrl })}
          />

          <FormField
            label="Provider API Key (optional)"
            placeholder="optional API key"
            infoText="API key for the provider's Open AI compatible API"
            type="password"
            bind:value={customApiKey}
            on:save={() => handleModelChange({ custom_key: customApiKey })}
          />

          <FormField
            label="Context Size (tokens)"
            placeholder="128000"
            infoText="Maximum number of tokens the model supports in the context window"
            type="number"
            bind:value={customMaxTokens}
            on:save={() => handleModelChange({ max_tokens: customMaxTokens })}
          />

          <FormField
            label="Supports Vision"
            infoText="Does the model support vision features like image tagging"
            type="checkbox"
            bind:value={customVisionSupport}
            on:save={() => handleModelChange({ vision: customVisionSupport })}
          />

          <FormField
            label="Supports JSON Format"
            infoText="Does the model support outputing in JSON format"
            type="checkbox"
            bind:value={customSupportsJsonFormat}
            on:save={() => handleModelChange({ supports_json_format: customSupportsJsonFormat })}
          />
        </div>
      {:else if $selectedProvider}
        <div class="provider-config">
          <p>
            Set your own API key for {$selectedProvider.label} to skip our services and let Surf talk
            with {$selectedProvider.label}'s API directly. More details in the
            <a href={AI_MODEL_DOCS} target="_blank">manual</a>.
          </p>

          <FormField
            label="Provider API Key"
            placeholder="your API key"
            infoText="Specify your own API key to use with the built-in provider"
            type="password"
            bind:value={customApiKey}
            on:save={() => handleModelChange({ custom_key: customApiKey })}
          />
        </div>
      {/if}
    </Expandable>
  </div>
</div>

<style lang="scss">
  .wrapper {
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
</style>
