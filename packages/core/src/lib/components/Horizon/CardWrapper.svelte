<!-- <svelte:options immutable={true} /> -->

<script lang="ts">
  import { SvelteComponent, createEventDispatcher, onDestroy, onMount } from 'svelte'
  import type { Writable } from 'svelte/store'

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

  const dispatch = createEventDispatcher<CardEvents>()
  const log = useLogScope('CardWrapper')

  const minSize = { x: 100, y: 100 }
  const maxSize = { x: Infinity, y: Infinity }

  let el: HTMLElement

  $: card = positionable as Writable<Card> // todo: fix this unnecessary cast
  $: cardTitle = $card.type[0].toUpperCase() + $card.type.slice(1)

  const updateCard = () => {
    log.debug('updateCard', $card)
    dispatch('change', $card)
  }

  const handleDragEnd = (_: any) => {
    updateCard()
  }

  const handleDelete = () => {
    dispatch('delete', $card)
  }

  const handleCopy = () => {
    // dispatch('delete', $card)
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

<Positionable
  {positionable}
  data-id={$positionable.id}
  class="card {$positionable.id}"
  contained={false}
  bind:el
>
  <Resizable {positionable} direction="top-right" {minSize} {maxSize} />
  <Resizable {positionable} direction="top-left" {minSize} {maxSize} />
  <Resizable {positionable} direction="bottom-right" {minSize} {maxSize} />
  <Resizable {positionable} direction="bottom-left" {minSize} {maxSize} />

    <div class="card-header">
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

          <div class="card-drag-indicator">
            <div></div>
            <div></div>
            <div></div>
          </div>

          <div class="end-placement"></div>
        </div>
      </Draggable>
    </div>

  <div class="content tela-ignore">
    {#if $card.type === 'browser'}
      <LazyComponent this={BrowserCard}>
        <svelte:fragment slot="component" let:Component>
          <Component {card} {horizon} on:load on:change on:delete />
        </svelte:fragment>
      </LazyComponent>
    {:else if $card.type === 'text'}
      <LazyComponent this={TextCard}>
        <svelte:fragment slot="component" let:Component>
          <Component {card} {horizon} on:load on:change on:delete />
        </svelte:fragment>
      </LazyComponent>
    {:else if $card.type === 'link'}
      <LazyComponent this={LinkCard}>
        <svelte:fragment slot="component" let:Component>
          <Component {card} {horizon} on:load on:change on:delete />
        </svelte:fragment>
      </LazyComponent>
    {:else if $card.type === 'file'}
      <LazyComponent this={FileCard}>
        <svelte:fragment slot="component" let:Component>
          <Component {card} {horizon} on:load on:change on:delete />
        </svelte:fragment>
      </LazyComponent>
    {/if}
  </div>
</Positionable>

<style lang="scss">
  .card-header {
    position: absolute;
    z-index: 10;
    top: 0;
    left: 50%;
    transform: translate(-50%, -100%);
    width: 90%;
    max-width: 400px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .card-header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border: 1px solid #ddd;
    border-bottom: none;
    background-color: #f5f5f5;
    padding: 5px 8px;
    overflow: hidden;
    border-top-right-radius: var(--theme-border-radius);
    border-top-left-radius: var(--theme-border-radius);
  }

  :global(.card:hover), :global(.dragging) {
    .card-header {
      display: block;
      opacity: 1;
    }
  }

  .card-header-actions {
    flex: 1;
    display: flex;
    align-items: center;
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

  .card-drag-indicator {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;

    div {
      background:  #ddd;
      height: 1px;
      width: 100%;
    }
  }

  .end-placement {
    flex: 1;
  }

  // .card-title {
  //   padding: 0 10px;
  //   white-space: nowrap;
  //   overflow: hidden;
  //   text-overflow: ellipsis;
  //   font-size: 0.9rem;
  // }
</style>
