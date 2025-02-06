<script lang="ts">
  import { derived, writable } from 'svelte/store'

  import { Icon } from '@horizon/icons'
  import { useLogScope } from '@horizon/utils'

  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import {
    SelectDropdown,
    type SelectItem
  } from '@horizon/core/src/lib/components/Atoms/SelectDropdown'
  import DynamicIcon from '@horizon/icons/src/lib/DynamicIcon.svelte'

  const ai = useAI()
  const log = useLogScope('ModelPicker')

  const modelSelectorOpen = writable(false)

  const selectConfigureItem = {
    id: 'configure',
    label: 'Configure Models',
    icon: 'settings'
  } as SelectItem

  const modelItems = derived([ai.models], ([models]) => {
    return models.map(
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
  <button
    class="transform whitespace-nowrap active:scale-95 disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center px-2 py-2 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 text-sm"
  >
    {#if $selectedModelItem?.icon}
      <DynamicIcon name={$selectedModelItem.icon} />
    {:else}
      <Icon name="settings" className="opacity-60" />
    {/if}
  </button>
</SelectDropdown>
