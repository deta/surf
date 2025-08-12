<script lang="ts">
  import { Icon } from '@deta/icons'

  export let url: string
  export let label: string | undefined = undefined
  export let color: string = '#281B53'
  export let locked: boolean = true
  export let hideArrow: boolean = false

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer?.setData('text/html', url)
  }
</script>

<div class="link">
  <a
    href={url}
    target="_blank"
    class="from"
    style="color: {color}; text-decoration: none;"
    on:dragstart={handleDragStart}
    on:click
    {...$$restProps}
  >
    <slot>
      {label}
    </slot>
  </a>

  {#if !hideArrow}
    <div class="arrow" class:locked>
      <Icon name="arrow" {color} />
    </div>
  {/if}
</div>

<style lang="scss">
  .link {
    display: flex;
    align-items: center;
    gap: 4px;
    &:hover {
      .arrow {
        transform: translateX(0);
        opacity: 0.65;
      }
    }
    .arrow {
      position: relative;
      top: 2px;
      transform: translateX(-20%);
      opacity: 0;
      transition: all 120ms ease-out;
      &.locked {
        transform: translateX(0);
        opacity: 0.65;
      }
    }
    .from {
      font-weight: 500;
      line-height: 1.25rem;
      text-decoration: none;
      color: #281b53;
    }
  }
</style>
