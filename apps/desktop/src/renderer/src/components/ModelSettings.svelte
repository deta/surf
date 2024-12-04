<script lang="ts" context="module">
  // prettier-ignore
  export type ModelUpdate = { id: string, updates: Partial<Model> };
</script>

<script lang="ts">
  import { derived, writable, type Writable } from 'svelte/store'
  import {
    BUILT_IN_MODELS,
    ModelTiers,
    Provider,
    ProviderLabels,
    type Model
  } from '@horizon/types/src/ai.types'
  import {
    SelectDropdown,
    SelectDropdownItem,
    type SelectItem
  } from '@horizon/core/src/lib/components/Atoms/SelectDropdown'
  import { Icon } from '@horizon/icons'
  import Exandable from './Exandable.svelte'
  import { generateID } from '@horizon/utils'
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import FormField from './FormField.svelte'
  import { contextMenu } from '@horizon/core/src/lib/components/Core/ContextMenu.svelte'
  import type { CtxItem } from '@horizon/core/src/lib/components/Core/ContextMenu.svelte'
  import { SFFS } from '@horizon/core/src/lib/service/sffs'
  import type { Quota } from '@horizon/backend/types'
  import TierQuota from './TierQuota.svelte'
  import QuotaItem from './Quota.svelte'
  import QuotaWrapper from './QuotaWrapper.svelte'

  export let selectedModelId: Writable<string>
  export let models: Writable<Model[]>

  const sffs = new SFFS()

  const dispatch = createEventDispatcher<{
    'select-model': string
    'update-model': ModelUpdate
    'delete-model': string
    'created-model': Model
  }>()

  const modelSelectorOpen = writable(false)
  const showCreateCustomModel = writable(false)
  const quotas = writable<Quota[]>([])
  const fetchingQuotas = writable(false)

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

  const allModels = derived([models], ([models]) => {
    const customModels = models.filter((m) => m.provider === 'custom')

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

    customProviderName = model?.label ?? ''
    customModelName = model?.custom_model_name ?? ''
    customProviderUrl = model?.provider_url ?? ''
    customMaxTokens = model?.max_tokens ?? 128_000
    customVisionSupport = model?.vision ?? false
    customSupportsJsonFormat = model?.supports_json_format ?? false
    customApiKey = model?.custom_key ?? ''

    return model
  })

  const providerItems = derived([allModels], ([allModels]) => {
    const items = Array.from(
      new Set(
        allModels.map((model) =>
          model.provider === Provider.Custom ? model.label : model.provider
        )
      )
    )

    return items.map((item) => {
      const matchingModel = allModels.find(
        (model) => model.provider === item || model.label === item
      )
      return {
        id: item,
        label:
          matchingModel.provider === Provider.Custom ? matchingModel.label : ProviderLabels[item],
        icon: matchingModel?.icon
      } as SelectItem
    })
  })

  const selectedProvider = derived([allModels, selectedModelId], ([allModels, selectedModelId]) => {
    const model = allModels.find((model) => model.id === selectedModelId)
    if (!model) return null

    return model.provider === Provider.Custom ? model.label : model.provider
  })

  const selectedProviderItem = derived(
    [selectedProvider, providerItems],
    ([selectedProvider, providerItems]) => {
      console.log('selectedProvider', selectedProvider, providerItems)
      const provider = providerItems.find(
        (provider) => provider.id === selectedProvider || provider.label === selectedProvider
      )
      if (!provider) return null

      return provider
    }
  )

  const premiumTierQuotas = derived([quotas], ([$quotas]) => {
    const filtered = $quotas.filter((quota) => quota.tier === ModelTiers.Premium)

    return {
      daily: {
        input: filtered.find((quota) => quota.usage_type === 'daily_input_tokens'),
        output: filtered.find((quota) => quota.usage_type === 'daily_output_tokens')
      },
      monthly: {
        input: filtered.find((quota) => quota.usage_type === 'monthly_input_tokens'),
        output: filtered.find((quota) => quota.usage_type === 'monthly_output_tokens')
      }
    }
  })

  const standardTierQuotas = derived([quotas], ([$quotas]) => {
    const filtered = $quotas.filter((quota) => quota.tier === ModelTiers.Standard)

    return {
      daily: {
        input: filtered.find((quota) => quota.usage_type === 'daily_input_tokens'),
        output: filtered.find((quota) => quota.usage_type === 'daily_output_tokens')
      },
      monthly: {
        input: filtered.find((quota) => quota.usage_type === 'monthly_input_tokens'),
        output: filtered.find((quota) => quota.usage_type === 'monthly_output_tokens')
      }
    }
  })

  const visionRequestQuoata = derived([quotas], ([$quotas]) => {
    const filtered = $quotas.find((quota) => quota.tier === ModelTiers.PremiumVision)
    return filtered
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
      supports_json_format: false
    } as Model

    console.log('newCustomModel', newCustomModel)

    dispatch('created-model', newCustomModel)

    await tick()

    showCreateCustomModel.set(true)
  }

  const getModelFromProvider = (provider: string) => {
    const models = $allModels.filter(
      (model) => model.provider === provider || model.label === provider
    )
    const model = models.find((model) => model.tier === ModelTiers.Premium) ?? models[0]

    return model
  }

  const handleSelectedModelChange = (event: CustomEvent<string>) => {
    console.log('event.detail', event.detail, $allModels)
    if (event.detail === 'configure') {
      modelSelectorOpen.set(false)
      handleCreateNewModel()
      return
    }

    const model = getModelFromProvider(event.detail)

    if (model) {
      selectModel(model.id)
    } else {
      modelSelectorOpen.set(false)
    }
  }

  const handleModelChange = (changes: Partial<Model>) => {
    if (!customModelName) return
    updateModel($selectedModel.id, changes)
  }

  const getProviderItemContextMenu = (item: SelectItem) => {
    if (!item) return []

    return [
      {
        text: 'Delete',
        type: 'action',
        icon: 'trash',
        action: () => {
          const model = getModelFromProvider(item.id)
          console.log('delete model', model)
          dispatch('delete-model', model.id)
        }
      }
    ] as CtxItem[]
  }

  const loadQuotas = async () => {
    try {
      fetchingQuotas.set(true)
      const fetchedQuotas = await sffs.getQuotas()
      console.log('quotas', fetchedQuotas)
      quotas.set(fetchedQuotas)
    } catch (error) {
      console.error('error fetching quotas', error)
    } finally {
      fetchingQuotas.set(false)
    }
  }

  onMount(() => {
    loadQuotas()
  })
