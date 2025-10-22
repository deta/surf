<script lang="ts">
  import { derived } from 'svelte/store'

  import { useLogScope } from '@deta/utils/io'
  import { ProviderIcons, ProviderLabels, RECOMMENDED_AI_MODELS } from '@deta/types/src/ai.types'

  import { Dropdown, type DropdownItem } from '@deta/ui'
  import { useAI } from '@deta/services/ai'

  let {
    disabled = false,
    side = 'bottom',
    align = 'start',
  }: {
    disabled?: boolean
    side?: 'top' | 'right' | 'bottom' | 'left',
    align?: 'start' | 'center' | 'end',
  } = $props()

  const ai = useAI()
  const log = useLogScope('ModelPicker')

const modelItems = derived([ai.models], ([models]) => {
    let allItems: DropdownItem[] = []

    // Recommended models section
    const recommendedModelIds = RECOMMENDED_AI_MODELS.map(m => m.id)
    const recommendedModels = models.filter(model => recommendedModelIds.includes(model.id))
    if (recommendedModels.length > 0) {
        allItems.push({ label: 'Recommended', type: 'title' })
        allItems.push(...recommendedModels.map(model => ({
            id: model.id,
            label: model.label,
            icon: model.icon,
            description: RECOMMENDED_AI_MODELS.find(m => m.id === model.id)?.description,
            rightIcon: !model.vision ? 'vision.off' : '',
            rightLabel: !model.vision ? 'No Vision' : undefined,
            action: () => selectModel(model.id)
        })))
        allItems.push({ type: 'separator' })
    }

    // // Custom models section
    // const customModels = models.filter(model => model.provider === 'custom')
    // if (customModels.length > 0) {
    //     allItems.push({ label: 'Custom', type: 'title' })
    //     allItems.push(...customModels.map(model => ({
    //         id: model.id,
    //         label: model.label,
    //         icon: model.icon,
    //         rightIcon: !model.vision ? 'vision.off' : '',
    //         rightLabel: !model.vision ? 'No Vision' : undefined,
    //         action: () => selectModel(model.id)
    //     })))
    //     allItems.push({ type: 'separator' })
    // }

    // Providers section
    const providerModels = models // .filter(model => model.provider !== 'custom')
    const providers = [...new Set(providerModels.map(model => model.provider))]

    allItems.push({ label: 'All Providers', type: 'title' })
    providers.forEach(provider => {
        const providerGroupModels = providerModels.filter(model => model.provider === provider)
        allItems.push({
            id: `provider-${provider}`,
            label: ProviderLabels[provider as string] || provider,
            icon: ProviderIcons[provider as string] || 'sparkles',
            subItems: providerGroupModels.map(model => ({
                id: model.id,
                label: model.label,
                icon: model.icon,
                rightIcon: !model.vision ? 'vision.off' : '',
                rightLabel: !model.vision ? 'No Vision' : undefined,
                action: () => selectModel(model.id)
            }))
        })
    })

    allItems.push({
        id: 'configure',
        label: 'Configure AI Models',
        icon: 'settings',
        topSeparator: true,
        action: () => openModelSettings()
    })

    return allItems
})

  const selectedModel = derived(
    [ai.selectedModelId, ai.models],
    ([selectedModelId, models]) => {
      const model = models.find((model) => model.id === selectedModelId)
      if (!model) return null

      return model
    }
  )

  const openModelSettings = () => {
    // @ts-ignore
    window.api.openSettings()
  }

  const selectModel = async (modelId: string) => {
    log.debug('Selected model', modelId)

    if (modelId === 'configure') {
      openModelSettings()
      return
    }

    await ai.changeSelectedModel(modelId)
  }
</script>

<Dropdown items={$modelItems} triggerText={$selectedModel?.label ?? 'Model'} triggerIcon={$selectedModel?.icon ?? 'settings'} {side} {align} {disabled} />