<script lang="ts">
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { HTMLDragItem, type DragculaDragEvent } from '@horizon/dragcula'
  import { DragTypeNames, type DragTypes } from '../../types'
  import { OasisSpace, useOasis } from '../../service/oasis'
  import { createEventDispatcher, onMount } from 'svelte'
  import OasisResourceLoader from '../Oasis/OasisResourceLoader.svelte'
  import { Icon } from '@horizon/icons'
  import LazyComponent from '../Atoms/LazyComponent.svelte'
  import { contextMenu } from '../Core/ContextMenu.svelte'
  import { useTabsManager } from '../../service/tabs'
  import { useToasts } from '@horizon/core/src/lib/service/toast'

  export let space: OasisSpace
  export let draggable: boolean | undefined

  // NOTE: container will use container query to determine the mode
  export let mode: 'full' | 'compact' | 'tiny' | 'container' = 'full'

  export let contentViewMode: 'list' | 'grid' = 'list'
  export let contentMode =
    space?.dataValue?.folderName === 'Media'
      ? 'media'
      : contentViewMode === 'grid'
        ? 'media'
        : 'tiny'

  $: spaceData = space.data

  const dispatch = createEventDispatcher<{
    'select-space': string
    'change-space-view-mode': 'list' | 'grid'
    'remove-from-homescreen': void
    'open-space-as-tab': OasisSpace
  }>()
  const oasis = useOasis()
  const resourceManager = oasis.resourceManager
  const tabsManager = useTabsManager()
  const toasts = useToasts()

  let spaceContents: any[] = []

  function handleDragStart(drag: DragculaDragEvent<DragTypes>) {
    drag.item?.data.setData(DragTypeNames.SURF_SPACE, space)
    drag.continue()
  }

  async function loadContents() {
    spaceContents = (await oasis.getSpaceContents(space.id)).sort(
      (a, b) => a.updated_at - b.updated_at
    )
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
        action: () => loadContents()
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

  onMount(async () => {
    loadContents()
    console.warn('spaceContents', spaceContents)
  })
</script>

<div
  class="space-preview mode-{mode} {contentMode} {contentViewMode}"
  use:contextMenu={{
    items: getContextMenuItems()
  }}
>
  <div class="identity">
    <div class="flex" style="gap: 1ch;" on:click={() => dispatch('select-space', space.id)}>
      <span class="name">{$spaceData.folderName}</span>
      <SpaceIcon folder={space} interactive={false} />
    </div>
    <button
      class="btn-change-view"
      on:click={() => {
        contentViewMode = contentViewMode === 'list' ? 'grid' : 'list'
        dispatch('change-space-view-mode', contentViewMode)
      }}
    >
      <Icon name={contentViewMode === 'list' ? 'grid' : 'list'} size="16px" />
    </button>
  </div>
  <div class="content mode-{contentViewMode}">
    {#each spaceContents as item, i (item.resource_id + i)}
      <LazyComponent this={() => import('../Oasis/OasisResourceLoader.svelte')}>
        <svelte:fragment slot="component" let:Component>
          <Component
            style="--even: {i % 2 === 0 ? 0 : 1};"
            resourceOrId={item.resource_id}
            mode={contentMode}
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
  </div>
</div>

<style lang="scss">
  .space-preview {
    width: 100%;
    height: 100%;
    overflow: hidden;

    container: space-container / inline-size;

    > .identity {
      display: flex;
      justify-content: space-between;
    }

    &.mode-compact {
      position: relative;
      display: grid;
      grid-template-columns: 1fr;
      grid-template-rows: min-content auto;

      > .identity {
        flex-direction: column;
        .name {
          grid-row: 1;
          font-size: 1.2em;
          font-weight: 500;
          text-align: center;
          margin-bottom: 1ch;
        }

        :global(.color-icon) {
          grid-row: 2;
          /*position: absolute;
        inset: 0;
        top: 40%;*/
          width: 100%;
          height: auto;
          aspect-ratio: 1 / 1;
        }
      }
    }

    &.mode-container {
      position: relative;
      display: grid;
      grid-template-columns: 1fr;
      grid-template-rows: 3em auto;

      @container space-container (width < 25ch) {
        .identity {
          grid-column: 1;
          grid-row: 1 / 3 !important;

          flex-direction: column !important;
          > div {
            flex-direction: column !important;
            align-items: center;
            height: 100%;

            > :global(.color-icon) {
              position: absolute;
              bottom: 0;
              left: 50%;
              transform: translateX(-50%) scale(6);
            }
          }
        }
        .btn-change-view {
          display: none;
        }
        .content {
          display: none !important;
        }
      }

      > .identity {
        position: relative;
        z-index: 1;
        grid-column: 1;
        grid-row: 1;
        flex-direction: row;
        align-items: center;
        padding: 0.75em 0.75em;
        background: rgba(255, 255, 255, 0.6);

        .name {
          font-size: 0.95em;
          font-weight: 500;
          letter-spacing: 0.05em;
          cursor: pointer;
        }
        :global(.color-icon) {
          order: -1;
          width: 16px;
          height: 16px;
        }

        &::before {
          content: '';
          position: absolute;
          z-index: -1;
          inset: 0;
          pointer-events: none;
          height: 200%;
          background: rgba(255, 255, 255, 0.95);
          //box-shadow: 0 0 4px 1px rgba(0, 0, 0, 0.05);
          //backdrop-filter: blur(4px);
          mask: linear-gradient(to bottom, rgba(0, 0, 0, 1), rgba(255, 255, 255, 0));
        }
      }

      > .content {
        z-index: 0;
        grid-column: 1;
        grid-row: 1 / 3;
        overflow-y: auto;
        //padding: 0.5em;
        padding-top: calc(3em + var(--content-padding)) !important;

        &.mode-list {
          display: flex;
          flex-direction: column;
          //gap: 0.5em;

          > :global(.wrapper) {
            padding: 0.5ch 1ch;
            background: rgba(250, 250, 250, var(--even));

            :global(.preview) {
              background: transparent;
            }
          }
        }
        &.mode-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(5em, 0.5fr));
          gap: 10px;
          grid-auto-rows: 0.5fr;
          padding: var(--content-padding);
        }
      }
    }
  }

  :global(.space-preview[data-drag-preview]) {
    background: rgba(255, 255, 255, 1);
    opacity: 80%;
    border: 2px solid rgba(10, 12, 24, 0.1);
    box-shadow:
      rgba(50, 50, 93, 0.2) 0px 13px 27px -5px,
      rgba(0, 0, 0, 0.25) 0px 8px 16px -8px;

    width: var(--drag-width, auto);
    height: var(--drag-height, auto);
    transition:
      0s ease-in-out,
      transform 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      outline 175ms cubic-bezier(0.4, 0, 0.2, 1),
      width 175ms cubic-bezier(0.4, 0, 0.2, 1),
      height 175ms cubic-bezier(0.4, 0, 0.2, 1) !important;
  }
</style>
