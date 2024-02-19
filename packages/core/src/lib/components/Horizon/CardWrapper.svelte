<!-- <svelte:options immutable={true} /> -->

<script lang="ts">
  import { SvelteComponent, createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { get, type Writable } from 'svelte/store'
  import { tooltip } from '@svelte-plugins/tooltips'

  import {
    Draggable,
    Positionable,
    Resizable,
    type IPositionable,
    LazyComponent
  } from '@horizon/tela'

  import type { Card, CardEvents } from '../../types'
  import { useLogScope } from '../../utils/log'
  import type { Horizon } from '../../service/horizon'
  import { Icon } from '..'

  // TODO: fix this unnecessary cast
  const BrowserCard = () =>
    import('../Cards/Browser/BrowserCard.svelte') as unknown as Promise<typeof SvelteComponent>
  const TextCard = () =>
    import('../Cards/Text/TextCard.svelte') as unknown as Promise<typeof SvelteComponent>
  const LinkCard = () =>
    import('../Cards/Link/LinkCard.svelte') as unknown as Promise<typeof SvelteComponent>
  const FileCard = () =>
    import('../Cards/File/FileCard.svelte') as unknown as Promise<typeof SvelteComponent>

  export let positionable: Writable<IPositionable<any>>
  export let horizon: Horizon

  $: board = horizon.board
  $: state = board?.state
  $: viewPort = $state?.viewPort

  const dispatch = createEventDispatcher<CardEvents>()
  const log = useLogScope('CardWrapper')

  const minSize = { x: 100, y: 100 }
  const maxSize = { x: Infinity, y: Infinity }
  const DRAGGING_MENU_PADDING = 50

  let el: HTMLElement
  let menuPosition = 'top'
  let insetMenu = false
  let headerClickTimeout: ReturnType<typeof setTimeout> | null = null

  $: card = positionable as Writable<Card> // todo: fix this unnecessary cast
  $: cardTitle = $card.type[0].toUpperCase() + $card.type.slice(1)
  $: activeCardId = horizon.activeCardId
  $: active = $activeCardId === $card.id
  $: allowDuplicating = ['text', 'browser'].includes($card.type)

  const updateCard = () => {
    log.debug('updateCard', $card)
    dispatch('change', $card)
  }

  const handleMouseDown = () => {
    horizon.setActiveCard($card.id)
  }

  const handleDragEnd = (_: any) => {
    const board = horizon.board
    if (!board) console.error('No board found ond rag end')
    const state = get(board!.state)
    $card.stacking_order = get(state.stackingOrder).indexOf($card.id)
    updateCard()
  }

  const handleMouseMove = (_e: MouseEvent) => {
    const rect = el.getBoundingClientRect()

    if (rect.y < DRAGGING_MENU_PADDING) {
      insetMenu = true
    } else {
      insetMenu = false
    }
  }

  const handleCardHeaderMouseDown = (_e: MouseEvent) => {
    if (headerClickTimeout) {
      clearTimeout(headerClickTimeout)
      headerClickTimeout = null
      log.debug('double click')

      positionable.update((p) => {
        p.height = ($viewPort?.h ?? window.innerHeight) - p.y - DRAGGING_MENU_PADDING
        return p
      })
    } else {
      headerClickTimeout = setTimeout(() => {
        headerClickTimeout = null
      }, 500)
    }
  }

  const handleDelete = () => {
    dispatch('delete', $card)
  }

  const handleDuplicate = () => {
    dispatch('duplicate', $card)
  }

  onMount(() => {
    // el.addEventListener('draggable_start', onDragStart)
    // el.addEventListener('draggable_move', onDragMove)
    el.addEventListener('draggable_end', handleDragEnd)
    el.addEventListener('resizable_end', updateCard)
  })

  onDestroy(() => {
    // el && el.addEventListener('draggable_start', onDragStart)
    // el && el.addEventListener('draggable_move', onDragMove)
    el && el.removeEventListener('draggable_end', handleDragEnd)
    el && el.removeEventListener('resizable_end', updateCard)
  })
</script>

<!-- TODO: Obacht! Had the issue on old Horizon app, that ids can start
  with numbers -> Cannot use them in css selctors for example. Maybe add `id-` prefix -->
<Positionable
  {positionable}
  data-id={$positionable.id}
  class="card {$positionable.id} {active && 'active'}"
  contained={false}
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  bind:el
>
  <Resizable {positionable} direction="top-right" {minSize} {maxSize} />
  <Resizable {positionable} direction="top-left" {minSize} {maxSize} />
  <Resizable {positionable} direction="bottom-right" {minSize} {maxSize} />
  <Resizable {positionable} direction="bottom-left" {minSize} {maxSize} />
  <Resizable {positionable} direction="top" {minSize} {maxSize} />
  <Resizable {positionable} direction="bottom" {minSize} {maxSize} />
  <Resizable {positionable} direction="left" {minSize} {maxSize} />
  <Resizable {positionable} direction="right" {minSize} {maxSize} />

  <div class="draggable-bar">
    <Draggable {positionable} />
  </div>

  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    on:mousedown={handleCardHeaderMouseDown}
    class="card-header"
    data-position="top"
    data-inset={insetMenu}
    data-hide={active && insetMenu}
  >
    <Draggable {positionable} class="">
      <div class="card-header-content">
        <!-- <div class="card-title">{cardTitle}</div> -->
        <div class="card-header-actions">
          <button on:click={handleDelete}>
            <Icon name="close" />
          </button>
          <!-- <button on:click={handleCopy}>
              <Icon name="copy" />
            </button> -->
        </div>

        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="card-drag-indicator">
          <div></div>
          <div></div>
          <div></div>
        </div>

        <div class="card-header-actions end-placement">
          {#if allowDuplicating}
            <button
              use:tooltip={{ content: 'Create similar', action: 'hover' }}
              on:click={handleDuplicate}
            >
              <Icon name="add" />
            </button>
          {/if}
        </div>
      </div>
    </Draggable>
  </div>

  <div class="content tela-ignore" style={!active ? 'pointer-events: none;' : ''}>
    {#if $card.type === 'browser'}
      <LazyComponent this={BrowserCard}>
        <svelte:fragment slot="component" let:Component>
          <Component {card} {horizon} {active} on:load on:change on:delete />
        </svelte:fragment>
      </LazyComponent>
    {:else if $card.type === 'text'}
      <LazyComponent this={TextCard}>
        <svelte:fragment slot="component" let:Component>
          <Component {card} {horizon} {active} on:load on:change on:delete />
        </svelte:fragment>
      </LazyComponent>
    {:else if $card.type === 'link'}
      <LazyComponent this={LinkCard}>
        <svelte:fragment slot="component" let:Component>
          <Component {card} {horizon} {active} on:load on:change on:delete />
        </svelte:fragment>
      </LazyComponent>
    {:else if $card.type === 'file'}
      <LazyComponent this={FileCard}>
        <svelte:fragment slot="component" let:Component>
          <Component {card} {horizon} {active} on:load on:change on:delete />
        </svelte:fragment>
      </LazyComponent>
    {/if}
  </div>
</Positionable>

<style lang="scss">
  .draggable-bar {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 5px;
    z-index: 299;
  }

  .card-header {
    position: absolute;
    z-index: 301;
    opacity: 0;

    &[data-position='right'],
    &[data-position='left'] {
      height: 90%;
      max-height: 200px;
      top: 50%;

      .card-header-content {
        flex-direction: column;
        height: 100%;
        padding: 8px 5px;
      }

      .card-header-actions {
        align-items: flex-start;
      }

      .end-placement {
        flex: 1;
        align-items: flex-end;
      }

      .card-drag-indicator {
        flex-grow: 1;
        display: flex;
        gap: 4px;

        div {
          background: #999999;
          height: 100%;
          width: 1px;
        }
      }
    }

    &[data-position='right'] {
      right: 30px;
      transform: translate(100%, -50%);

      .card-header-content {
        border-left: none;
        border-top-right-radius: var(--theme-border-radius);
        border-bottom-right-radius: var(--theme-border-radius);
      }
    }

    &[data-position='left'] {
      left: 30px;
      transform: translate(-100%, -50%);

      .card-header-content {
        border-right: none;
        border-top-left-radius: var(--theme-border-radius);
        border-bottom-left-radius: var(--theme-border-radius);
      }
    }

    &[data-position='top'],
    &[data-position='bottom'] {
      width: 90%;
      max-width: 200px;
      left: 50%;

      .card-header-content {
        width: 100%;
        padding: 5px 8px;
      }

      .card-header-actions {
        align-items: flex-end;
      }

      .end-placement {
        flex: 1;
        justify-content: flex-end;
      }

      .card-drag-indicator {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;

        div {
          background: #999999;
          height: 1px;
          width: 100%;
        }
      }
    }

    &[data-position='top'] {
      // top: 0;
      transform: translate(-50%, -100%);

      // .card-header-content {
      //   border-bottom: none;
      //   border-top-left-radius: var(--theme-border-radius);
      //   border-top-right-radius: var(--theme-border-radius);
      // }
    }

    &[data-position='bottom'] {
      bottom: 0;
      transform: translate(-50%, 100%);

      .card-header-content {
        border-top: none;
        border-bottom-left-radius: var(--theme-border-radius);
        border-bottom-right-radius: var(--theme-border-radius);
      }
    }

    &[data-position='top']:not([data-inset='true']) {
      top: 0;

      .card-header-content {
        border-top-left-radius: var(--theme-border-radius);
        border-top-right-radius: var(--theme-border-radius);
      }
    }

    &[data-position='top'][data-inset='true'] {
      top: 29px;

      .card-header-content {
        border-top: none;
        border-bottom-left-radius: var(--theme-border-radius);
        border-bottom-right-radius: var(--theme-border-radius);
      }
    }
  }

  .card-header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border: 2px solid #ddd;
    background-color: #f5f5f5;
    overflow: hidden;
  }

  :global(.draggable) {
    height: 100%;
  }

  :global(.card:hover),
  :global(.dragging) {
    .card-header:not([data-hide='true']) {
      display: block;
      opacity: 1;
      z-index: 100000;
      &[data-position='right'] {
        right: 0;
      }

      &[data-position='left'] {
        left: 0;
      }
    }
  }

  :global(.card:hover.active),
  :global(.dragging.active) {
    .card-header {
      &[data-position='top'] {
        z-index: 0;
      }

      .tela-board .resizable {
        z-index: 0;
      }
    }
  }

  .card-header-actions {
    flex: 1;
    display: flex;
    gap: 0.5rem;
    color: #979797;

    button {
      background: transparent;
      border: none;
      outline: none;
      cursor: pointer;
      padding: 0;
      margin: 0;
      color: inherit;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        color: #7b7b7b;
      }
    }
  }

  // .card-title {
  //   padding: 0 10px;
  //   white-space: nowrap;
  //   overflow: hidden;
  //   text-overflow: ellipsis;
  //   font-size: 0.9rem;
  // }
</style>
