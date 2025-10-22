<script lang="ts">
  import { Icon } from '@deta/icons'
  import { generateID, useDebounce, useLogScope, optimisticParseJSON } from '@deta/utils'

  import { createEventDispatcher, onMount } from 'svelte'
  import { useResourceManager } from '@deta/services/resources'
  import { ResourceTagsBuiltInKeys } from '@deta/types'
  import type { Resource } from '@deta/services/resources'
  import { DragTypeNames } from '@deta/types'
  import type {
    DragTypes,
    ResourceTagsBuiltIn,
    SFFSResourceTag,
    UserViewPrefsTagValue
  } from '@deta/types'
  import ImageBlock from './ImageBlock.svelte'

  // New
  export let as: string = 'collapsable-block'
  export let resource: Resource | undefined = undefined
  export let title: string | undefined = undefined
  export let isEditable: boolean = true

  // Old
  export let initialCollapsed: boolean | 'auto' = 'auto'
  export let fullSize = false
  export let collapsable = true
  export let draggable: boolean = true
  export let resizable: boolean = false
  export let minHeight: string = '200px'
  export let maxHeight: string = '1000px'
  export let initialHeight: string = '400px'
  export let expandable = true
  export let hideHeader = false
  export let collapsed = initialCollapsed === 'auto' ? true : initialCollapsed
  export let loading = false
  export let loadingMessage: string | undefined = undefined
  export let additionalWrapperStyles = ''
  export let fitContent = false

  const log = useLogScope('CodeBlock')
  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<{ 'change-title': string }>()

  const id = generateID()

  let inputElem: HTMLInputElement
  let codeBlockELem: HTMLElement
  let containerHeight = initialHeight
  let savedPrefs: UserViewPrefsTagValue | null = null
  let isResizing = false
  let startY = 0
  let startHeight = 0
  let startWidth = 0
  let containerWidth = 'auto'
  let imageBlockRef: ImageBlock | undefined = undefined

  $: isImage = resource?.type?.startsWith('image/')

  // Load saved height and width from resource tag
  $: updateResourceViewPrefs(containerHeight, containerWidth, collapsed)

  $: if (resource) {
    handleUserViewPreferencesChange(resource?.tags ?? [])
  }

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

  const handleUserViewPreferencesChange = (tags: SFFSResourceTag[]) => {
    const prefs = getUserViewPreferences(tags)

    if (savedPrefs) return

    if (prefs?.blockHeight) {
      containerHeight = prefs.blockHeight
    }

    if (prefs?.blockWidth) {
      containerWidth = prefs.blockWidth
    }

    if (prefs?.blockCollapsed !== undefined) {
      collapsed = prefs.blockCollapsed
    }

    savedPrefs = prefs
  }

  const changeResourceName = useDebounce(async (name: string) => {
    dispatch('change-title', name)
  }, 300)

  const updateResourceViewPrefs = useDebounce(
    async (height: string, width: string, collapsed: boolean) => {
      if (!resource?.id) return
      try {
        const prefs = getUserViewPreferences(resource.tags ?? [])

        log.debug('Updating resource view preferences', { height, width, collapsed }, prefs)

        if (prefs) {
          if (resizable) {
            prefs.blockHeight = height
          }

          if (isImage && width !== 'auto') {
            prefs.blockWidth = width
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
            blockWidth: isImage && width !== 'auto' ? width : undefined,
            blockCollapsed: collapsed
          } as UserViewPrefsTagValue

          await resourceManager.createResourceTag(
            resource.id,
            ResourceTagsBuiltInKeys.USER_VIEW_PREFS,
            JSON.stringify(newPrefs)
          )
        }
      } catch (error) {
        log.error('Failed to update resource view preferences:', error)
      }
    },
    500
  )

  const handleInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement

    if (target.value === title) return

    if (target.value === '' && title) {
      changeResourceName(title)
      return
    }

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
    log.debug('Input blur', { value, title: title })

    if (!value) {
      target.value = title ?? ''
    }
  }

  const handleResizeStart = (e: MouseEvent | TouchEvent) => {
    if (!resizable) return

    isResizing = true
    startY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY
    const container = codeBlockELem?.querySelector('.code-container') as HTMLElement
    const imgContainer = codeBlockELem?.querySelector('article') as HTMLElement

    startHeight = container?.offsetHeight ?? imgContainer?.offsetHeight ?? parseInt(containerHeight)

    // For images, get the aspect ratio
    if (isImage && imageBlockRef) {
      startWidth = codeBlockELem?.offsetWidth ?? 0
      imageBlockRef.getImageAspectRatio()
    }

    log.debug('Start resizing', { container, imgContainer }, startHeight)

    // Capture events on window to prevent losing track during fast movements
    window.addEventListener('mousemove', handleResizeMove, { capture: true })
    window.addEventListener('mouseup', handleResizeEnd, { capture: true, once: true })

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

    // Update width for images (proportional resize)
    if (isImage && imageBlockRef) {
      imageBlockRef.updateWidthFromHeight(newHeight)
    }

    window.getComputedStyle(codeBlockELem).height
  }

  const handleResizeEnd = () => {
    if (!isResizing) return

    isResizing = false
    window.removeEventListener('mousemove', handleResizeMove, { capture: true })
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

    // get all the collapsable blocks in the wrapper
    const codeBlocks = wrapper?.querySelectorAll(as)
    log.debug('elements', codeBlocks)
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

    log.debug('Collapsable resource block mounted', { resource, initialCollapsed })

    if (initialCollapsed) {
      collapsed = true
    } else if (!initialCollapsed) {
      collapsed = false
    }
  })
