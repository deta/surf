<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import WebviewWrapper from '../Webview/WebviewWrapper.svelte'
  import { Resource, useResourceManager } from '@horizon/core/src/lib/service/resources'
  import {
    AddResourceToSpaceEventTrigger,
    ResourceTagsBuiltInKeys,
    SaveToOasisEventTrigger,
    type WebViewEventKeyDown
  } from '@horizon/types'
  import {
    useLogScope,
    isModKeyAndKeyPressed,
    getFileKind,
    tooltip,
    checkIfYoutubeUrl
  } from '@horizon/utils'
  import { Icon, IconConfirmation } from '@horizon/icons'

  import { useToasts, type ToastItem } from '@horizon/core/src/lib/service/toast'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import Image from '../Atoms/Image.svelte'
  import { derived, writable } from 'svelte/store'
  import FilePreview from '../Resources/Previews/File/FilePreview.svelte'
  import FileIcon from '../Resources/Previews/File/FileIcon.svelte'
  import BrowserTab from '../Browser/BrowserTab.svelte'
  import {
    SpaceEntryOrigin,
    type BookmarkTabState,
    type TabPage
  } from '@horizon/core/src/lib/types'
  import type { WebviewNavigationEvent } from '../Webview/Webview.svelte'
  import { OasisSpace, useOasis } from '@horizon/core/src/lib/service/oasis'
  import CustomPopover from '../Atoms/CustomPopover.svelte'
  import ShortcutSaveItem from '../Shortcut/ShortcutSaveItem.svelte'
  import { useMiniBrowserService } from '@horizon/core/src/lib/service/miniBrowser'

  export let tab: TabPage
  // export let url: Writable<string>
  export let resource: Resource | undefined = undefined
  export let active: boolean = true
  export let highlightSimilarText: string | undefined = undefined
  export let jumpToTimestamp: number | undefined = undefined
  export let browserTab: BrowserTab
  export let isGlobal: boolean = false

  let webview: WebviewWrapper
  let copyConfirmation: IconConfirmation

  const dispatch = createEventDispatcher<{
    close: void
  }>()
  const log = useLogScope('MiniBrowserResource')
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const historyEntriesManager = tabsManager.historyEntriesManager
  const toasts = useToasts()
  const oasis = useOasis()
  const telemetry = resourceManager.telemetry

  const url = writable(tab.currentLocation || tab.initialLocation)
  const bookmarkingState = writable<BookmarkTabState | null>(null)
  const saveToSpacePopoverOpened = writable(false)
  const isLoadingPage = writable(false)

  const miniBrowserService = useMiniBrowserService()

  const hostname = derived(url, (url) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch (err) {
      return url
    }
  })

  $: canGoBack = tab?.currentHistoryIndex > 0
  $: canGoForward = tab?.currentHistoryIndex < tab.historyStackIds.length - 1

  // $: if (webview) {
  //   webview.focus()
  // }

  const injectYouTubeTimestamp = (value: string, timestamp: number) => {
    const url = new URL(value)
    url.searchParams.set('t', Math.floor(timestamp).toString())
    log.debug('Injecting timestamp', url.href)
    return url.href
  }

  const createTabUrl = () => {
    if (!$url) {
      return undefined
    }

    if (jumpToTimestamp && checkIfYoutubeUrl($url)) {
      return injectYouTubeTimestamp($url, jumpToTimestamp)
    }

    return $url
  }

  function close() {
    dispatch('close')
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!active) {
      return
    }

    if (isModKeyAndKeyPressed(event, 'Enter')) {
      openAsNewTab(event.shiftKey)
    }
  }

  const handleNavigation = (e: CustomEvent<WebviewNavigationEvent>) => {
    log.debug('navigation', e.detail)
  }

  const handleUpdateTab = (e: CustomEvent<Partial<TabPage>>) => {
    log.debug('update tab', e.detail)
    tab = { ...tab, ...e.detail }
  }

  const handleOpenResource = (e: CustomEvent<string>) => {
    log.debug('open resource', e.detail)
  }

  const handleReloadAnnotations = async () => {
    log.debug('reloading annotations')
    // TODO: implement
  }

  const handleWebviewKeyDown = (e: CustomEvent<WebViewEventKeyDown>) => {
    log.debug('webview keydown', e.detail)

    if (active && e.detail.key === 'Escape') {
      close()
    }
  }

  const openAsNewTab = (active = true) => {
    // if (resource) {
    //   tabsManager.openResourceAsTab(resource, {
    //     active: active,
    //     trigger: CreateTabEventTrigger.OasisItem
    //   })
    // } else {
    //   tabsManager.addPageTab($url, {
    //     active: active,
    //     trigger: CreateTabEventTrigger.OasisItem
    //   })
    // }

    // create proper tab from our dummy one by excluding the fields that will be set by the tabsManager
    const { id, createdAt, updatedAt, archived, index, pinned, magic, ...newTab } = tab
    tabsManager.create(newTab, { active: active })

    if (active) {
      close()
    }
  }

  // const handleCopy = () => {
  //   copyToClipboard($url)
  //   copyConfirmation.showConfirmation()
  // }

  async function handleBookmark(
    savedToSpace = false
  ): Promise<{ resource: Resource | null; isNew: boolean }> {
    let toast: ToastItem | null = null

    saveToSpacePopoverOpened.set(false)

    try {
      bookmarkingState.set('in_progress')

      if (!savedToSpace) {
        toast = toasts.loading('Saving Page…')
      }

      const resource = await browserTab.bookmarkPage({
        silent: false,
        createdForChat: false,
        freshWebview: true
      })

      oasis.pushPendingStackAction(resource.id, { tabId: tab.id })

      bookmarkingState.set('success')
      toast?.success('Page Saved!')

      oasis.reloadStack()

      await telemetry.trackSaveToOasis(
        resource.type,
        SaveToOasisEventTrigger.MiniBrowser,
        savedToSpace
      )

      return { resource, isNew: true }
    } catch (e) {
      log.error('error creating resource', e)

      bookmarkingState.set('error')

      if (toast) {
        toast?.error('Failed to save page!')
      } else {
        toasts.error('Failed to save page!')
      }
      return { resource: null, isNew: false }
    } finally {
      setTimeout(() => {
        bookmarkingState.set(null)
      }, 1500)
    }
  }

  const handleSaveResourceInSpace = async (e: CustomEvent<OasisSpace>) => {
    log.debug('add resource to space', e.detail)

    const toast = toasts.loading('Adding resource to space...')

    try {
      const { resource } = await handleBookmark(true)
      log.debug('bookmarked resource', resource)

      if (resource) {
        log.debug('will add item', resource.id, 'to space', e.detail.id)
        await resourceManager.addItemsToSpace(
          e.detail.id,
          [resource.id],
          SpaceEntryOrigin.ManuallyAdded
        )

        // new resources are already tracked in the bookmarking function
        await telemetry.trackAddResourceToSpace(
          resource.type,
          AddResourceToSpaceEventTrigger.TabMenu
        )
      }

      toast.success('Page saved to space!')
    } catch (e) {
      log.error('Failed to add resource to space:', e)
      toast.error('Failed to add resource to space')
    }
  }

  const handleDownload = () => {
    // TODO
  }

  onMount(async () => {
    log.debug('Resource modal mounted', resource)

    if (resource) {
      const viewedByUserTag = (resource.tags ?? []).find(
        (tag) => tag.name === ResourceTagsBuiltInKeys.VIEWED_BY_USER
      )
      const viewedByUser = viewedByUserTag?.value === 'true'

      if (!viewedByUser) {
        log.debug('Marking resource as viewed', resource.id)

        if (!viewedByUserTag) {
          resource.tags = [
            ...(resource.tags ?? []),
            { name: ResourceTagsBuiltInKeys.VIEWED_BY_USER, value: 'true' }
          ]
          await resourceManager.createResourceTag(
            resource.id,
            ResourceTagsBuiltInKeys.VIEWED_BY_USER,
            'true'
          )
        } else {
          await resourceManager.updateResourceTag(
            resource.id,
            ResourceTagsBuiltInKeys.VIEWED_BY_USER,
            'true'
          )
        }
      }

      if (highlightSimilarText && !jumpToTimestamp) {
        await browserTab.highlightWebviewText(resource.id, highlightSimilarText)
      }
    }
  })
