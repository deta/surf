<!-- TableAddButtons.svelte -->
<script lang="ts">
  import { Icon } from '@deta/icons'
  import { createEventDispatcher } from 'svelte'

  export let visible: boolean = false
  export let position: 'row' | 'column' = 'row'
  export let buttonPosition: { x: number; y: number } = { x: 0, y: 0 }

  let buttonElement: HTMLDivElement
  let isHovering = false

  $: if (!visible) {
    isHovering = false
  }

  const dispatch = createEventDispatcher<{
    add: MouseEvent
    remove: MouseEvent
  }>()

  const handleAdd = (event: MouseEvent) => {
    dispatch('add', event)
  }

  const handleRemove = (event: MouseEvent) => {
    dispatch('remove', event)
  }

  function handleMouseEnter() {
    isHovering = true
  }

  function handleMouseLeave() {
    isHovering = false
  }

  // Export method to check if button is being hovered
  export function isButtonHovered() {
    return isHovering
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="table-add-button {position}"
    bind:this={buttonElement}
    style="left: {buttonPosition.x}px; top: {buttonPosition.y}px"
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
  >
    <button
      on:click|stopPropagation|preventDefault={handleAdd}
      title={position === 'row' ? 'Add row' : 'Add column'}
    >
      <Icon name="add" size="12px" style="pointer-events: none;" />
    </button>

    <button
      on:click|stopPropagation|preventDefault={handleRemove}
      title={position === 'row' ? 'Remove row' : 'Remove column'}
    >
      <Icon name="minus" size="12px" style="pointer-events: none;" />
    </button>
  </div>
{/if}

<style>
  .table-add-button {
    position: absolute;
    z-index: 20;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.25rem;
    pointer-events: all;
    /* Add padding around the button to make it easier to hover */
    padding: 8px;
    margin: -8px;
  }

  .table-add-button.row {
    transform: translateY(calc(-50% + 5px));
  }

  .table-add-button.column {
    flex-direction: column;
    transform: translate(calc(-50% + 6px), calc(-50% + 9px));
  }

  button {
    background-color: var(--color-brand);
    color: white;
    border: none;
    border-radius: 50%;
    width: 18px; /* Increased size */
    height: 18px; /* Increased size */
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s;
    padding: 0;
  }

  button:hover {
    background-color: var(--color-brand-muted);
  }
</style>
