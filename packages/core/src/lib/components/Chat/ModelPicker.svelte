<script lang="ts">
  import { derived, writable } from 'svelte/store'

  import { Icon } from '@deta/icons'
  import { useLogScope } from '@deta/utils/io'

  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import {
    SelectDropdown,
    type SelectItem
  } from '@horizon/core/src/lib/components/Atoms/SelectDropdown'
  import { DynamicIcon } from '@deta/icons'
  import AppBarButton from '../Browser/AppBarButton.svelte'
  import { Provider } from '@deta/types/src/ai.types'

  const ai = useAI()
  const log = useLogScope('ModelPicker')

  const modelSelectorOpen = writable(false)

  const selectConfigureItem = {
    id: 'configure',
    label: 'Configure Models',
    icon: 'settings'
  } as SelectItem

  const modelItems = derived([ai.models], ([models]) => {
    // Group models by provider
    const modelsByProvider = models.reduce(
      (acc, model) => {
        acc[model.provider] = acc[model.provider] || []
        acc[model.provider].push(model)
        return acc
      },
      {} as Record<Provider, typeof models>
    )

    // Get all providers that have models
    const providers = Object.keys(modelsByProvider) as Provider[]

    // Create items for each provider group
    let allItems: SelectItem[] = []

    providers.forEach((provider, providerIndex) => {
      const providerModels = modelsByProvider[provider]

      const items = providerModels.map(
        (model, idx) =>
          ({
            id: model.id,
            label: model.label,
            icon: model.icon,
            descriptionIcon: !model.vision ? 'vision.off' : '',
            description: !model.vision ? 'Vision not supported' : undefined,
            // Add separator after the last model of each provider group except the last provider
            bottomSeparator:
              idx === providerModels.length - 1 && providerIndex < providers.length - 1
          }) as SelectItem
      )

      allItems = [...allItems, ...items]
    })

    return allItems
  })

  const selectedModelItem = derived(
    [ai.selectedModelId, modelItems],
    ([selectedModelId, modelItems]) => {
      const model = modelItems.find((model) => model.id === selectedModelId)
      if (!model) return null

      return model
    }
  )

  const openModelSettings = () => {
    // window.api.openSettings('ai')
    window.api.openSettings()
  }

  const handleModelSelect = async (e: CustomEvent<string>) => {
    const modelId = e.detail
    log.debug('Selected model', modelId)

    modelSelectorOpen.set(false)

    if (modelId === 'configure') {
      openModelSettings()
      return
    }

    await ai.changeSelectedModel(modelId)
  }
</script>

<SelectDropdown
  items={modelItems}
  search="disabled"
  selected={$selectedModelItem ? $selectedModelItem.id : null}
  footerItem={selectConfigureItem}
  open={modelSelectorOpen}
  side="top"
  closeOnMouseLeave={false}
  keepHeightWhileSearching
  on:select={handleModelSelect}
>
  <AppBarButton active={$modelSelectorOpen}>
    <!--<button
    class="transform whitespace-nowrap active:scale-95 disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center px-2 py-2 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 text-sm"
  >-->
    {#if $selectedModelItem?.icon}
      <DynamicIcon name={$selectedModelItem.icon} size="1.2rem" />
    {:else}
      <Icon name="settings" className="opacity-60" size="1.2rem" />
    {/if}
  </AppBarButton>
</SelectDropdown>
