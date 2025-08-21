<script lang="ts">
  import { useTabs } from '@deta/services/tabs'
  import TabItem from '../TabItem.svelte'
  import { Icon } from '@deta/icons'
  import {
    calculateTabLayout,
    measureContainerWidth,
    type LayoutCalculation
  } from './tabsLayout.svelte'
  import { onMount } from 'svelte'

  import { useDebounce } from '@deta/utils'
  import { Button } from '@deta/ui'

  const tabsService = useTabs()

  let containerElement: HTMLDivElement
  let containerWidth = $state(0)
  let layoutCalculation = $state<LayoutCalculation | null>(null)
  let isResizing = $state(false)

  // Reactive calculation of layout
  $effect(() => {
    if (containerWidth > 0 && tabsService.tabs.length > 0) {
      layoutCalculation = calculateTabLayout(
        tabsService.tabs,
        containerWidth,
        tabsService.activeTabIdValue
      )
    }
  })

  // Setup container width tracking
  onMount(() => {
    const updateWidth = () => {
      if (!containerElement) return

      containerWidth = measureContainerWidth(containerElement)
    }

    const debouncedUpdateWidth = useDebounce(updateWidth, 16)

    const handleResize = () => {
      isResizing = true
      updateWidth() // Immediate update
      debouncedUpdateWidth().then(() => {
        isResizing = false
      })
    }

    // Initial measurement
    updateWidth()

    // Listen to window resize
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  })
</script>

<div class="tabs-list" bind:this={containerElement}>
  {#each tabsService.tabs as tab, index (tab.id)}
    <TabItem
      tab={tabsService.tabs[index]}
      active={tabsService.activeTab?.id === tab.id}
      width={layoutCalculation?.tabDimensions[index]?.width}
      collapsed={layoutCalculation?.tabDimensions[index]?.collapsed ?? false}
      squished={layoutCalculation?.tabDimensions[index]?.squished ?? false}
      showCloseButton={layoutCalculation?.tabDimensions[index]?.showCloseButton ?? true}
      {isResizing}
    />
  {/each}

  <div class="add-tab-btn-container">
    <Button onclick={() => tabsService.create('https://google.com')} size="md">
      <Icon name="add" size="1.1rem" />
    </Button>
  </div>
</div>

<style>
  .tabs-list {
    display: flex;
    overflow: hidden;
    padding-left: 5rem;
    gap: 0.375rem;
    padding-top: 0.33rem;
    padding-bottom: 0.33rem;
    width: 100%;
  }

  .add-tab-btn-container {
    flex-shrink: 0;
    app-region: no-drag;
  }
</style>
