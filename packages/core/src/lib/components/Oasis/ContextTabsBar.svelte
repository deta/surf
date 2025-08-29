<script lang="ts">
  import { derived, get, writable } from 'svelte/store'

  import { useLogScope, wait, flyAndScale } from '@deta/utils'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { createEventDispatcher } from 'svelte'
  import { Resource } from '@horizon/core/src/lib/service/resources'
  import { DragTypeNames, SpaceEntryOrigin, type DragTypes } from '@horizon/core/src/lib/types'

  import { useToasts, type ToastItem } from '@deta/ui'
  import { fade } from 'svelte/transition'
  import { DragculaDragEvent, HTMLAxisDragZone } from '@deta/dragcula'
  import type { BookmarkTabState, Tab } from '@horizon/core/src/lib/types/browser.types'
  import {
    ActivateTabEventTrigger,
    AddResourceToSpaceEventTrigger,
    CreateTabEventTrigger,
    SaveToOasisEventTrigger
  } from '@deta/types'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import TabItem from '../Core/Tab.svelte'

  export let spaceId: string | undefined = undefined

  const log = useLogScope('OasisSpace')
  const oasis = useOasis()

  const dispatch = createEventDispatcher<{
    'select-space': string
    'handled-drop': void
    'open-page-in-mini-browser': string
    reload: string | undefined
  }>()
  const toasts = useToasts()
  const tabsManager = useTabsManager()

  const resourceManager = oasis.resourceManager
  const telemetry = resourceManager.telemetry

  const showScopedTabs = writable(false)
  const forceShowScopedTabs = writable(false)
  const bookmarkingTabsState = writable<Record<string, BookmarkTabState>>({})

  let showScopedTabsTimeout: ReturnType<typeof setTimeout>

  const scopedTabs = derived([tabsManager.tabs], ([$tabs]) => {
    return $tabs.filter((tab) => !tab.pinned && tab.scopeId === spaceId)
  })

  $: log.debug('scoped tabs', $scopedTabs)

  const handleDropTapBar = async (drag: DragculaDragEvent<DragTypes>) => {
    log.debug('dropping onto tab bar', drag, ' | ', drag.from?.id, ' >> ', drag.to?.id, ' | ')

    if (
      drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE) ||
      drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
    ) {
      drag.continue()
      dispatch('handled-drop')

      let resource: Resource | null = null
      if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE)) {
        resource = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE)
      } else if (drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)) {
        const resourceFetcher = drag.item!.data.getData(DragTypeNames.ASYNC_SURF_RESOURCE)
        resource = await resourceFetcher()
      }

      log.debug('Dropped resource:', resource)

      if (resource === null) {
        log.warn('Dropped resource but resource is null! Aborting drop!')
        drag.abort()
        return
      }

      const tab = await tabsManager.openResourceAsTab(resource, {
        active: true,
        index: drag.index ?? 0,
        scopeId: spaceId,
        trigger: CreateTabEventTrigger.Drop
      })

      log.debug('Opened tab:', tab)

      if (!tab) {
        log.error('Failed to add page')
        return
      }

      await tabsManager.scopeTab(tab.id, spaceId ?? null, false)

      log.debug('State updated successfully')

      forceShowScopedTabs.set(true)

      setTimeout(() => {
        forceShowScopedTabs.set(false)
      }, 1500)

      return
    }
  }

  const handleScopedTabMouseEnter = (_e: MouseEvent) => {
    clearTimeout(showScopedTabsTimeout)
    showScopedTabs.set(true)
  }

  const handleScopedTabMouseLeave = (_e: MouseEvent) => {
    showScopedTabsTimeout = setTimeout(() => {
      showScopedTabs.set(false)
    }, 200)
  }

  const handleTabSelect = async (e: CustomEvent<string>) => {
    const tabId = e.detail
    log.debug('Tab selected:', tabId)

    await tabsManager.makeActive(tabId, ActivateTabEventTrigger.Oasis)
  }

  const handleTabSelectPassive = async (e: CustomEvent<string>) => {
    const tabId = e.detail
    log.debug('Tab selected passive:', tabId)

    await tabsManager.makeActive(tabId, ActivateTabEventTrigger.Oasis, true, false)
  }

  const handleTabMultiSelect = async (e: CustomEvent<string>) => {
    const tabId = e.detail
    log.debug('Tab multi-select:', tabId)

    const tab = tabsManager.tabsValue.find((x) => x.id === tabId)
    if (!tab) {
      log.error('Tab not found:', tabId)
      return
    }

    if (tab.type === 'page') {
      const url = tab.currentLocation || tab.currentDetectedApp?.canonicalUrl || tab.initialLocation
      dispatch('open-page-in-mini-browser', url)
    } else if (tab.type === 'space') {
      dispatch('select-space', tab.spaceId)
    } else {
      log.error('Unsupported tab type:', tab.type)
    }
  }

  function updateBookmarkingTabState(tabId: string, value: BookmarkTabState | null) {
    if (value === null) {
      bookmarkingTabsState.update((state) => {
        const newState = { ...state }
        delete newState[tabId]
        return newState
      })
    } else {
      bookmarkingTabsState.update((state) => {
        return { ...state, [tabId]: value }
      })
    }
  }

  async function handleBookmark(tab: Tab): Promise<{ resource: Resource | null; isNew: boolean }> {
    let toast: ToastItem | null = null

    if (tab.type !== 'page') {
      log.error('Unsupported tab type:', tab.type)
      return { resource: null, isNew: false }
    }

    try {
      let browserTab = tabsManager.browserTabsValue[tab.id]

      const tabUrl = browserTab?.getInitialSrc() || tab.currentLocation || tab.initialLocation
      if (tabUrl.startsWith('surf://')) {
        return { resource: null, isNew: false }
      }

      updateBookmarkingTabState(tab.id, 'in_progress')
      toast = toasts.loading(spaceId ? 'Saving Page to Context…' : 'Saving Page…')

      const isActivated = get(tabsManager.activatedTabs).includes(tab.id)
      if (!isActivated) {
        log.debug('Tab not activated, activating first', tab.id)
        tabsManager.activatedTabs.update((tabs) => {
          return [...tabs, tab.id]
        })

        // give the tab some time to load
        await wait(200)

        browserTab = tabsManager.browserTabsValue[tab.id]
        if (!browserTab) {
          log.error('Browser tab not found', tab.id)
          throw Error(`Browser tab not found`)
        }

        log.debug('Waiting for tab to become active', tab.id)
        await browserTab.waitForAppDetection(3000)
      }

      const resource = await browserTab.bookmarkPage({
        silent: false,
        createdForChat: false,
        freshWebview: true
      })

      if (!resource) {
        log.error('error creating resource', resource)
        updateBookmarkingTabState(tab.id, 'error')
        toast?.error('Failed to save page!')
        return { resource: null, isNew: false }
      }

      if (spaceId) {
        await resourceManager.addItemsToSpace(
          spaceId,
          [resource.id],
          SpaceEntryOrigin.ManuallyAdded
        )
      }

      oasis.pushPendingStackAction(resource.id, { tabId: tab.id })
      oasis.reloadStack()

      toast?.success(spaceId ? 'Page Saved to Context!' : 'Page Saved!')
      updateBookmarkingTabState(tab.id, 'success')

      dispatch('reload', spaceId)

      await telemetry.trackSaveToOasis(resource.type, SaveToOasisEventTrigger.SpaceTabBar, true)
      await telemetry.trackAddResourceToSpace(
        resource.type,
        AddResourceToSpaceEventTrigger.SpaceTabBar
      )

      return { resource, isNew: true }
    } catch (e) {
      log.error('error creating resource', e)

      updateBookmarkingTabState(tab.id, 'error')

      if (toast) {
        toast?.error('Failed to save page!')
      } else {
        toasts.error('Failed to save page!')
      }
      return { resource: null, isNew: false }
    } finally {
      setTimeout(() => {
        updateBookmarkingTabState(tab.id, null)
      }, 1500)
    }
  }

  let maxWidth = 0
  let tabSize = 0

  $: {
    const availableSpace = maxWidth - 150
    const numberOfTabs = $scopedTabs.length
    tabSize = Math.min(availableSpace / numberOfTabs - (numberOfTabs - 1) * 1.5, 320)
    // tabSize = availableSpace / (numberOfTabs - 1)
  }

  $: log.debug('num tabs', $scopedTabs.length)
  $: log.debug('Max width:', maxWidth)
  $: log.debug('Tab size:', tabSize)
