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
  import { useLogScope, hover } from '@horizon/utils'
  import { HTMLDragZone, DragculaDragEvent } from '@horizon/dragcula'

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
  const handleDragEnter = (drag: DragculaDragEvent) => {
    if (dragoverTimeout) clearTimeout(dragoverTimeout)

    dragoverTimeout = setTimeout(() => {
      dispatch('select')
      dragoverTimeout = null
    }, 800)
  }

  const handleDragLeave = (drag: DragculaDragEvent) => {
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
  class="folder-wrapper {processing ? 'magic-in-progress' : ''}"
  data-vaul-no-drag
  data-folder-id={id}
  aria-hidden="true"
  draggable={true}
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
>
  <div
    class="folder {selected
      ? 'bg-sky-100 dark:bg-gray-700'
      : 'hover:bg-sky-50 dark:hover:bg-gray-800'}"
    on:click={handleSpaceSelect}
    aria-hidden="true"
    use:hover={hovered}
    bind:this={previewContainer}
    data-tooltip-target={id === 'inbox' ? 'stuff-spaces-inbox' : ''}
  >
    <div class="folder-label">
      <div class="folder-leading">
        <div class="space-icon-wrapper" aria-hidden="true">
          <Icon name={icon} size="20px" />
        </div>

        <div
          class="folder-input"
          style={`width: ${inputWidth};`}
          aria-hidden="true"
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
    padding: 0.525rem 0.75rem;
    border-radius: 16px;
    cursor: pointer;

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

      .actions {
        position: absolute;
        right: 0;
        display: flex;
        gap: 0.75rem;
        flex-shrink: 0;

        button {
          padding: 0.25rem;
          &:hover {
            border-radius: 4px;
            background: #cee2ff;
          }
        }
      }

      .folder-leading {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
        max-width: calc(100% - 1rem);
        overflow: visible;
      }

      .space-icon-wrapper {
        padding: 0.25rem;
        border-radius: 4px;
      }

      .close {
        display: flex;
        align-items: center;
        justify-content: center;
        appearance: none;
        border: none;
        padding: 0;
        margin: 0;
        height: min-content;
        background: none;
        color: #5c77a8;
        cursor: pointer;
        transition: color 0.2s ease;

        &:hover {
          color: #244581;
        }

        &:disabled {
          color: #7d96c5;
        }
      }
    }

    @apply text-[#244581] dark:text-gray-100;
  }

  .folder.active {
    color: #585130;
    z-index: 1000;
    background-color: #blue;
  }

  .draggedOver {
    border-radius: 8px;
    background-color: #a9a9a9 !important;
  }
</style>