</script>

<svelte:window on:focus={() => loadQuotas()} />

<div class="wrapper">
  <div class="dev-wrapper">
    <div class="space-y-3">
      <div class="w-full flex items-center justify-between">
        <h2 class="text-xl font-medium">AI Provider</h2>

        <div class="block">
          <SelectDropdown
            items={providerItems}
            search="disabled"
            selected={$selectedProviderItem ? $selectedProviderItem.id : null}
            open={modelSelectorOpen}
            footerItem={selectConfigureItem}
            side="bottom"
            closeOnMouseLeave={false}
            keepHeightWhileSearching
            on:select={handleSelectedModelChange}
          >
            <button
              class="whitespace-nowrap disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center gap-2 px-2 py-2 bg-gray-300/75 hover:bg-gray-400/50 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 cursor-pointer"
            >
              {#if $selectedProviderItem}
                <Icon name={$selectedProviderItem.icon} />
              {/if}

              {$selectedProviderItem ? $selectedProviderItem.label : 'Select Model'}

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
                items: getProviderItemContextMenu(item)
              }}
            >
              <SelectDropdownItem {item} />
            </div>
          </SelectDropdown>
        </div>
      </div>

      <p>
        The provider you pick will be used across all Surf AI features. Surf will automatically pick
        the right models of the provider for the task, you can choose a specific model from the
        chat.
      </p>
    </div>

    <Exandable
      title={$selectedModel.provider === Provider.Custom
        ? `Configure Custom Provider`
        : `Configure ${$selectedProviderItem.label ?? 'Provider'}`}
      expanded={$showCreateCustomModel}
    >
      {#if $selectedModel.provider === Provider.Custom}
        <p>Configure your custom model provider:</p>

        <FormField
          label="Provider Label"
          placeholder="give your custom model provider a name"
          bind:value={customProviderName}
          on:blur={() => handleModelChange({ label: customProviderName })}
        />

        <FormField
          label="Model Name/ID"
          placeholder="what model of the provider you want to use"
          bind:value={customModelName}
          on:blur={() => handleModelChange({ custom_model_name: customModelName })}
        />

        <FormField
          label="Provider URL"
          placeholder="url of the model provider"
          bind:value={customProviderUrl}
          on:blur={() => handleModelChange({ provider_url: customProviderUrl })}
        />

        <FormField
          label="Provider API Key"
          placeholder="api key for the model provider"
          type="password"
          bind:value={customApiKey}
          on:blur={() => handleModelChange({ custom_key: customApiKey })}
        />

        <FormField
          label="Max Context Window"
          placeholder="max tokens of the model"
          type="number"
          bind:value={customMaxTokens}
          on:blur={() => handleModelChange({ max_tokens: customMaxTokens })}
        />

        <FormField
          label="Supports Vision"
          type="checkbox"
          bind:value={customVisionSupport}
          on:change={() => handleModelChange({ vision: customVisionSupport })}
        />

        <FormField
          label="Supports JSON Format"
          type="checkbox"
          bind:value={customSupportsJsonFormat}
          on:change={() => handleModelChange({ supports_json_format: customSupportsJsonFormat })}
        />
      {:else}
        <p>Configure your provider settings here.</p>

        <FormField
          label="Custom Provider API Key"
          placeholder="api key for the model provider"
          type="password"
          bind:value={customApiKey}
          on:blur={() => handleModelChange({ custom_key: customApiKey })}
        />
      {/if}
    </Exandable>
  </div>

  {#if $quotas.length > 0}
    <div class="dev-wrapper">
      <div class="explainer">
        <div class="quota-header">
          <h2 class="text-xl font-medium">AI Quotas</h2>
          <button on:click={() => loadQuotas()}>
            {#if $fetchingQuotas}
              <Icon name="spinner" />
            {:else}
              <Icon name="reload" />
            {/if}
            Refresh
          </button>
        </div>

        <p>
          During Surf's alpha phase, we have quotas in place to ensure fair usage of the AI models
          and to give everyone a chance to try them out for free.
        </p>

        <p>
          As you use Surf's AI and chat features, you will spend tokens from your quota. You have a
          daily and a monthly limit for each tier of the AI models. When you reach the limit of the
          higher tier, you will be switched to the lower tier.
        </p>

        <p>
          Using a custom model or providing your own API key does not count towards your quotas.
        </p>
      </div>

      <div class="tiers-wrapper">
        <TierQuota name="Premium Tier (GPT-4o / Claude Sonnet)" parsedQuota={$premiumTierQuotas} />

        <TierQuota
          name="Standard Tier (GPT-4o Mini / Claude Haiku)"
          parsedQuota={$standardTierQuotas}
        />

        <QuotaWrapper name="Vision Features (Image Tagging)">
          <QuotaItem label="Monthly Requests" quota={$visionRequestQuoata} />
        </QuotaWrapper>
      </div>

      <p>
        If you reach both limits you can wait for the next day or provide your own OpenAI or
        Anthropic API key. If you need more tokens or have any questions <a
          href="mailto:hello@deta.surf">reach out to us</a
        >.
      </p>
    </div>
  {/if}
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .dev-wrapper {
    width: 100%;
    background-color: var(--color-background-dark);
    border-bottom: 1px solid var(--color-border);
    border-radius: 1rem;
    padding: 1.25rem;
    margin: 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .quota-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    button {
      opacity: 0.5;
      transition: opacity 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;

      &:hover {
        opacity: 1;
      }
    }
  }

  .explainer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tiers-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
</style>
