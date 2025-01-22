<script lang="ts">
  import { DynamicIcon } from '@horizon/icons'
  import type { MentionItem } from '../../types'

  export let items: MentionItem[] = []
  export let callback: (item: MentionItem) => void

  let activeIdx = 0
  let listContainer: HTMLDivElement
  let itemElements: HTMLDivElement[] = []
  let disableMouseover = false

  export function onKeyDown(event: KeyboardEvent): boolean {
    if (event.repeat) {
      return false
    }

    switch (event.key) {
      case 'ArrowUp':
        disableMouseover = true
        activeIdx = (activeIdx + items.length - 1) % items.length
        break
      case 'ArrowDown':
        disableMouseover = true
        activeIdx = (activeIdx + 1) % items.length
        break
      case 'Enter':
        event.preventDefault()
        event.stopImmediatePropagation()
        callback(items[activeIdx])
        return true
      default:
        return false
    }

    itemElements[activeIdx]?.scrollIntoView({ block: 'nearest' })
    return true
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="list" bind:this={listContainer} on:mousemove={() => (disableMouseover = false)}>
  {#if items.length > 0}
    {#each items as item, i (item.id)}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions  a11y-mouse-events-have-key-events -->
      <div
        class="item"
        class:active={i === activeIdx}
        on:click={() => callback(items[i])}
        on:mouseover={() => {
          if (disableMouseover) {
            return
          }
          activeIdx = i
        }}
        bind:this={itemElements[i]}
      >
        {#if item.icon}
          <DynamicIcon name={item.icon} size="16px" />
        {/if}

        <div>
          {item.suggestionLabel || item.label}
        </div>
      </div>
    {/each}
  {:else}
    <div class="item">Nothing found</div>
  {/if}
</div>

<style lang="scss">
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    --ctx-background: #fff;
    --ctx-border: rgba(0, 0, 0, 0.25);
    --ctx-shadow-color: rgba(0, 0, 0, 0.12);

    --ctx-item-hover: #2497e9;
    --ctx-item-text: #210e1f;
    --ctx-item-text-hover: #fff;

    min-width: 180px;
    max-height: 400px;
    background: var(--ctx-background);
    padding: 0.25rem;
    border-radius: 9px;
    border: 0.5px solid var(--ctx-border);
    box-shadow: 0 2px 10px var(--ctx-shadow-color);
    user-select: none;
    font-size: 0.95em;
    overflow: auto;

    animation: scale-in 125ms cubic-bezier(0.19, 1, 0.22, 1);

    &::backdrop {
      background-color: rgba(0, 0, 0, 0);
    }
  }

  .item {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--ctx-item-text);
  }

  .active {
    background-color: var(--ctx-item-hover);
    color: var(--ctx-item-text-hover);
  }
</style>