</script>

{#if $scopedTabs.length > 0}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="scoped-tabs-wrapper"
    axis="horizontal"
    class:show-tabs={$showScopedTabs || $forceShowScopedTabs}
    on:mouseleave={handleScopedTabMouseLeave}
    use:HTMLAxisDragZone.action={{
      accepts: (drag) => {
        if (
          drag.isNative ||
          drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
          drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
          drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE) ||
          drag.item?.data.hasData(DragTypeNames.SURF_SPACE)
        ) {
          return true
        }
        return false
      }
    }}
    on:Drop={handleDropTapBar}
    on:DragEnter={() => showScopedTabs.set(true)}
  >
    {#if $showScopedTabs || $forceShowScopedTabs}
      <div
        id="scoped-tabs-list"
        class="scoped-tabs-list-wrapper"
        bind:clientWidth={maxWidth}
        transition:flyAndScale={{ duration: 150 }}
      >
        <div class="scoped-tabs-list">
          {#each $scopedTabs as tab (tab.id)}
            <TabItem
              {tab}
              activeTabId={tabsManager.activeTabId}
              spaces={oasis.spaces}
              bookmarkingState={$bookmarkingTabsState[tab.id]}
              pinned={false}
              isUserSelected={false}
              horizontalTabs={true}
              inStuffBar
              disableContextmenu
              {tabSize}
              on:select={handleTabSelect}
              on:passive-select={handleTabSelectPassive}
              on:multi-select={handleTabMultiSelect}
              on:bookmark={(e) => handleBookmark(tab)}
            />
          {/each}
        </div>
      </div>
    {:else}
      <div
        id="scoped-tabs-indicators"
        class="scoped-tabs-indicators-wrapper"
        in:fade={{ delay: 100, duration: 150 }}
      >
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="scoped-tabs-indicators" on:mouseenter={handleScopedTabMouseEnter}>
          {#each $scopedTabs as tab (tab.id)}
            <div class="tab-indicator"></div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  .scoped-tabs-wrapper {
    display: flex;
    justify-content: center;
    // padding: 1rem;
    // padding-bottom: 0;
    height: 4.25rem;
    background: rgb(247 247 247);
    width: 100%;
    position: relative;

    &.show-tabs {
      // background: rgb(251 253 254);
      // border-bottom: 1px solid rgba(0, 0, 0, 0.1);

      :global(.dark) & {
        background: #1e293b;
      }
    }

    :global(.dark) & {
      background-color: rgb(17 24 39); // bg-gray-900
    }
  }

  .scoped-tabs-list-wrapper {
    height: calc(100% + 1.5rem);
    width: 100%;
    position: absolute;
    top: calc(50% + 1.5rem);
    left: 0;
    right: 0;
    transform: translateY(-50%);
    z-index: 10;
    margin-top: 0rem;
    padding: 0 1rem;
    overflow: hidden;
    padding-bottom: 3rem;
  }

  .scoped-tabs-list {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    height: 100%;
    width: 100%;
    padding: 1px 0;
    overflow: auto;
  }

  .scoped-tabs-indicators-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    height: 100%;
    width: 100%;
  }

  .scoped-tabs-indicators {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    height: 2rem;
    padding: 0 1rem;
    width: fit-content;
  }

  .tab-indicator {
    width: 5px;
    height: 5px;
    background: #7d7448;
    border-radius: 50%;
  }

  :global(
      body[data-dragging='true']:has(.resource-preview[data-drag-preview]) .scoped-tabs-indicators
    ) {
    outline: 1px dashed #3e475d;
    border-radius: 8px;
  }

  :global(
      body[data-dragging='true']:has(.resource-preview[data-drag-preview]) .scoped-tabs-list-wrapper
    ) {
    outline: 1px dashed #3e475d;
    border-radius: 8px;
  }
</style>