</script>

{#if isImage && resource}
  <ImageBlock
    bind:this={imageBlockRef}
    {resource}
    {isEditable}
    containerElement={codeBlockELem}
    {collapsed}
    {isResizing}
    bind:containerHeight
    bind:containerWidth
  >
    <svelte:element
      this={as}
      bind:this={codeBlockELem}
      id="collapsable-block-{id}"
      class:isResizing
      data-resizable={resizable}
      data-is-image={isImage}
      class="collapsable-block relative bg-gray-900 flex flex-col overflow-hidden {fitContent
        ? 'w-fit'
        : containerWidth !== 'auto'
          ? ''
          : 'w-full'} {fullSize ? '' : 'rounded-xl'} {fullSize || resizable || collapsed
        ? ''
        : 'h-full max-h-[750px]'} {fullSize ? 'h-full' : ''}"
      style={containerWidth !== 'auto' ? `width: ${containerWidth}` : ''}
    >
      {#if !hideHeader}
        <header
          class="flex-shrink-0 flex items-center justify-between gap-3 p-2"
          contenteditable="false"
        >
          <div class="flex items-center gap-1 w-full">
            {#if collapsable}
              <button
                tabindex="-1"
                class="text-sm flex items-center gap-2 p-1 rounded-md hover:bg-gray-500/30 transition-colors opacity-40"
                on:click|stopPropagation={() => (collapsed = !collapsed)}
              >
                {#if loading}
                  <Icon name="spinner" />
                {:else}
                  <Icon
                    name="chevron.right"
                    className="{!collapsed && expandable
                      ? 'rotate-90'
                      : ''} transition-transform duration-75"
                  />
                {/if}
              </button>
            {/if}

            {#if title}
              <div class="w-full">
                {#if loading && loadingMessage}
                  <div class=" flex-shrink-0">
                    {loadingMessage}
                  </div>
                {:else}
                  <input
                    tabindex="-1"
                    bind:this={inputElem}
                    on:input={handleInputChange}
                    on:keydown={handleInputKeydown}
                    on:blur={handleInputBlur}
                    on:click|stopPropagation
                    disabled={!isEditable}
                    value={title}
                    placeholder="Name"
                    class="text-base font-medium bg-gray-800 w-full rounded-md p-1 bg-transparent focus:outline-none opacity-60 focus:opacity-100"
                  />
                {/if}
              </div>
            {/if}
          </div>

          <div class="flex items-center gap-3">
            <slot name="actions"></slot>
          </div>
        </header>
      {/if}

      {#if !collapsed && expandable}
        <div
          class="code-container bg-gray-900 w-full flex-grow overflow-auto {fullSize ||
          resizable ||
          collapsed
            ? ''
            : 'h-[750px]'}"
          class:disabled={isResizing}
          style={resizable && !fullSize && !collapsed
            ? `height: ${containerHeight === '-1' ? 'auto' : containerHeight}; ${additionalWrapperStyles}`
            : ''}
        >
          <slot height={containerHeight}></slot>
        </div>
      {/if}

      {#if resizable && !collapsed}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="resize-handle"
          on:mousedown={handleResizeStart}
          on:touchstart|preventDefault={handleResizeStart}
        />
      {/if}

      {#if isImage && !collapsed && imageBlockRef}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="resize-handle-width"
          on:mousedown={imageBlockRef.handleWidthResizeStart}
          on:touchstart|preventDefault={imageBlockRef.handleWidthResizeStart}
        />
      {/if}
    </svelte:element>
  </ImageBlock>
{:else}
  <svelte:element
    this={as}
    bind:this={codeBlockELem}
    id="collapsable-block-{id}"
    class:isResizing
    data-resizable={resizable}
    class="collapsable-block relative bg-gray-900 flex flex-col overflow-hidden {fitContent
      ? 'w-fit'
      : 'w-full'} {fullSize ? '' : 'rounded-xl'} {fullSize || resizable || collapsed
      ? ''
      : 'h-full max-h-[750px]'} {fullSize ? 'h-full' : ''}"
  >
    {#if !hideHeader}
      <header
        class="flex-shrink-0 flex items-center justify-between gap-3 p-2"
        contenteditable="false"
      >
        <div class="flex items-center gap-1 w-full">
          {#if collapsable}
            <button
              tabindex="-1"
              class="text-sm flex items-center gap-2 p-1 rounded-md hover:bg-gray-500/30 transition-colors opacity-40"
              on:click|stopPropagation={() => (collapsed = !collapsed)}
            >
              {#if loading}
                <Icon name="spinner" />
              {:else}
                <Icon
                  name="chevron.right"
                  className="{!collapsed && expandable
                    ? 'rotate-90'
                    : ''} transition-transform duration-75"
                />
              {/if}
            </button>
          {/if}

          {#if title}
            <div class="w-full">
              {#if loading && loadingMessage}
                <div class=" flex-shrink-0">
                  {loadingMessage}
                </div>
              {:else}
                <input
                  tabindex="-1"
                  bind:this={inputElem}
                  on:input={handleInputChange}
                  on:keydown={handleInputKeydown}
                  on:blur={handleInputBlur}
                  on:click|stopPropagation
                  disabled={!isEditable}
                  value={title}
                  placeholder="Name"
                  class="text-base font-medium bg-gray-800 w-full rounded-md p-1 bg-transparent focus:outline-none opacity-60 focus:opacity-100"
                />
              {/if}
            </div>
          {/if}
        </div>

        <div class="flex items-center gap-3">
          <slot name="actions"></slot>
        </div>
      </header>
    {/if}

    {#if !collapsed && expandable}
      <div
        class="code-container bg-gray-900 w-full flex-grow overflow-auto {fullSize ||
        resizable ||
        collapsed
          ? ''
          : 'h-[750px]'}"
        class:disabled={isResizing}
        style={resizable && !fullSize && !collapsed
          ? `height: ${containerHeight === '-1' ? 'auto' : containerHeight}; ${additionalWrapperStyles}`
          : ''}
      >
        <slot height={containerHeight}></slot>
      </div>
    {/if}

    {#if resizable && !collapsed}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        class="resize-handle"
        on:mousedown={handleResizeStart}
        on:touchstart|preventDefault={handleResizeStart}
      />
    {/if}
  </svelte:element>
{/if}

<style lang="scss">
  @use '@deta/ui/src/lib/styles/utils' as utils;

  :global(.code-wrapper code.hljs) {
    overflow: unset;
    outline: none;
  }

  .code-container.disabled {
    pointer-events: none !important;
  }

  //:global(body:has(collapsable-block.isResizing)) {
  //  cursor: ns-resize;
  //  user-select: none;
  //  pointer-events: none;

  //  collapsable-block.isResizing .resize-handle {
  //    pointer-events: auto;
  //  }
  //}

  // Prevent drag preview from being too large
  :global(collapsable-block[data-drag-preview]) {
    width: var(--drag-width) !important;
    height: var(--drag-height) !important;
  }

  collapsable-block {
    border: 1px solid light-dark(oklch(93.1% 0 0), #444);
    position: relative;

    &[data-resizable='true'] {
      .resize-handle {
        position: absolute;
        bottom: -1px;
        left: 0.5rem;
        right: 0.5rem;
        height: 6px;
        border-radius: 90%;
        cursor: ns-resize;
        background: light-dark(oklch(93.1% 0 0), oklch(93.1% 0 0));
        opacity: 0;
        transition: opacity 0.1s ease;
        z-index: 10;
        pointer-events: all;

        &::after {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: 2px;
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

    &[data-is-image='true'] {
      .resize-handle-width {
        position: absolute;
        top: 0;
        bottom: 0;
        right: -1px;
        width: 4px;
        cursor: ew-resize;
        background: light-dark(#bbb, #444);
        opacity: 0;
        transition: opacity 0.1s ease;
        z-index: 10;
        pointer-events: all;

        &::after {
          content: '';
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          right: 1px;
          width: 2px;
          height: 32px;
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
    background: light-dark(#f3faff, rgb(29 33 44));
  }

  footer {
    background: light-dark(#eaf3fa, rgb(29 33 44));
  }

  // Override Tailwind bg-gray classes with light-dark() support
  :global(.collapsable-block.bg-gray-900) {
    background-color: light-dark(#f9f9f9, #111827) !important;
  }

  :global(.collapsable-block .bg-gray-800) {
    background-color: light-dark(#ffffff, #1f2937) !important;
  }

  :global(.code-container.bg-gray-900) {
    background-color: light-dark(#f9f9f9, #111827) !important;
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
            width: 100% !important;
            object-fit: contain;
          }
        }
      }
    }
  }
</style>
