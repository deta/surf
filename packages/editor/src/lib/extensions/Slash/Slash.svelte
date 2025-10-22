<svelte:options accessors={true} />

<script lang="ts">
  import { onMount } from 'svelte'
  import type { Editor } from '@tiptap/core'
  import { DynamicIcon } from '@deta/icons'
  import type { SlashMenuItem, SlashCommandPayload } from './types'

  export let editor: Editor
  export let items: SlashMenuItem[] = []
  export let query: string
  export let loading: boolean = false
  export let callback: (payload: SlashCommandPayload) => void
  export let onKeyDownRef: ((handler: (e: KeyboardEvent) => boolean) => void) | undefined =
    undefined

  let selectedSection = 0
  let selectedIndex = 0
  let elements: HTMLElement[] = []

  // turn flat array into array of sections: [{ section: string, items: SlashMenuItem[] }]
  $: sections = items.reduce(
    (acc, item) => {
      const lastSection = acc[acc.length - 1]
      if (lastSection && lastSection.section === item.section) {
        lastSection.items.push(item)
      } else {
        acc.push({ section: item.section ?? 'General', items: [item] })
      }
      return acc
    },
    [] as { section: string; items: SlashMenuItem[] }[]
  )

  $: selectedItem = items[selectedIndex]

  $: {
    if (elements[0] != null) {
      elements[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }

  function runCommand(item: SlashMenuItem) {
    callback({ item, query, editor })
  }

  export function onKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        selectedIndex = (selectedIndex + items.length - 1) % items.length
        return true
      case 'ArrowDown':
        e.preventDefault()
        selectedIndex = (selectedIndex + 1) % items.length
        return true
      case 'Enter':
        e.preventDefault()
        const item = items[selectedIndex]
        if (item) {
          runCommand(item)
        }
        return true
      default:
        return false
    }
  }

  onMount(() => {
    if (onKeyDownRef) {
      onKeyDownRef(onKeyDown)
    }
  })
</script>

<div class="slash-container">
  <!-- <div class="slash-header">Select element to insert:</div> -->
  <div
    class="slash-list"
    tabindex="-1"
    role="listbox"
    aria-labelledby="slash-command-menu"
    aria-activedescendant="listbox-option-0"
  >
    {#if items.length > 0}
      {#each sections as section, sectionIndex}
        <div class="slash-section">{section.section}</div>
        {#each section.items as item, i}
          {@const itemIndex =
            sections.slice(0, sectionIndex).reduce((acc, s) => acc + s.items.length, 0) + i}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="slash-item {itemIndex == selectedIndex ? 'slash-item-selected' : ''}"
            id="listbox-option-0"
            on:mouseenter={() => (selectedIndex = itemIndex)}
            on:click={() => {
              runCommand(item)
            }}
            bind:this={elements[itemIndex]}
          >
            <div class="slash-item-content">
              <div class="slash-item-icon">
                <DynamicIcon name={item.icon} size="18px" />
              </div>
              <p class="slash-item-title">{item.title}</p>
            </div>

            {#if item.tagline}
              <div class="slash-item-tagline">{item.tagline}</div>
            {/if}
            <!-- <div class="slash-item-content">
                        <p class="slash-item-subtitle">{subtitle}</p>
                    </div> -->
          </div>
        {/each}
      {/each}
    {:else if loading}
      <div class="slash-item">
        <div class="slash-item-icon">
          <DynamicIcon name="spinner" size="16px" />
        </div>
        <p class="slash-item-title">Searching your stuff…</p>
      </div>
    {:else}
      <div class="slash-item">
        <p class="slash-item-title">Nothing found</p>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .slash-container {
    --ctx-background: #fff;
    --ctx-background-muted: #f7f7f7;
    --ctx-border: rgba(0, 0, 0, 0.25);
    --ctx-shadow-color: rgba(0, 0, 0, 0.12);

    --ctx-item-hover: #2497e9;
    --ctx-item-hover-muted: #1584d4;
    --ctx-item-text: #161616;
    --ctx-item-text-hover: #fff;
    --ctx-item-text-muted: #818181;

    :global(.dark) & {
      --color-menu: #fff;
      --color-menu-muted: #949494;
      --ctx-background: #1a1a1a;
      --ctx-background-muted: #2a2a2a;
      --ctx-border: rgba(255, 255, 255, 0.25);
      --ctx-shadow-color: rgba(0, 0, 0, 0.5);

      --ctx-item-hover: #2497e9;
      --ctx-item-hover-muted: #1584d4;
      --ctx-item-text: #fff;
      --ctx-item-text-hover: #fff;
      --ctx-item-text-muted: #c2c2c2;
    }

    border: 1px solid var(--ctx-border);
    background: var(--ctx-background);
    color: var(--ctx-item-text);
    width: 22rem;
    max-width: 100%;
    max-height: 28rem;
    overflow-x: hidden;
    overflow-y: auto;
    z-index: 50;

    padding: 0.25rem;
    border-radius: 9px;
    border: 0.5px solid var(--ctx-border);
    box-shadow: 0 2px 10px var(--ctx-shadow-color);

    font-family: 'Inter', sans-serif;
  }

  .slash-list {
    overflow: hidden;
    outline: none;
  }

  .slash-section {
    color: var(--ctx-item-text-muted);
    font-size: 0.8em;
    font-weight: 420;
    letter-spacing: 0.04em;
    padding: 0.25rem 0.55rem;
    margin-top: 0.25rem;
  }

  .slash-item {
    color: var(--ctx-item-text);
    user-select: none;
    font-size: 0.9em;
    font-weight: 450;
    letter-spacing: 0.01em;

    padding: 0.4em 0.55em;
    padding-bottom: 0.385rem;
    border-radius: 6px;

    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .slash-item:hover,
  .slash-item-selected {
    background-color: var(--ctx-item-hover);
    color: var(--ctx-item-text-hover);

    .slash-item-icon {
      color: var(--ctx-item-text-hover);
    }

    .slash-item-tagline {
      color: var(--ctx-item-text-hover);
      background: var(--ctx-item-hover-muted);
    }
  }

  .slash-item-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .slash-item-tagline {
    flex-shrink: 0;
    margin-left: auto;
    padding: 0.1rem 0.25rem;
    border-radius: 5px;

    background: var(--ctx-background-muted);
    color: var(--ctx-item-text-muted);
    font-size: 0.8em;
    font-weight: 400;
    letter-spacing: 0.03em;
  }

  .slash-item-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ctx-item-text-muted);
  }

  .slash-item-title {
    font-weight: normal;
    margin: 0;

    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
