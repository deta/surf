<script lang="ts">
  import { derived, get, writable } from 'svelte/store'
  import type { OasisSpace } from '../../../service/oasis'
  import { createEventDispatcher, onMount } from 'svelte'
  import LazyScroll from '../../Utils/LazyScroll.svelte'
  import LazyComponent from '../../Atoms/LazyComponent.svelte'
  import MasonrySpace from '../MasonrySpace.svelte'
  import OasisResourceLoader from '../OasisResourceLoader.svelte'
  import SpaceIcon from '../../Atoms/SpaceIcon.svelte'
  import { useToasts } from '../../../service/toast'
  import { contextMenu } from '../../Core/ContextMenu.svelte'

  export let space: OasisSpace
  export let renderContents: boolean = true
  export let viewLayout: 'list' | 'masonry' = 'masonry'

  const dispatch = createEventDispatcher<{
    'open-space': { space: OasisSpace; background: boolean }
    'change-space-view-mode': 'list' | 'grid'
    'remove-from-homescreen': void
    'open-space-as-tab': OasisSpace
    'open-space-as-context': OasisSpace
  }>()

  const toasts = useToasts()

  const spaceData = space.data
  const renderedItemsCnt = writable(10)

  const renderedContents = derived([space.contents, renderedItemsCnt], ([contents, renderN]) => {
    if (!renderContents) return []
    return contents.slice(0, renderN)
  })

  let clickTimeout: ReturnType<typeof setTimeout>
  let handledDoubleClick = false

  function handleLazyLoad(e: CustomEvent<[number, number, number]>) {
    const [velocity, remainingAdjusted, remaining] = e.detail
    $renderedItemsCnt = $renderedItemsCnt + 5 * velocity
  }

  function handleClick(e: MouseEvent) {
    clickTimeout = setTimeout(() => {
      if (handledDoubleClick) {
        handledDoubleClick = false
        return
      }

      dispatch('open-space', { space, background: e.metaKey || e.ctrlKey })
    }, 200)
  }

  function handleDoubleClick() {
    handledDoubleClick = true
    clearTimeout(clickTimeout)
    dispatch('open-space-as-context', space)
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
        type: 'action' as const,
        icon: 'circle-dot',
        text: 'Open as Context',
        action: () => {
          dispatch('open-space-as-context', space)
          toasts.success('Opened space as context')
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
        text: 'Remove from Homescreen',
        action: () => dispatch('remove-from-homescreen')
      }
    ]
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
  <header on:click={handleClick} on:dblclick={handleDoubleClick}>
    <div class="icon">
      <SpaceIcon folder={space} interactive={false} size="sm" />
    </div>
    <span class="name">{$spaceData.folderName}</span>
  </header>
  {#if renderContents}
    <div class="content view-{viewLayout}">
      {#if viewLayout === 'list'}
        <LazyScroll baseItemHeight={200} on:lazyLoad={handleLazyLoad}>
          {#each $renderedContents as item, i (item.resource_id)}
            <LazyComponent this={() => import('../../Oasis/OasisResourceLoader.svelte')}>
              <svelte:fragment slot="component" let:Component>
                <Component
                  style="--even: {i % 2 === 0 ? 0 : 1};"
                  resourceOrId={item.resource_id}
                  mode="card"
                  viewMode="inline"
                  frameless={true}
                  origin="homescreen-space"
                  on:open
                  on:click
                  on:open-and-chat
                  on:remove
                  on:set-resource-as-background
                />
              </svelte:fragment>
            </LazyComponent>
          {/each}
        </LazyScroll>
      {:else}
        <MasonrySpace
          items={$renderedContents.map((e) => ({ id: e.id, data: e }))}
          isEverythingSpace={false}
          on:load-more={(e) => handleLazyLoad({ detail: [2, 0, 0] })}
          let:item
        >
          <OasisResourceLoader
            resourceOrId={item.data.resource_id}
            isInSpace={false}
            mode="compact"
            origin="homescreen-space"
            on:click
            on:open
            on:open-and-chat
            on:remove
            on:load
            on:blacklist-resource
            on:whitelist-resource
            on:set-resource-as-space-icon
            interactive={true}
            draggable
          />
        </MasonrySpace>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  .space-preview {
    --text-color: #1c1c3b;
    --text-muted-opacity: 1;

    position: relative;
    height: 100%;

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
    }

    &:not(:has(.content)) {
      > header {
        height: 100%;
      }

      @container space-container (aspect-ratio <= 1 / 1) {
        > header {
          flex-direction: column;

          .name {
            order: -1;
            white-space: unset;
            text-align: center;

            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            text-wrap: balance;
          }

          .icon {
            position: absolute;
            bottom: -3em;
            max-width: 100%;
            width: 100%;
            :global(span) {
              font-size: 7em !important;
            }
            :global(.color-icon) {
              --size: 90% !important;
            }
          }
        }
      }

      @container space-container (aspect-ratio > 1 / 1) {
        > header {
          .icon {
            position: absolute;
            right: -3em;
            max-width: 100%;
            //max-height: 100%;
            height: 120%;
            :global(span) {
              font-size: 5em !important;
            }
            :global(.color-icon) {
              --size: 90% !important;
            }
          }
        }
      }
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
