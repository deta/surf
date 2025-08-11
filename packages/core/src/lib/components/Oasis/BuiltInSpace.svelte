<script lang="ts" context="module">
  export type SpaceSelectedEvent = { id: string; canGoBack: boolean }
  export type BuiltInSpaceEvents = {
    select: void
    'space-selected': SpaceSelectedEvent
    Drop: { drag: DragculaDragEvent; spaceId: string }
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon, type Icons } from '@horizon/icons'
  import { selectedFolder } from '../../stores/oasis'
  import { DragTypeNames } from '@horizon/core/src/lib/types'
  import { useLogScope, hover } from '@deta/utils'
  import { HTMLDragZone, DragculaDragEvent, HTMLDragItem } from '@horizon/dragcula'
  import type { Timer } from '@deta/types'

  export let id: string
  export let name: string
  export let icon: Icons
  export let selected: boolean

  const log = useLogScope('BuiltInSpace')
  const dispatch = createEventDispatcher<BuiltInSpaceEvents>()

  let inputWidth = `${name.length}ch`
  let processing = false
  let previewContainer: HTMLDivElement

  const hovered = writable(false)
  const inView = writable(false)

  const handleSpaceSelect = async (event: MouseEvent) => {
    if (!(event.target as HTMLElement).closest('button')) {
      try {
        log.debug('Selected space:', id)
        if (name === '.tempspace' && $selectedFolder === '.tempspace') {
          return
        }

        dispatch('space-selected', { id: id, canGoBack: true })
      } catch (error) {
        log.error('Failed to select folder:', error)
      }
    }
  }

  let dragoverTimeout: Timer | null = null
  const handleDragEnter = (_drag: DragculaDragEvent) => {
    if (dragoverTimeout) clearTimeout(dragoverTimeout)

    dragoverTimeout = setTimeout(() => {
      dispatch('select')
      dragoverTimeout = null
    }, 800)
  }

  const handleDragLeave = (_drag: DragculaDragEvent) => {
    if (dragoverTimeout) clearTimeout(dragoverTimeout)
  }

  const handleDrop = async (drag: DragculaDragEvent) => {
    if (dragoverTimeout) clearTimeout(dragoverTimeout)
    dispatch('Drop', { drag, spaceId: id })
  }

  const initializeIntersectionObserver = () => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            inView.set(true)
            observer.disconnect() // Stop observing once it is in view
          }
        })
      },
      { threshold: 0.1 } // Trigger when 10% of the element is in view
    )

    if (previewContainer) {
      observer.observe(previewContainer)
    }
  }

  onMount(() => {
    initializeIntersectionObserver()
  })

  $: {
    inputWidth = `${name.length + 3}ch`
  }
</script>

<div
  id={`folder-${id}`}
  class="folder-wrapper select-none {processing ? 'magic-in-progress' : ''}"
  data-vaul-no-drag
  data-folder-id={id}
  role="none"
  use:HTMLDragZone.action={{
    accepts: (drag) => {
      if (
        drag.isNative ||
        drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
        drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
        drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
      ) {
        // Cancel if tab dragged is a space itself
        if (drag.item?.data.getData(DragTypeNames.SURF_TAB)?.type === 'space') {
          return false
        }

        return true
      }
      return false
    }
  }}
  on:DragEnter={handleDragEnter}
  on:DragLeave={handleDragLeave}
  on:Drop={handleDrop}
  draggable={false}
  use:HTMLDragItem.action={{}}
  on:DragStart={(e) => {
    e.data?.setData(DragTypeNames.SURF_SPACE, { id, name, icon })
  }}
>
  <div
    class="folder {selected
      ? 'bg-sky-100 dark:bg-gray-700'
      : 'hover:bg-sky-50 dark:hover:bg-gray-800'}"
    on:click={handleSpaceSelect}
    role="none"
    use:hover={hovered}
    bind:this={previewContainer}
    data-tooltip-target={id === 'inbox' ? 'stuff-spaces-inbox' : ''}
  >
    <div class="folder-label">
      <div class="folder-leading">
        <div class="space-icon-wrapper" role="none">
          <Icon name={icon} size="18px" />
        </div>

        <div
          class="folder-input text-[#244581] dark:text-sky-100/90"
          style={`width: ${inputWidth};`}
          role="none"
          on:click|stopPropagation={handleSpaceSelect}
        >
          {name}
        </div>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .folder-wrapper {
    position: relative;
    pointer-events: auto;
    border: 1px dashed transparent;
    width: 100%;
  }

  :global(.folder-wrapper[data-drag-preview]) {
    width: var(--drag-width, auto) !important;
    height: var(--drag-height, auto) !important;

    background: rgba(255, 255, 255, 1);
    border-radius: 16px;
    opacity: 80%;
    border: 2px solid rgba(10, 12, 24, 0.1) !important;
    box-shadow:
      rgba(50, 50, 93, 0.2) 0px 13px 27px -5px,
      rgba(0, 0, 0, 0.25) 0px 8px 16px -8px;
  }
  :global(.folder-wrapper:not([data-drag-preview])[data-drag-target]) {
    border-radius: 16px;
    outline: 1.5px dashed gray;
    outline-offset: -1.5px;
  }

  .folder {
    display: flex;
    flex-direction: column;
    align-items: end;
    justify-content: space-between;
    padding: 0.3rem 0.5rem;
    border-radius: 12px;

    position: relative;
    width: 100%;
    max-height: 12rem;
    font-weight: 500;
    letter-spacing: 0.0025em;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    z-index: 1000;

    .folder-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      position: relative;

      .folder-leading {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
        max-width: calc(100% - 1rem);
        overflow: visible;
        padding-left: 0.5rem;
      }

      .space-icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        margin: -0.25rem;
        border-radius: 4px;
      }

      .folder-input {
        border: none;
        background: transparent;
        font-size: 0.95em;
        font-weight: 450;
        letter-spacing: 0.01em;
        line-height: 1;
        font-smooth: always;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        max-width: 100%;
        padding: 0.525rem 0 0.5rem 0;
        outline: none;
        width: fit-content;

        // truncate text
        white-space: nowrap;
        overflow-y: visible;
        overflow-x: hidden;
        text-overflow: ellipsis;

        &::selection {
          background-color: rgba(0, 110, 255, 0.2);
        }
      }
    }

    @apply text-[#244581] dark:text-gray-100;
  }
</style>
