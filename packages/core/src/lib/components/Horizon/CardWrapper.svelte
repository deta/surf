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

  // TODO: fix this unnecessary cast
  const BrowserCard = () =>
    import('../Cards/Browser/BrowserCard.svelte') as unknown as Promise<typeof SvelteComponent>
  const TextCard = () =>
    import('../Cards/Text/TextCard.svelte') as unknown as Promise<typeof SvelteComponent>
  const LinkCard = () =>
    import('../Cards/Link/LinkCard.svelte') as unknown as Promise<typeof SvelteComponent>

  export let positionable: Writable<IPositionable<any>>

  const dispatch = createEventDispatcher<CardEvents>()
  const log = useLogScope('CardWrapper')

  const minSize = { x: 100, y: 100 }
  const maxSize = { x: Infinity, y: Infinity }

  let el: HTMLElement

  $: card = positionable as Writable<Card> // todo: fix this unnecessary cast
  $: cardTitle = $card.type[0].toUpperCase() + $card.type.slice(1)

  const updateCard = () => {
    log.debug('updateCard', card)
    dispatch('change', $card)
  }

  const handleDragEnd = (_: any) => {
    updateCard()
  }

  const handleDelete = () => {
    dispatch('delete', $card)
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

  <Draggable {positionable} class="">
    <div class="card-header">
      <div class="card-title">{cardTitle}</div>
      <button class="card-action" on:click={handleDelete}> ✕ </button>
    </div>
  </Draggable>

  <div class="content tela-ignore">
    {#if $card.type === 'browser'}
      <LazyComponent this={BrowserCard}>
        <svelte:fragment slot="component" let:Component>
          <Component {card} on:load on:change on:delete />
        </svelte:fragment>
      </LazyComponent>
    {:else if $card.type === 'text'}
      <LazyComponent this={TextCard}>
        <svelte:fragment slot="component" let:Component>
          <Component {card} on:load on:change on:delete />
        </svelte:fragment>
      </LazyComponent>
    {:else if $card.type === 'link'}
      <LazyComponent this={LinkCard}>
        <svelte:fragment slot="component" let:Component>
          <Component {card} on:load on:change on:delete />
        </svelte:fragment>
      </LazyComponent>
    {/if}
  </div>
</Positionable>

<style>
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: #f5f5f5;
    padding: 8px;
    border-bottom: 1px solid #ddd;
    overflow: hidden;
  }

  .card-action {
    background-color: #e0e0e0;
    border: none;
    padding: 6px 12px;
    margin-right: 8px;
    cursor: pointer;
    transition: background-color 0.3s;
    border-radius: 3px;
  }

  .card-action:disabled {
    background-color: #cccccc;
    cursor: default;
  }

  .card-action:hover:enabled {
    background-color: #d5d5d5;
  }

  .card-title {
    padding: 0 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.9rem;
  }
</style>
