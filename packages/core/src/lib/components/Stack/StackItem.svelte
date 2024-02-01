<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let showOverview: boolean
  export let order: number
  export let active = false

  const dispatch = createEventDispatcher<{ select: number }>()

  const handleClick = (e: MouseEvent) => {
    if (!showOverview) return
    console.log('click')

    e.preventDefault()
    dispatch('select', order)
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
<div
  on:click={handleClick}
  class="item"
  class:overview={showOverview}
  class:active={active}
  style="--order: {order + 1}; --index: {order};"
>
  <div class="content">
    <slot />
  </div>
</div>

<style lang="scss">
  .item {
    flex-shrink: 0;
    height: var(--height);
    transition-property: border-radius, border;
    transition-duration: var(--transition-duration);
    transition-timing-function: var(--transition-timing-function);
    order: var(--order);

    width: 100%;
    overflow: hidden;

    box-sizing: border-box;
    border: 0px solid transparent;
    border-radius: 0;
  }

  .content {
    height: 100%;
    width: 100%;
    position: relative;
    pointer-events: none;
  }

  .active {
    .content {
      pointer-events: unset;
    }
  }

  .overview {
    &.item {
      border-width: 4px;
      border-color: var(--border-color);
      border-radius: calc(var(--theme-border-radius) * 2);
      cursor: pointer;
    }

    // &.highlight {
    //     border-color: #f26daa;
    // }

    .content {
      pointer-events: none;
    }
  }
</style>