</script>

<!-- NOTE: |capture isn't really a good solution for our ESC keyhandler issues.. but works in this case -->
<svelte:window on:keydown|capture={handleKeydown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="mini-browser-wrapper" class:global-modal={isGlobal} on:click|self={close}>
  <!-- <div class="close-hitarea" on:click={close} aria-hidden="true">
    <span class="label">Click or ESC to close</span>
  </div> -->
  <div id="mini-browser" class="mini-browser w-[90vw] mx-auto">
    <div class="header">
      <div class="info">
        <div class="left-side">
          <div class="icon-wrapper">
            {#if $url && tab.icon}
              {#key tab.icon}
                <Image src={tab.icon} alt={tab.title} fallbackIcon="world" />
              {/key}
            {:else if $url || !resource}
              <Icon name="world" size="16px" />
            {:else if resource}
              <FileIcon kind={getFileKind(resource.type)} width="100%" height="100%" />
            {/if}
          </div>

          <div class="title truncate max-w-[600px]">
            {tab.title}
          </div>
        </div>

        <div class="host">
          {$hostname}
        </div>
      </div>

      <div class="flex items-center gap-4">
        <button
          use:tooltip={{ text: 'Go Back' }}
          disabled={!canGoBack}
          on:click={() => browserTab.goBack()}
          class="group/nav-btn flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-25 rounded-lg cursor-pointer"
        >
          <span
            class="transition-transform group-hover/nav-btn:-translate-x-1 ease-in-out duration-200"
          >
            <Icon name="arrow.left" />
          </span>
        </button>

        <button
          use:tooltip={{ text: 'Go Forward' }}
          disabled={!canGoForward}
          on:click={() => browserTab.goForward()}
          class="group/nav-btn flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-25 rounded-lg cursor-pointer"
        >
          <span
            class="transition-transform group-hover/nav-btn:translate-x-1 ease-in-out duration-200"
          >
            <Icon name="arrow.right" />
          </span>
        </button>

        <button
          use:tooltip={{ text: 'Reload Page' }}
          on:click={() => browserTab.reload()}
          class="group/nav-btn flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-25 rounded-lg cursor-pointer"
        >
          <span
            class="transition-transform group-hover/nav-btn:rotate-180 ease-in-out duration-200"
          >
            {#if $isLoadingPage}
              <Icon name="spinner" />
            {:else}
              <Icon name="reload" />
            {/if}
          </span>
        </button>

        <div class="w-[2px] h-5 bg-sky-900/20 dark:bg-gray-300/50 mx-3"></div>

        <button
          use:tooltip={{ text: 'Open in new tab' }}
          on:click={() => openAsNewTab()}
          class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-25 rounded-lg cursor-pointer"
        >
          <Icon name="arrow.diagonal" />
        </button>

        <!-- {#if $url}
          <button
            use:tooltip={{ text: 'Copy URL' }}
            on:click={handleCopy}
            class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 hover:text-sky-950 hover:bg-sky-200/80 rounded-lg cursor-pointer"
          >
            <IconConfirmation bind:this={copyConfirmation} name="copy" />
          </button>
        {/if} -->

        {#key tab.resourceBookmarkedManually}
          <CustomPopover position="right" popoverOpened={saveToSpacePopoverOpened}>
            <button
              slot="trigger"
              on:click={() => handleBookmark()}
              class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-25 rounded-lg cursor-pointer"
            >
              {#if $bookmarkingState === 'in_progress'}
                <Icon name="spinner" size="16px" />
              {:else if $bookmarkingState === 'success'}
                <Icon name="check" size="16px" />
              {:else if $bookmarkingState === 'error'}
                <Icon name="close" size="16px" />
              {:else if tab.resourceBookmarkedManually}
                <Icon name="bookmarkFilled" size="16px" />
              {:else}
                <Icon name="save" size="16px" />
              {/if}
            </button>

            <div slot="content" class="no-drag p-1">
              <ShortcutSaveItem
                on:save-resource-in-space={handleSaveResourceInSpace}
                spaces={oasis.spaces}
                infoText="Save page to Space:"
              />
            </div>
          </CustomPopover>
        {/key}

        <button
          use:tooltip={{ text: 'Close' }}
          on:click={close}
          class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-25 rounded-lg cursor-pointer"
        >
          <Icon name="close" />
        </button>
      </div>
    </div>

    <div class="mini-webview-wrapper">
      {#if $url}
        <BrowserTab
          {historyEntriesManager}
          downloadIntercepters={miniBrowserService.downloadIntercepters}
          {url}
          id={tab.id}
          {webview}
          isLoading={isLoadingPage}
          active
          insideMiniBrowser
          disableMiniBrowser
          bind:this={browserTab}
          bind:tab
          on:navigation={handleNavigation}
          on:update-tab={handleUpdateTab}
          on:open-resource={handleOpenResource}
          on:reload-annotations={handleReloadAnnotations}
          on:keydown={handleWebviewKeyDown}
          on:add-to-chat={(e) => log.debug(e)}
          on:prepare-tab-for-chat={(e) => log.debug(e)}
          on:open-mini-browser
        />
      {:else}
        <FilePreview {resource} preview={false} />
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .mini-browser-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    z-index: 10;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 2rem;

    &.global-modal {
      z-index: 10000000;
    }
  }

  .close-hitarea {
    position: absolute;
    top: 2rem;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 2rem;
    background: linear-gradient(to bottom, #34393d, transparent);

    .label {
      transition: 240ms ease-out;
      color: #d4dce0;
      user-select: none;
      opacity: 0;
    }

    &:hover {
      .label {
        opacity: 1;
        padding-top: 2.5rem;
      }
    }

    &:hover ~ .mini-browser {
      transform: translateY(2.75rem) scale(0.98);
      backdrop-filter: blur(4px);
      .label {
        opacity: 1;
      }
    }
  }

  .mini-browser {
    position: relative;
    display: flex;
    flex-direction: column;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    transition: 240ms ease-out;
    width: 100%;
    max-width: 90vw;
    height: calc(100vh - 120px);
    z-index: 100000;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: white;
    border-radius: 12px;
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
    border-bottom: 1px solid #e0e0e0;

    :global(.dark) & {
      background: #1e293b;
      border-bottom: 1px solid #1e293b;
      color: rgba(255, 255, 255, 1);
    }

    .info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .left-side {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .title {
      font-size: 1rem;
      font-weight: 500;
      opacity: 0.75;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 1;
      }
    }

    .host {
      font-size: 1rem;
      opacity: 0.5;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 0.75;
      }
    }
  }

  .icon-wrapper {
    width: 16px;
    height: 16px;
    display: block;
    user-select: none;
    flex-shrink: 0;
  }

  .resource-details {
    position: relative;
    width: 40rem;
    border-radius: 12px;
    overflow: hidden;
    background: white;
  }

  .annotations-view {
    position: relative;
    width: 40rem;
    height: 100%;
    border-radius: 12px;
    background: white;
    padding: 1rem;
  }

  .annotations {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    overflow: auto;
    height: 100%;
  }

  .loading {
    margin: auto;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
  }

  .empty-annotations {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    opacity: 0.5;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }

    p {
      font-size: 1rem;
      color: #666;
      text-align: center;
    }
  }

  .empty-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    h1 {
      font-size: 1.25rem;
      font-weight: 500;
    }
  }

  .mini-webview-wrapper {
    height: 100%;
    width: 100%;
    border-radius: 12px;
    border-top-right-radius: 0;
    border-top-left-radius: 0;
    overflow: hidden;
    background: black;
  }
</style>
