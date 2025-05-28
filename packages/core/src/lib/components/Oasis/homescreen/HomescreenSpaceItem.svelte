<script lang="ts">
  import { writable } from 'svelte/store'
  import { useOasis, type OasisSpace } from '../../../service/oasis'
  import { createEventDispatcher, onMount } from 'svelte'
  import LazyScroll from '../../Utils/LazyScroll.svelte'
  import SpaceIcon from '../../Atoms/SpaceIcon.svelte'
  import { useToasts } from '../../../service/toast'
  import { contextMenu, type CtxItem } from '../../Core/ContextMenu.svelte'
  import { SpaceEntryOrigin, type RenderableItem } from '../../../types'
  import OasisResourcesView from '../ResourceViews/OasisResourcesView.svelte'
  import SpacePreviewSimple from '../SpacePreviewSimple.svelte'

  export let space: OasisSpace
  export let renderContents: boolean = true

  const oasis = useOasis()

  const dispatch = createEventDispatcher<{
    'open-space': { space: OasisSpace; background: boolean }
    'change-space-view-mode': 'list' | 'grid'
    'remove-from-homescreen': void
    'open-space-as-tab': OasisSpace
    'open-space-as-context': OasisSpace
  }>()

  const toasts = useToasts()

  const spaceData = space.data

  const renderedContents = writable<RenderableItem[]>([])
  space.contents.subscribe(async (contents) => {
    if (!renderContents) {
      renderedContents.set([])
      return
    }

    const items = await Promise.all(
      contents
        .filter((e) => e.manually_added !== SpaceEntryOrigin.Blacklisted)
        .map(async (e) => {
          return {
            id: e.entry_id,
            type: e.entry_type,
            data: e.entry_type === 'space' ? await oasis.getSpace(e.entry_id) : null
          } as RenderableItem
        })
    )
    renderedContents.set(items)
  })

  let clickTimeout: ReturnType<typeof setTimeout>
  let handledDoubleClick = false

  function handleClick(e: MouseEvent) {
    clickTimeout = setTimeout(() => {
      if (handledDoubleClick) {
        handledDoubleClick = false
        return
      }

      dispatch('open-space', { space, background: e.metaKey || e.ctrlKey })
    }, 200)
  }

  function getContextMenuItems() {
    return [
      {
        type: 'action' as const,
        icon: 'arrow.up.right',
        text: 'Open as Tab',
        action: () => {
          dispatch('open-space-as-tab', space)
          toasts.success('Opened space in new tab')
        }
      },
      {
        type: 'separator' as const
      },
      {
        type: 'action',
        icon: 'reload',
        text: 'Refresh',
        action: () => space.fetchContents()
      },
      {
        type: 'action',
        kind: 'danger',
        icon: 'trash',
        text: 'Remove from Desktop',
        action: () => dispatch('remove-from-homescreen')
      }
    ] as CtxItem[]
  }

  onMount(() => {
    if (renderContents) space.fetchContents()
  })
</script>

<div
  class="space-preview"
  use:contextMenu={{
    items: getContextMenuItems()
  }}
>
  <header on:click={handleClick}>
    <div class="icon">
      <SpaceIcon folder={space} interactive={false} size="sm" />
    </div>
    <span class="name">{$spaceData.folderName}</span>
  </header>

  {#if renderContents}
    <div class="content view-masonry">
      <LazyScroll items={renderedContents} let:renderedItems>
        <OasisResourcesView
          items={renderedItems}
          searchValue={writable('')}
          viewType={'grid'}
          fadeIn={false}
          viewDensity={'cozy'}
          sortBy={'resource_added_to_space'}
          order={'desc'}
          isInSpace={true}
        />
      </LazyScroll>
    </div>
  {/if}
</div>

<style lang="scss">
  .space-preview {
    --text-color: #1c1c3b;
    --text-muted-opacity: 1;

    :global(.dark) & {
      --text-color: #fff;
    }

    position: relative;
    height: 100%;
    padding: 0;

    container: space-container / size;

    > header {
      position: absolute;
      z-index: 2;
      top: 0;
      width: 100%;
      padding: 0.75em 1.25em;

      display: flex;
      align-items: center;
      gap: 0.5em;

      background: #fff;
      color: var(--text-color);
      border-bottom: 1px solid rgba(50, 50, 50, 0.075);
      box-shadow:
        0 0 0 1px rgba(50, 50, 93, 0.06),
        0 2px 5px 0 rgba(50, 50, 93, 0.04),
        0 1px 1.5px 0 rgba(0, 0, 0, 0.01);

      .icon {
        max-width: 22px;
        flex-shrink: 0;
      }

      .name {
        font-size: 1em;
        font-weight: 500;
        letter-spacing: 0.2px;
        opacity: var(--text-muted-opacity);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;

        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      :global(.dark) & {
        background: #232e3e;
      }
    }

    &:not(:has(.content)) {
      > header {
        height: 100%;
        justify-content: center;

        @container space-container (aspect-ratio <= 1 / 1) {
          flex-direction: column;
          gap: 1em;

          .name {
            order: -1;
            white-space: unset;
            text-align: center;
            max-width: 100%;

            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            text-wrap: balance;
          }

          .icon {
            position: static;
            max-width: 60px;
            max-height: 60px;

            :global(span) {
              font-size: 3em !important;
            }
            :global(.color-icon) {
              --size: 60px !important;
            }
          }
        }

        @container space-container (aspect-ratio > 1 / 1) {
          gap: 1em;

          .icon {
            position: static;
            max-width: 40px;
            max-height: 40px;

            :global(span) {
              font-size: 2.5em !important;
            }
            :global(.color-icon) {
              --size: 40px !important;
            }
          }

          .name {
            flex: 1;
          }
        }
      }
    }

    > .content {
      height: 100%;
      margin-top: 2rem;
    }
    > .content.view-masonry {
      :global(.masonry-grid) {
        --columns: 1 !important;
        --padding-inline: 15 !important;
        --padding-block: 80 !important;
        --gap: -10 !important;

        :global(.resource-preview) {
          font-size: 0.95em;
          --section-padding-inline: 1em !important;
          --section-padding-block: 0.9em !important;

          :global(.inner > hgroup:last-child) {
            margin-bottom: 0.75em;
          }
        }
      }

      @container space-container (width > 50ch) {
        :global(.masonry-grid) {
          --columns: 2 !important;
        }
      }
      @container space-container (width > 80ch) {
        :global(.masonry-grid) {
          --columns: 3 !important;
        }
      }
      @container space-container (width > 120ch) {
        :global(.masonry-grid) {
          --columns: 4 !important;
        }
      }
    }
  }
</style>
