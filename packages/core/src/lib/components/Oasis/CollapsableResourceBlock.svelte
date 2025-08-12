<script lang="ts">
  import { Icon } from '@deta/icons'
  import {
    generateID,
    isModKeyPressed,
    tooltip,
    useDebounce,
    useLogScope,
    optimisticParseJSON,
    getHostname,
    getFileKind
  } from '@deta/utils'

  import { onMount, tick } from 'svelte'
  import type { WebviewTag } from 'electron'
  import { writable } from 'svelte/store'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'
  import {
    AddResourceToSpaceEventTrigger,
    OpenInMiniBrowserEventFrom,
    ResourceTagsBuiltInKeys
  } from '@deta/types'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import type { Resource } from '@horizon/core/src/lib/service/resources'
  import SaveToStuffButton from '@horizon/core/src/lib/components/Oasis/SaveToStuffButton.svelte'
  import {
    DragTypeNames,
    SpaceEntryOrigin,
    type BookmarkTabState
  } from '@horizon/core/src/lib/types'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { useToasts } from '@deta/ui'
  import type {
    DragTypes,
    ResourceTagsBuiltIn,
    SFFSResourceTag,
    TabResource,
    UserViewPrefsTagValue
  } from '@horizon/core/src/lib/types'
  import { DragculaDragEvent, HTMLDragItem } from '@horizon/dragcula'
  import { useGlobalMiniBrowser } from '@horizon/core/src/lib/service/miniBrowser'
  import OasisResourceLoader from './OasisResourceLoader.svelte'
  import type { Origin } from '../../utils/resourcePreview'

  export let resource: Resource
  export let tab: TabResource | undefined = undefined
  export let language: string = ''
  export let showPreview: boolean = true
  export let initialCollapsed: boolean | 'auto' = 'auto'
  export let fullSize = false
  export let collapsable = true
  export let saveable = true
  export let draggable: boolean = true
  export let resizable: boolean = false
  export let minHeight: string = '200px'
  export let maxHeight: string = '1000px'
  export let initialHeight: string = '400px'
  export let expandable = true
  export let hideHeader = false
  export let origin: Origin = 'stuff'

  let isResizing = false
  let startY = 0
  let startHeight = 0

  const log = useLogScope('CodeBlock')
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const oasis = useOasis()
  const toasts = useToasts()
  const globalMiniBrowser = useGlobalMiniBrowser()

  const generatedName = writable('')
  const customName = writable('')
  const appIsLoading = writable(false)
  const saveState = writable<BookmarkTabState>('idle')

  const id = generateID()

  let appContainer: HTMLDivElement
  let inputElem: HTMLInputElement
  let codeBlockELem: HTMLElement
  let containerHeight = initialHeight
  let webview: WebviewTag | null = null
  let webviewMediaPlaying = false
  let webviewMuted = true

  let showHiddenPreview = false
  let collapsed = initialCollapsed === 'auto' ? true : initialCollapsed

  $: canonicalUrl = (resource?.tags ?? []).find(
    (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
  )?.value

  $: silentResource =
    resource && (resource.tags ?? []).some((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)

  $: if ((showPreview || showHiddenPreview) && !collapsed && expandable) {
    renderHTMLPreview()
  }

  $: if (tab && tab.title !== $customName) {
    customName.set(tab.title)
  }

  $: if (resource && !silentResource && $saveState === 'idle') {
    saveState.set('saved')
  }

  // Load saved height from resource tag
  $: if (resource?.tags) {
    const prefs = getUserViewPreferences(resource.tags)
    if (prefs?.blockHeight) {
      containerHeight = prefs.blockHeight
    }

    if (prefs?.blockCollapsed !== undefined) {
      collapsed = prefs.blockCollapsed
    }
  }

  $: updateResourceViewPrefs(containerHeight, collapsed)

  const getUserViewPreferences = (tags: SFFSResourceTag[]) => {
    try {
      const prefsTag = tags.find((t) => t.name === ResourceTagsBuiltInKeys.USER_VIEW_PREFS)
      log.debug('User preferences tag', prefsTag)
      if (prefsTag) {
        const prefs = optimisticParseJSON<
          ResourceTagsBuiltIn[ResourceTagsBuiltInKeys.USER_VIEW_PREFS]
        >(prefsTag.value)
        if (!prefs) return null

        return prefs
      }

      return null
    } catch (e) {
      log.error('Failed to parse user preferences:', e)
      return null
    }
  }

  const changeResourceName = useDebounce(async (name: string) => {
    if (!resource) return
    await resourceManager.updateResourceMetadata(resource.id, { name })
    tabsManager.updateResourceTabs(resource.id, { title: name })
  }, 300)

  const updateResourceViewPrefs = useDebounce(async (height: string, collapsed: boolean) => {
    if (!resource?.id) return
    try {
      const prefs = getUserViewPreferences(resource.tags ?? [])

      log.debug('Updating resource view preferences', { height, collapsed }, prefs)

      if (prefs) {
        if (resizable) {
          prefs.blockHeight = height
        }

        prefs.blockCollapsed = collapsed

        await resourceManager.updateResourceTag(
          resource.id,
          ResourceTagsBuiltInKeys.USER_VIEW_PREFS,
          JSON.stringify(prefs)
        )
      } else {
        const newPrefs = {
          blockHeight: resizable ? height : undefined,
          blockCollapsed: collapsed
        } as UserViewPrefsTagValue

        await resourceManager.createResourceTag(
          resource.id,
          ResourceTagsBuiltInKeys.USER_VIEW_PREFS,
          JSON.stringify(newPrefs)
        )
      }
    } catch (error) {
      log.error('Failed to update resource height:', error)
    }
  }, 500)

  const saveAppAsResource = async (spaceId?: string, silent = false) => {
    try {
      if (!silent) {
        saveState.set('in_progress')
      }

      if (!silent) {
        await resourceManager.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.SILENT)
      }

      log.debug('Saved app', resource)

      if (!resource) {
        if (!silent) {
          saveState.set('error')
        }
        return
      }

      if (spaceId) {
        await oasis.addResourcesToSpace(spaceId, [resource.id], SpaceEntryOrigin.ManuallyAdded)
        await oasis.telemetry.trackAddResourceToSpace(
          resource.type,
          AddResourceToSpaceEventTrigger.Chat
        )
      }

      if (!silent) {
        saveState.set('saved')
        toasts.success(spaceId ? 'Saved to Context!' : 'Saved to Stuff!')
      }

      return resource
    } catch (error: any) {
      log.error('Error saving app', error)

      if (!silent) {
        saveState.set('error')
      }
    }
  }

  const handleOpenAsTab = async (e: MouseEvent) => {
    if (resource) {
      tabsManager.openResourceAsTab(resource, {
        active: !isModKeyPressed(e)
      })
    }
  }

  const setWebviewMuted = (value?: boolean) => {
    if (webview) {
      const muted = value ?? !webviewMuted
      webview.setAudioMuted(muted)
      webviewMuted = muted
    }
  }

  const renderHTMLPreview = async () => {
    await tick()
    if (!appContainer || !canonicalUrl) {
      log.debug('Not HTML or no app container')
      return
    }

    log.debug('Rendering HTML preview', canonicalUrl)

    appContainer.innerHTML = ''

    webview = document.createElement('webview') as WebviewTag
    // @ts-ignore
    webview.nodeintegration = false
    // @ts-ignore
    webview.webpreferences =
      'autoplayPolicy=document-user-activation-required,contextIsolation=true,nodeIntegration=false,sandbox=true,webSecurity=true'
    webview.partition = `persist:horizon`
    webview.style.width = '100%'
    webview.style.height = '100%'
    webview.style.border = 'none'

    webview.addEventListener('did-start-loading', () => appIsLoading.set(true))
    webview.addEventListener('did-stop-loading', () => appIsLoading.set(false))
    webview.addEventListener('dom-ready', () => setWebviewMuted(true))
    webview.addEventListener('media-started-playing', () => (webviewMediaPlaying = true))
    webview.addEventListener('media-paused', () => (webviewMediaPlaying = false))

    appContainer.appendChild(webview)

    // @ts-ignore
    webview.src = canonicalUrl
  }

  export const reloadApp = async () => {
    if (showPreview || showHiddenPreview) {
      renderHTMLPreview()
    }
  }

  const openMiniBrowser = async () => {
    globalMiniBrowser.openResource(resource.id, {
      from: OpenInMiniBrowserEventFrom.Note
    })
  }

  const handleInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement

    if (target.value === $customName) return

    if (target.value === '') {
      customName.set('')
      changeResourceName($generatedName)
      return
    }

    customName.set(target.value)
    changeResourceName(target.value)
  }

  const handleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      inputElem.blur()
    }
  }

  const handleInputBlur = (event: Event) => {
    const target = event.target as HTMLInputElement
    const value = target.value
    log.debug('Input blur', { value, customName: $customName, generatedName: $generatedName })
    if (value === '') {
      customName.set($generatedName)
      inputElem.value = $generatedName
    }
  }

  const handleResizeStart = (e: MouseEvent) => {
    if (!resizable) return

    isResizing = true
    startY = e.clientY
    const codeContainer = codeBlockELem?.querySelector('.code-container') as HTMLElement
    const imgContainer = codeBlockELem?.querySelector('article') as HTMLElement
    startHeight =
      codeContainer?.offsetHeight ?? imgContainer?.offsetHeight ?? parseInt(containerHeight)

    // Capture events on window to prevent losing track during fast movements
    window.addEventListener('mousemove', handleResizeMove, { capture: true })
    window.addEventListener('mouseup', handleResizeEnd, { capture: true })
    window.addEventListener('mouseleave', handleResizeEnd, { capture: true })

    e.preventDefault()
    e.stopPropagation()
  }

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return
    e.preventDefault()
    e.stopPropagation()

    const deltaY = e.clientY - startY
    const newHeight = Math.max(
      parseInt(minHeight),
      Math.min(parseInt(maxHeight), startHeight + deltaY)
    )
    const newHeightPx = `${newHeight}px`
    containerHeight = newHeightPx

    window.getComputedStyle(codeBlockELem).height
  }

  const handleResizeEnd = () => {
    if (!isResizing) return

    isResizing = false
    window.removeEventListener('mousemove', handleResizeMove, { capture: true })
    window.removeEventListener('mouseup', handleResizeEnd, { capture: true })
    window.removeEventListener('mouseleave', handleResizeEnd, { capture: true })
  }

  const handleDragStart = async (drag: DragculaDragEvent<DragTypes>) => {
    if (resource) {
      const item = drag.item!
      drag.dataTransfer?.setData(DragTypeNames.SURF_RESOURCE_ID, resource.id)
      item.data.setData(DragTypeNames.SURF_RESOURCE, resource)
      item.data.setData(DragTypeNames.SURF_RESOURCE_ID, resource.id)
      drag.continue()
    } else {
      drag.abort()
    }
  }

  const findResponsesWrapper = () => {
    let parent = codeBlockELem.parentElement
    while (parent) {
      if (parent.id.startsWith('chat-responses-')) {
        return parent
      }
      parent = parent.parentElement
    }

    return null
  }

  const checkIfShouldBeExpanded = () => {
    // walk up the tree from codeBlockElem until you find the chat response wrapper with an id that starts with chat-responses-
    const wrapper = findResponsesWrapper()

    log.debug('wrapper', wrapper)
    if (!wrapper) return false

    // get all the code blocks in the wrapper
    const codeBlocks = wrapper?.querySelectorAll('code-block')
    log.debug('codeBlocks', codeBlocks)
    if (!codeBlocks) return false

    // check what index this code block is in the list of code blocks
    const index = Array.from(codeBlocks).indexOf(codeBlockELem)

    // if we are the last code block, we should be expanded
    return index === codeBlocks.length - 1
  }

  onMount(async () => {
    const prefs = getUserViewPreferences(resource?.tags ?? [])
    if (prefs?.blockCollapsed !== undefined && initialCollapsed === 'auto') {
      initialCollapsed = prefs.blockCollapsed
    } else if (initialCollapsed === 'auto') {
      const autoExpanded = checkIfShouldBeExpanded()
      initialCollapsed = !autoExpanded
    }

    if (
      resource &&
      !(resource.tags ?? []).some((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)
    ) {
      saveState.set('saved')
    }

    log.debug('Collapsable resource block mounted', { resource, initialCollapsed })

    if (initialCollapsed) {
      collapsed = true
    } else if (!initialCollapsed) {
      collapsed = false
    }

    $generatedName =
      resource.metadata?.name ||
      (canonicalUrl ? getHostname(canonicalUrl) : getFileKind(resource.type)) ||
      ''

    renderHTMLPreview()
  })
</script>

<code-block
  bind:this={codeBlockELem}
  id="code-block-{id}"
  class:isResizing
  data-resizable={resizable}
  data-resource={resource ? resource.id : undefined}
  data-language={language}
  data-name={$customName || $generatedName}
  class="relative bg-gray-900 flex flex-col overflow-hidden w-full {fullSize
    ? ''
    : 'rounded-xl'} {fullSize || resizable || collapsed || !canonicalUrl
    ? ''
    : 'h-full max-h-[750px]'} {fullSize ? 'h-full' : ''}"
