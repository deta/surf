<script lang="ts">
  import { useDebounce, useLogScope } from '@deta/utils'
  import { useResourceManager } from '@deta/services/resources'
  import { ResourceTagsBuiltInKeys } from '@deta/types'
  import type { Resource } from '@deta/services/resources'

  export let resource: Resource
  export let isEditable: boolean = true
  export let containerElement: HTMLElement | undefined = undefined
  export let collapsed: boolean = false
  export let isResizing: boolean = false
  export let containerHeight: string = '400px'
  export let containerWidth: string = 'auto'

  const log = useLogScope('ImageBlock')
  const resourceManager = useResourceManager()

  let isResizingWidth = false
  let startX = 0
  let startWidth = 0
  let imageAspectRatio = 1
  let captionInput: HTMLTextAreaElement
  let isEditingCaption = false
  let isHovering = false
  let rafId: number | null = null

  $: caption =
    (resource?.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.CAPTION)?.value || ''
  $: showCaption = isEditable

  export const handleWidthResizeStart = (e: MouseEvent | TouchEvent) => {
    isResizingWidth = true
    startX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX
    startWidth = containerElement?.offsetWidth ?? 0

    log.debug('Start width resizing', { startWidth })

    window.addEventListener('mousemove', handleWidthResizeMove, { capture: true })
    window.addEventListener('mouseup', handleWidthResizeEnd, { capture: true, once: true })

    e.preventDefault()
    e.stopPropagation()
  }

  const handleWidthResizeMove = (e: MouseEvent) => {
    if (!isResizingWidth) return
    e.preventDefault()
    e.stopPropagation()

    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }

    rafId = requestAnimationFrame(() => {
      const deltaX = e.clientX - startX
      const wrapper = containerElement?.parentElement
      const maxWidth = wrapper?.offsetWidth ?? window.innerWidth
      const newWidth = Math.max(200, Math.min(maxWidth, startWidth + deltaX))
      containerWidth = `${newWidth}px`
      rafId = null
    })
  }

  const handleWidthResizeEnd = () => {
    if (!isResizingWidth) return

    // Cancel any pending RAF
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    isResizingWidth = false
    window.removeEventListener('mousemove', handleWidthResizeMove, { capture: true })
  }

  const handleCaptionClick = () => {
    if (!isEditable) return
    isEditingCaption = true
    setTimeout(() => {
      captionInput?.focus()
      autoResizeTextarea()
    }, 0)
  }

  const autoResizeTextarea = () => {
    if (!captionInput) return
    captionInput.style.height = 'auto'
    captionInput.style.height = captionInput.scrollHeight + 'px'
  }

  const handleCaptionInput = () => {
    autoResizeTextarea()
  }

  const handleCaptionBlur = async () => {
    isEditingCaption = false
    if (!resource) return

    const existingCaptionTag = resource.tags?.find(
      (tag) => tag.name === ResourceTagsBuiltInKeys.CAPTION
    )

    if (caption) {
      if (existingCaptionTag) {
        await resourceManager.updateResourceTag(
          resource.id,
          ResourceTagsBuiltInKeys.CAPTION,
          caption
        )
      } else {
        await resourceManager.createResourceTag(
          resource.id,
          ResourceTagsBuiltInKeys.CAPTION,
          caption
        )
      }
    } else {
      if (existingCaptionTag) {
        await resourceManager.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.CAPTION)
      }
    }
  }

  const handleCaptionKeydown = (e: KeyboardEvent) => {
    e.stopPropagation()

    if (e.key === 'Enter') {
      e.preventDefault()
      captionInput?.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      isEditingCaption = false
    }
  }

  const handleCaptionPaste = (e: ClipboardEvent) => {
    e.stopPropagation()
  }

  export function getImageAspectRatio(): number {
    if (!containerElement) return 1

    const img = containerElement.querySelector('img') as HTMLImageElement
    if (img && img.naturalWidth && img.naturalHeight) {
      imageAspectRatio = img.naturalWidth / img.naturalHeight
    } else {
      const currentWidth = containerElement.offsetWidth
      const currentHeight = parseInt(containerHeight)
      imageAspectRatio = currentWidth / currentHeight
    }

    return imageAspectRatio
  }

  export function updateWidthFromHeight(newHeight: number) {
    if (!containerElement) return

    const wrapper = containerElement.parentElement
    const maxWidth = wrapper?.offsetWidth ?? window.innerWidth
    const newWidth = Math.min(maxWidth, Math.round(newHeight * imageAspectRatio))
    containerWidth = `${newWidth}px`
  }
</script>

<div
  class="image-block-wrapper"
  on:mouseenter={() => (isHovering = true)}
  on:mouseleave={() => (isHovering = false)}
>
  <slot />

  {#if showCaption}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="caption-container"
      class:visible={isHovering || caption || isEditingCaption}
      on:mousedown|stopPropagation
      on:click|stopPropagation
      style={containerWidth !== 'auto' ? `width: ${containerWidth}` : ''}
    >
      {#if isEditingCaption}
        <textarea
          bind:this={captionInput}
          bind:value={caption}
          on:input={handleCaptionInput}
          on:blur={handleCaptionBlur}
          on:keydown={handleCaptionKeydown}
          on:paste={handleCaptionPaste}
          placeholder="Add a caption..."
          class="caption-input"
          rows="1"
        />
      {:else}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="caption-text" on:click={handleCaptionClick}>
          {caption || 'Add a caption...'}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  .image-block-wrapper {
    position: relative;
  }

  .caption-container {
    position: relative;
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: all;
    opacity: 0;
    width: 100%;
    transition: opacity 0.15s ease;

    &.visible {
      opacity: 1;
    }
  }

  .caption-text {
    cursor: text;
    padding: 0.25rem 0.5rem;
    color: light-dark(rgba(0, 0, 0, 0.4), rgba(255, 255, 255, 0.4));
    font-size: 0.75rem;
    line-height: 1.3;
    transition: color 0.15s ease;

    &:hover {
      color: light-dark(rgba(0, 0, 0, 0.6), rgba(255, 255, 255, 0.6));
    }
  }

  .caption-input {
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: none;
    outline: none;
    color: light-dark(rgba(0, 0, 0, 0.7), rgba(255, 255, 255, 0.7));
    font-size: 0.75rem;
    line-height: 1.3;
    font-family: inherit;
    text-align: center;
    width: 100%;
    resize: none;
    overflow: hidden;
    box-sizing: border-box;

    &::placeholder {
      color: light-dark(rgba(0, 0, 0, 0.3), rgba(255, 255, 255, 0.3));
    }
  }
</style>
