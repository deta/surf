<script lang="ts">
  import { Icon, IconConfirmation } from '@deta/icons'
  import {
    copyToClipboard,
    generateID,
    isModKeyPressed,
    parseUrlIntoCanonical,
    tooltip,
    useDebounce,
    useLogScope,
    getFormattedDate,
    cropImageToContent,
    optimisticParseJSON
  } from '@deta/utils'

  import { dataUrltoBlob } from '@deta/utils/browser'

  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte'
  import type { WebviewTag } from 'electron'
  import { all, createLowlight } from 'lowlight'
  import { toHtml } from 'hast-util-to-html'
  import { writable, readable, type Readable } from 'svelte/store'
  import { useResourceManager } from '@deta/services/resources'
  import { ResourceTagsBuiltInKeys } from '@deta/types'
  import type { Resource } from '@deta/services/resources'
  import { DragTypeNames, type BookmarkTabState } from '@deta/types'
  import type {
    DragTypes,
    ResourceTagsBuiltIn,
    SFFSResourceTag,
    TabResource,
    UserViewPrefsTagValue
  } from '@deta/types'
  import { ResourceTag } from '@deta/utils/formatting'

  export let doneGenerating: Readable<boolean> = readable(true)
  export let resource: Readable<Resource | undefined> = readable(undefined)
  export let codeContent: Readable<string> = readable('')
  export let title: Readable<string> = readable('App')
  export let tab: TabResource | undefined = undefined

  export let initialCollapsed: boolean | 'auto' = 'auto'
  export let fullSize = false
  export let collapsable = true
  export let saveable = true
  export let showUnLink = false
  export let draggable: boolean = true
  export let resizable: boolean = false
  export let minHeight: string = '200px'
  export let maxHeight: string = '1000px'
  export let initialHeight: string = '400px'
  export let expandable = true
  export let hideHeader = false

  let language = 'html'
  let isResizing = false
  let highlightScheduled = false
  let startY = 0
  let startHeight = 0
  let localTitle = $title

  const log = useLogScope('SurfletRenderer')
  const resourceManager = useResourceManager()

  const dispatch = createEventDispatcher<{
    'link-removed': void
    'set-preview-image': string
    'set-surflet-name': string
    'save-surflet': {
      spaceId?: string
    }
  }>()

  const appIsLoading = writable(false)
  const saveState = writable<BookmarkTabState>('idle')

  const id = generateID()

  let copyIcon: IconConfirmation

  let preElem: HTMLPreElement
  let appContainer: HTMLDivElement
  let inputElem: HTMLInputElement
  let codeBlockELem: HTMLElement
  let containerHeight = initialHeight
  let webview: WebviewTag | null = null

  let collapsed = initialCollapsed === 'auto' ? true : initialCollapsed
  let userSelectedView: 'code' | 'preview' | null = null

  $: localTitle = $title

  $: silentResource =
    $resource && ($resource.tags ?? []).some((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)

  $: shouldShowPreview =
    $doneGenerating &&
    $resource &&
    userSelectedView !== 'code' &&
    (userSelectedView === 'preview' || userSelectedView === null)

  $: if (shouldShowPreview && expandable && !collapsed) {
    renderHTMLPreview()
  }

  $: if (tab && tab.title !== localTitle) {
    dispatch('set-surflet-name', localTitle)
  }

  $: if ($resource && !silentResource && $saveState === 'idle') {
    saveState.set('saved')
  }

  $: if (userSelectedView !== 'preview' && ($codeContent || $resource) && !collapsed) {
    // TODO: redo highlighting when performance is solved
    //scheduleHighlight()
    if (!$doneGenerating) {
      scrollCodeToBottom()
    } else {
      highlightCode()
      // TODO: reenable editability when we suppor it
      //makeCodeEditable()
    }
  }

  // Load saved height from resource tag
  $: if ($resource?.tags) {
    const prefs = getUserViewPreferences($resource.tags)
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

  const showCodeView = () => {
    userSelectedView = 'code'
    collapsed = false
  }

  const showPreviewView = (hidden = false) => {
    if (hidden) {
    } else {
      userSelectedView = 'preview'
    }

    if (!$doneGenerating) {
      collapsed = true
      return
    }
    renderHTMLPreview()
  }

  const lowlight = createLowlight(all)

  const scrollCodeToBottom = () => {
    if (!preElem) return

    requestAnimationFrame(() => {
      preElem.scrollTop = preElem.scrollHeight
    })
  }

  const highlightCode = () => {
    if (!preElem || !language) return

    try {
      const tree = lowlight.highlight(language, $codeContent)
      const code = document.createElement('code')
      code.className = `hljs language-${language}`
      code.setAttribute('spellcheck', 'false')
      code.setAttribute('tabindex', '0')
      code.innerHTML = toHtml(tree)

      const selection = window.getSelection()
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
      const hadSelection = !!range

      preElem.innerHTML = ''
      preElem.appendChild(code)

      if (hadSelection && range) {
        try {
          selection?.removeAllRanges()
          selection?.addRange(range)
        } catch (e) {
          // selection failed ignore error
          log.warn('Failed to restore selection after highlighting code:', e)
        }
      }

      const isNearBottom = preElem.scrollTop >= preElem.scrollHeight - preElem.clientHeight - 50
      if (!$doneGenerating || isNearBottom) {
        scrollCodeToBottom()
      }
    } catch (error) {
      preElem.textContent = $codeContent
      if (!$doneGenerating) {
        scrollCodeToBottom()
      }
    }
  }

  const debouncedHighlightCode = useDebounce(highlightCode, 100)

  // TODO: use this function later when we have a performant way to
  // deal with code highlighting
  const scheduleHighlight = () => {
    if (highlightScheduled) return
    highlightScheduled = true

    requestAnimationFrame(() => {
      if ($doneGenerating) {
        highlightCode()
      } else {
        debouncedHighlightCode()
      }
      highlightScheduled = false
    })
  }

  const makeCodeEditable = () => {
    const codeElem = preElem?.querySelector('code')
    if (!codeElem) return

    codeElem.setAttribute('contenteditable', 'true')
    codeElem.setAttribute('spellcheck', 'false')
    codeElem.setAttribute('tabindex', '0')
  }

  const handleCopyCode = async () => {
    copyToClipboard($codeContent)
    copyIcon.showConfirmation()
  }

  const changeResourceName = useDebounce(async (name: string) => {
    dispatch('set-surflet-name', name)
  }, 500)

  const captureWebviewScreenshot = async (): Promise<string | null> => {
    const originalShowPreview = shouldShowPreview
    const originalCollapsed = collapsed

    if (!originalShowPreview) {
      showPreviewView(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await tick()
    }

    return new Promise((resolve) => {
      if (!appContainer) {
        resolve(null)
        return
      }

      webview
        ?.capturePage()
        .then((image) => {
          if (image) {
            const croppedImage = cropImageToContent(image, {
              padding: 0,
              whiteThreshold: 250,
              alphaThreshold: 0
            })
            const screenshotData = croppedImage.toDataURL()
            resolve(screenshotData)
          } else {
            resolve(null)
          }

          if (!originalShowPreview) {
            showCodeView()
            collapsed = originalCollapsed
          }
        })
        .catch(() => {
          resolve(null)
        })
    })
  }

  const updateResourceViewPrefs = useDebounce(async (height: string, collapsed: boolean) => {
    if (!$resource?.id) return
    try {
      const prefs = getUserViewPreferences($resource.tags ?? [])

      if (prefs) {
        if (resizable) {
          prefs.blockHeight = height
        }
        if (collapsable) {
          prefs.blockCollapsed = collapsed
        }

        await resourceManager.updateResourceTag(
          $resource.id,
          ResourceTagsBuiltInKeys.USER_VIEW_PREFS,
          JSON.stringify(prefs)
        )
      } else {
        const newPrefs = {
          blockHeight: resizable ? height : undefined,
          blockCollapsed: collapsable ? collapsed : undefined
        } as UserViewPrefsTagValue

        await resourceManager.createResourceTag(
          $resource.id,
          ResourceTagsBuiltInKeys.USER_VIEW_PREFS,
          JSON.stringify(newPrefs)
        )
      }
    } catch (error) {
      log.error('Failed to update resource height:', error)
    }
  }, 500)

  const saveScreenshot = async () => {
    try {
      const imageData = await captureWebviewScreenshot()
      if (!imageData) {
        log.error('failed to capture webview screenshot')
        return
      }
      const blob = dataUrltoBlob(imageData)
      const imageResource = await resourceManager.createResource(
        'image/png',
        blob,
        {
          name: `Screenshot ${getFormattedDate(Date.now())}`
        },
        [ResourceTag.screenshot(), ResourceTag.silent()]
      )
      if (!imageResource) {
        log.error('Failed to create image resource from screenshot')
        return
      }
      dispatch('set-preview-image', imageResource.id)
    } catch (error) {
      log.error('Failed to save screenshot:', error)
    }
  }

  const saveSurfletAsNonSilent = async (spaceId?: string) => {
    dispatch('save-surflet', { spaceId })
    saveState.set('saved')
    await saveScreenshot()
  }

  const handleOpenAsTab = async (e: MouseEvent) => {
    if (!$resource) {
      log.warn('No resource available to open as tab')
      return
    }
    // if ($resource) {
    //   tabsManager.openResourceAsTab($resource, {
    //     active: !isModKeyPressed(e)
    //   })
    // }
  }

  const handleUnLink = async () => {
    // const tab = tabsManager.activeTabValue
    // const rawUrl = tab?.type === 'page' ? tab.currentLocation || tab.initialLocation : undefined
    // const url = (rawUrl ? parseUrlIntoCanonical(rawUrl) : undefined) || undefined
    // if (!url || !$resource) return
    // const confirmed = await openDialog({
    //   title: 'Remove Link with Current Page',
    //   message: `Are you sure you want to remove the link between "${localTitle}" and the currently open page?`,
    //   actions: [
    //     { title: 'Cancel', type: 'reset' },
    //     { title: 'Remove Link', type: 'submit', kind: 'danger' }
    //   ]
    // })
    // if (!confirmed) {
    //   return
    // }
    // const matchingTags = ($resource.tags ?? []).filter(
    //   (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL && tag.value === url
    // )
    // if (matchingTags.length === 0) return
    // for await (const tag of matchingTags) {
    //   if (tag.id) {
    //     await resourceManager.deleteResourceTagByID($resource.id, tag.id)
    //   }
    // }
    // dispatch('link-removed')
  }

  const renderHTMLPreview = async () => {
    await tick()
    if (!appContainer) {
      log.warn('No app container available to render HTML preview')
      return
    }
    if (!$resource) {
      log.warn('No resource available to render HTML preview, returning')
      return
    }

    appContainer.innerHTML = ''

    webview = document.createElement('webview') as WebviewTag
    // @ts-ignore
    webview.nodeintegration = false
    // @ts-ignore
    webview.webpreferences = 'contextIsolation=true,sandbox=true'
    webview.partition = `persist:horizon`
    webview.style.width = '100%'
    webview.style.height = '100%'
    webview.style.border = 'none'

    webview.addEventListener('did-start-loading', () => appIsLoading.set(true))
    webview.addEventListener('did-stop-loading', () => appIsLoading.set(false))

    appContainer.appendChild(webview)

    const protocolVersion = $resource?.tags?.find(
      (tag) => tag.name === ResourceTagsBuiltInKeys.SURFLET_PROTOCOL_VERSION
    )?.value
    const suffix = protocolVersion ? `${protocolVersion}.app.local` : 'app.local'
    // @ts-ignore
    webview.src = `surflet://${$resource?.id}.${suffix}`
  }

  export const reloadApp = async () => {
    if (shouldShowPreview) {
      renderHTMLPreview()
    }
  }

  const handleInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.value === $title) return
    if (target.value === '') {
      return
    }
    changeResourceName(target.value)
  }

  const handleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      inputElem.blur()
    }
  }

  const handleResizeStart = (e: MouseEvent) => {
    if (!resizable) return

    isResizing = true
    startY = e.clientY
    const container = codeBlockELem?.querySelector('.code-container') as HTMLElement
    startHeight = container?.offsetHeight || parseInt(containerHeight)

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

  const updateResourceContent = useDebounce(async (value: string) => {
    if (!$resource) return

    const blob = new Blob([value], { type: $resource.type })
    await $resource.updateData(blob, true)
  })

  const handleCodeInput = (e: Event) => {
    const target = e.target as HTMLElement
    const code = target.textContent

    if (!code) return

    $codeContent = code

    if ($resource) {
      updateResourceContent(code)
    }
  }

  const handleDragStart = async (drag: DragculaDragEvent<DragTypes>) => {
    if (!$resource) {
      log.warn('No resource available for drag start')
      return
    }

    if (resource) {
      const item = drag.item!
      drag.dataTransfer?.setData(DragTypeNames.SURF_RESOURCE_ID, $resource.id)
      item.data.setData(DragTypeNames.SURF_RESOURCE, $resource)
      item.data.setData(DragTypeNames.SURF_RESOURCE_ID, $resource.id)
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
    const wrapper = findResponsesWrapper()
    if (!wrapper) return false

    const codeBlocks = wrapper?.querySelectorAll('code-block')
    if (!codeBlocks) return false

    const index = Array.from(codeBlocks).indexOf(codeBlockELem)
    return index === codeBlocks.length - 1
  }

  onMount(async () => {
    if (collapsable) {
      const prefs = getUserViewPreferences($resource?.tags ?? [])
      if (prefs?.blockCollapsed !== undefined && initialCollapsed !== true) {
        initialCollapsed = prefs.blockCollapsed
      } else if (initialCollapsed === 'auto') {
        const autoExpanded = checkIfShouldBeExpanded()
        initialCollapsed = !autoExpanded
      }
    }

    if (
      $resource &&
      !($resource.tags ?? []).some((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)
    ) {
      saveState.set('saved')
    }

    // Set initial view state based on generation status
    if ($doneGenerating) {
      collapsed = false
      userSelectedView = 'preview'
      renderHTMLPreview()
      highlightCode()
      makeCodeEditable()
    }

    collapsed = initialCollapsed === true
  })

  onDestroy(() => {
    if (webview) {
      webview.removeEventListener('did-start-loading', () => {})
      webview.removeEventListener('did-stop-loading', () => {})
      webview = null
    }
    window.removeEventListener('mousemove', handleResizeMove, { capture: true })
    window.removeEventListener('mouseup', handleResizeEnd, { capture: true })
    window.removeEventListener('mouseleave', handleResizeEnd, { capture: true })
  })
</script>

<code-block
  bind:this={codeBlockELem}
  id="code-block-{id}"
  class:isResizing
  data-resizable={resizable}
  data-resource={$resource ? $resource.id : undefined}
  data-language={language}
  data-name={localTitle}
  class="relative bg-gray-900 flex flex-col overflow-hidden w-full {fullSize
    ? ''
    : 'rounded-xl'} {fullSize || resizable || collapsed ? '' : 'h-full max-h-[750px]'} {fullSize
    ? 'h-full'
    : ''}"
>
  {#if !hideHeader}
    <header class="flex-shrink-0 flex items-center justify-between gap-3 p-2">
      <div class="flex items-center gap-1 w-full">
        {#if collapsable}
          <button
            class="text-sm flex items-center gap-2 p-1 rounded-md hover:bg-gray-500/30 transition-colors opacity-40"
            on:click|stopPropagation={() => (collapsed = !collapsed)}
          >
            <div use:tooltip={{ text: collapsed ? 'Expand' : 'Collapse', position: 'right' }}>
              <Icon
                name="chevron.right"
                className="{!collapsed && expandable
                  ? 'rotate-90'
                  : ''} transition-transform duration-75"
              />
            </div>
          </button>
        {/if}

        <div class="w-full" contenteditable="true">
          <!--TODO: disabled should use doneGenerating but currently true as it's broken for some tiptap reason -->
          <input
            bind:this={inputElem}
            bind:value={localTitle}
            on:input={handleInputChange}
            on:keydown={handleInputKeydown}
            on:click|stopPropagation
            disabled={true}
            placeholder="Name"
            class="text-base font-medium bg-gray-800 w-full rounded-md p-1 bg-transparent focus:outline-none opacity-60 focus:opacity-100 cursor-text"
          />
        </div>
      </div>

      <div class="flex items-center gap-3">
        {#if !collapsed && $doneGenerating && expandable}
          <div class="preview-group flex items-center rounded-md overflow-hidden">
            <button
              class="no-custom px-3 py-1 text-sm"
              on:click|stopPropagation={() => showPreviewView()}
              class:active={shouldShowPreview}
            >
              <div class="flex items-center gap-2">App</div>
            </button>
            <button
              class="no-custom px-3 py-1 text-sm"
              on:click|stopPropagation={() => showCodeView()}
              class:active={!shouldShowPreview}
            >
              <div class="flex items-center gap-2">Code</div>
            </button>
          </div>
        {/if}
        {#if !$doneGenerating}
          <div class="flex items-center gap-1">
            <!-- TODO: support cancelling here -->
            <div
              class="p-1 opacity-60"
              use:tooltip={{
                text: 'Generating an app...',
                position: 'left'
              }}
            >
              <Icon name="spinner" />
            </div>
          </div>
        {/if}

        {#if $doneGenerating && expandable}
          {#if collapsed}
            <div class="flex items-center gap-1">
              <div class="p-1 opacity-60">
                <Icon name="code" />
              </div>
              {#if showUnLink && $resource}
                <button
                  on:click|stopPropagation={handleUnLink}
                  use:tooltip={{ text: 'Unlink from page', position: 'left' }}
                  class="flex items-center p-1 rounded-md transition-colors"
                >
                  <Icon name="close" />
                </button>
              {/if}
            </div>
          {:else}
            <div class="flex items-center gap-2">
              <!-- {#if $doneGenerating && saveable}
                <SaveToStuffButton
                  state={saveState}
                  resource={$resource}
                  side="left"
                  className="flex items-center  p-1 rounded-md  transition-colors"
                  on:save={async (e) => await saveSurfletAsNonSilent(e.detail)}
                />
              {/if} -->

              {#if shouldShowPreview}
                <button
                  use:tooltip={{ text: 'Reload', position: 'left' }}
                  class="flex items-center p-1 rounded-md transition-colors"
                  on:click|stopPropagation={() => reloadApp()}
                >
                  <div class="flex items-center gap-1">
                    {#if $appIsLoading || !$doneGenerating}
                      <Icon name="spinner" size="16px" />
                    {:else}
                      <Icon name="reload" size="16px" />
                    {/if}
                  </div>
                </button>
              {:else}
                <button
                  use:tooltip={{ text: 'Copy Code', position: 'left' }}
                  class="flex items-center p-1 rounded-md transition-colors"
                  on:click|stopPropagation={handleCopyCode}
                >
                  <IconConfirmation bind:this={copyIcon} name="copy" size="16px" />
                </button>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </header>
  {/if}

  <div
    class="code-container w-full flex-grow overflow-hidden {shouldShowPreview ||
    collapsed ||
    !expandable
      ? 'hidden'
      : ''} {!fullSize && !collapsed && !resizable ? 'h-[750px]' : ''}"
    style={resizable && !fullSize && !collapsed
      ? `height: ${containerHeight}; min-height: ${minHeight}; ${!resizable && !fullSize ? `max-height: ${maxHeight};` : ''}`
      : ''}
  >
    <pre
      bind:this={preElem}
      class="h-full overflow-auto code-wrapper"
      style="color: #1a1a1a;"
      on:input={handleCodeInput}
      on:click|stopPropagation>
      <slot>{$codeContent}</slot>
    </pre>
  </div>

  {#if shouldShowPreview && !collapsed && expandable}
    <div
      bind:this={appContainer}
      class="bg-white w-full flex-grow overflow-auto {fullSize || resizable || collapsed
        ? ''
        : 'h-[750px]'}"
      style={resizable && !fullSize && !collapsed ? `height: ${containerHeight};` : ''}
    />
  {/if}
  {#if resizable && !collapsed}
    <div
      class="resize-handle"
      on:mousedown|stopPropagation={handleResizeStart}
      on:touchstart|preventDefault={handleResizeStart}
    />
  {/if}
</code-block>

<style lang="scss">
  @use '@deta/ui/src/lib/styles/utils' as utils;

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

  .code-container pre {
    margin: 0 !important;
    border-radius: 0 0 0.7rem 0.7rem;
    border: 1px dashed light-dark(#dddddd, #444444);
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

  header {
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
    background: light-dark(#f3faff, rgb(29 33 44));
  }

  .preview-group {
    button {
      background: light-dark(
        color-mix(in srgb, #f3faff, 7% black),
        color-mix(in srgb, rgb(29 33 44), 8% white)
      );
      color: var(--contrast-color);
      border: none;

      &.active {
        background: light-dark(
          color-mix(in srgb, #f3faff, 15% black),
          color-mix(in srgb, rgb(29 33 44), 15% white)
        );
      }
    }
  }

  // Override Tailwind bg classes with light-dark() support
  :global(code-block.bg-gray-900) {
    background-color: light-dark(#f9f9f9, #111827) !important;
  }

  :global(code-block .bg-gray-800) {
    background-color: light-dark(#ffffff, #1f2937) !important;
  }

  :global(code-block .bg-white) {
    background-color: light-dark(#ffffff, #1e2433) !important;
  }

  // Override inline text color
  :global(code-block .code-wrapper) {
    color: light-dark(#1a1a1a, #e5e7eb) !important;
  }
</style>