>
  {#if !hideHeader}
    <header
      class="flex-shrink-0 flex items-center justify-between gap-3 p-2"
      {draggable}
      use:HTMLDragItem.action={{ allowDragStartPropagation: true }}
      on:DragStart={handleDragStart}
    >
      <div class="flex items-center gap-1 w-full">
        {#if collapsable}
          <button
            tabindex="-1"
            class="text-sm flex items-center gap-2 p-1 rounded-md hover:bg-gray-500/30 transition-colors opacity-40"
            on:click|stopPropagation={() => (collapsed = !collapsed)}
          >
            <Icon
              name="chevron.right"
              className="{!collapsed && expandable
                ? 'rotate-90'
                : ''} transition-transform duration-75"
            />
          </button>
        {/if}

        <div class="w-full">
          <input
            tabindex="-1"
            bind:this={inputElem}
            on:input={handleInputChange}
            on:keydown={handleInputKeydown}
            on:blur={handleInputBlur}
            on:click|stopPropagation
            value={$customName || $generatedName || language}
            placeholder="Name"
            class="text-base font-medium bg-gray-800 w-full rounded-md p-1 bg-transparent focus:outline-none opacity-60 focus:opacity-100"
          />
        </div>
      </div>

      <div class="flex items-center gap-3">
        {#if expandable}
          {#if collapsed}
            <div class="flex items-center gap-1">
              <div class="p-1 opacity-60">
                <Icon name="world" />
              </div>
            </div>
          {:else}
            <div class="flex items-center gap-2">
              {#if webviewMediaPlaying}
                <button
                  tabindex="-1"
                  use:tooltip={{
                    text: webviewMuted ? 'Unmute Audio' : 'Mute Audio',
                    position: 'left'
                  }}
                  class="flex items-center p-1 rounded-md transition-colors"
                  on:click|stopPropagation={() => setWebviewMuted()}
                >
                  {#if webviewMuted}
                    <Icon name="mute" size="16px" />
                  {:else}
                    <Icon name="unmute" size="16px" />
                  {/if}
                </button>
              {/if}

              {#if saveable}
                <SaveToStuffButton
                  state={saveState}
                  {resource}
                  side="left"
                  className="flex items-center  p-1 rounded-md  transition-colors"
                  on:save={(e) => saveAppAsResource(e.detail, false)}
                />
              {/if}

              <button
                tabindex="-1"
                use:tooltip={{ text: 'Reload', position: 'left' }}
                class="flex items-center p-1 rounded-md transition-colors"
                on:click|stopPropagation={() => reloadApp()}
              >
                <div class="flex items-center gap-1">
                  {#if $appIsLoading}
                    <Icon name="spinner" size="16px" />
                  {:else}
                    <Icon name="reload" size="16px" />
                  {/if}
                </div>
              </button>

              <button
                tabindex="-1"
                use:tooltip={{ text: 'Open in Mini Browser', position: 'left' }}
                class="flex items-center p-1 rounded-md transition-colors"
                on:click|stopPropagation={() => openMiniBrowser()}
              >
                <Icon name="eye" size="16px" />
              </button>

              <button
                tabindex="-1"
                use:tooltip={{ text: 'Open as Tab', position: 'left' }}
                class="flex items-center p-1 rounded-md transition-colors"
                on:click|stopPropagation={handleOpenAsTab}
              >
                <Icon name="arrow.up.right" size="16px" />
              </button>
            </div>
          {/if}
        {/if}
      </div>
    </header>
  {/if}

  {#if !collapsed && expandable}
    {#if !resource?.type?.startsWith('image/')}
      <div
        bind:this={appContainer}
        class="bg-white w-full flex-grow overflow-auto {fullSize || resizable || collapsed
          ? ''
          : 'h-[750px]'} {showHiddenPreview ? 'opacity-0' : ''}"
        style={resizable && !fullSize && !collapsed ? ` height: ${containerHeight}; ` : ''}
      />
    {:else}
      <div
        style={resizable && !fullSize && !collapsed
          ? ` max-height: max-content; height: ${containerHeight === '-1' ? 'auto' : containerHeight};`
          : ''}
      >
        <OasisResourceLoader
          resourceOrId={resource}
          frameless
          {origin}
          interactive={false}
          draggable={false}
          hideProcessing
        />
      </div>
    {/if}
  {/if}

  {#if resizable && !collapsed}
    <div
      class="resize-handle"
      on:mousedown={handleResizeStart}
      on:touchstart|preventDefault={handleResizeStart}
    />
  {/if}
</code-block>

<style lang="scss">
  @use '@horizon/core/src/lib/styles/utils' as utils;

  :global(.code-wrapper code.hljs) {
    overflow: unset;
    outline: none;
  }

  :global(body:has(code-block.isResizing)) {
    cursor: ns-resize;
    user-select: none;
    pointer-events: none;

    code-block.isResizing .resize-handle {
      pointer-events: auto;
    }
  }

  // Prevent drag preview from being too large
  :global(code-block[data-drag-preview]) {
    width: var(--drag-width) !important;
    height: var(--drag-height) !important;
  }

  code-block {
    border: 1px solid light-dark(#bbb, #444);
    position: relative;

    &[data-resizable='true'] {
      .resize-handle {
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 4px;
        cursor: ns-resize;
        background: light-dark(#bbb, #444);
        opacity: 0;
        transition: opacity 0.1s ease;

        &::after {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: 1px;
          width: 32px;
          height: 2px;
          background: currentColor;
          border-radius: 1px;
        }

        &:hover {
          opacity: 1;
        }
      }
    }
  }

  header,
  footer {
    color: var(--contrast-color);

    :global(body.custom) & {
      background: var(--fill);
      color: var(--contrast-color);

      border-bottom: 1px solid color-mix(in srgb, var(--base-color), 5% light-dark(black, white));
    }

    :global(button:not(.no-custom):not([data-melt-dropdown-menu-trigger])) {
      color: var(--contrast-color);
      opacity: 0.75;

      &:hover {
        opacity: 1;
        background: light-dark(var(--black-09), var(--white-26)) !important;
      }
    }
  }

  header {
    @include utils.light-dark-custom(
      'background-fill-mix',
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1),
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1)
    );
    @include utils.light-dark-custom(
      'fill',
      #f3faff,
      rgb(29 33 44),
      color-mix(in srgb, var(--base-color), 70% var(--background-fill-mix)),
      color-mix(in srgb, var(--base-color), 40% var(--background-fill-mix))
    );

    background: var(--fill);
  }

  footer {
    @include utils.light-dark-custom(
      'background-fill-mix',
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1),
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1)
    );
    @include utils.light-dark-custom(
      'fill',
      #eaf3fa,
      rgb(29 33 44),
      color-mix(in srgb, var(--base-color), 70% var(--background-fill-mix)),
      color-mix(in srgb, var(--base-color), 40% var(--background-fill-mix))
    );

    background: var(--fill);
  }

  .preview-group {
    @include utils.light-dark-custom(
      'background-fill-mix',
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1),
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1)
    );
    @include utils.light-dark-custom(
      'fill',
      color-mix(in srgb, #f3faff, 7% black),
      color-mix(in srgb, rgb(29 33 44), 8% white),
      color-mix(in srgb, var(--base-color), 40% var(--background-fill-mix)),
      color-mix(in srgb, var(--base-color), 5% var(--background-fill-mix))
    );

    button {
      background: var(--fill);
      color: var(--contrast-color);
      border: none;

      &.active {
        @include utils.light-dark-custom(
          'fill',
          color-mix(in srgb, #f3faff, 15% black),
          color-mix(in srgb, rgb(29 33 44), 15% white),
          color-mix(in srgb, var(--base-color), 5% var(--background-fill-mix)),
          color-mix(in srgb, var(--base-color), 60% var(--background-fill-mix))
        );
      }
    }
  }

  // @maxu god forgive me.. who made these resource preview stylings :'(… right… I
  :global(resource[data-type^='image/'] .wrapper) {
    height: 100% !important;
    :global(> article) {
      height: 100% !important;
      :global(.preview) {
        :global(.inner) {
          height: 100% !important;
          :global(img) {
            height: 100% !important;
            object-fit: cover;
          }
        }
      }
    }
  }
</style>
