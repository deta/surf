<script lang="ts">
  import { DynamicIcon } from '@deta/icons'
  import { Favicon } from '@deta/ui'
  import { MentionItemType, type MentionItem } from '../../types'

  let {
    items = [],
    callback,
    minimal = false,
    hideSectionTitle = false,
    hideEmpty = false,
    loading = false
  }: {
    items?: MentionItem[]
    callback: (item: MentionItem) => void
    minimal?: boolean
    hideSectionTitle?: boolean
    hideEmpty?: boolean
    loading?: boolean
  } = $props()

  let activeIdx = $state(0)
  let listContainer: HTMLDivElement
  let itemElements: HTMLDivElement[] = $state([])
  let disableMouseover = $state(false)

  const sections = $derived(
    items.reduce(
      (acc, item) => {
        const type = item.type ?? MentionItemType.OTHER
        if (!acc[type]) {
          acc[type] = []
        }

        acc[type].push(item)
        return acc
      },
      {} as Record<MentionItemType, MentionItem[]>
    )
  )

  export function onKeyDown(event: KeyboardEvent): boolean {
    const flatItems = Object.values(sections).flat()

    switch (event.key) {
      case 'ArrowUp':
        disableMouseover = true
        activeIdx = (activeIdx + flatItems.length - 1) % flatItems.length
        break
      case 'ArrowDown':
        disableMouseover = true
        activeIdx = (activeIdx + 1) % flatItems.length
        break
      case 'Enter':
        event.preventDefault()
        event.stopImmediatePropagation()
        callback(flatItems[activeIdx])
        return true
      default:
        return false
    }

    itemElements[activeIdx]?.scrollIntoView({ block: 'nearest' })
    return true
  }

  const getSectionTitle = (type: MentionItemType) => {
    switch (type) {
      case MentionItemType.BUILT_IN:
        return 'Built-In'
      case MentionItemType.MODEL:
        return 'Models'
      case MentionItemType.CONTEXT:
        return 'Contexts'
      case MentionItemType.RESOURCE:
        return 'My Stuff'
      default:
        return 'Others'
    }
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="list"
  class:minimal
  bind:this={listContainer}
  on:mousemove={() => (disableMouseover = false)}
>
  {#if items.length > 0}
    {#each Object.entries(sections) as [type, sectionItems]}
      <div class="section">
        {#if !hideSectionTitle}
          <div class="section-title">{getSectionTitle(type)}</div>
        {/if}

        {#each sectionItems as item, i (item.id)}
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions  a11y-mouse-events-have-key-events -->
          <div
            class="item"
            class:active={i +
              Object.values(sections).slice(0, Object.keys(sections).indexOf(type)).flat()
                .length ===
              activeIdx}
            on:click={() => callback(item)}
            on:mouseover={() => {
              if (disableMouseover) {
                return
              }
              activeIdx =
                i +
                Object.values(sections).slice(0, Object.keys(sections).indexOf(type)).flat().length
            }}
            bind:this={
              itemElements[
                i +
                  Object.values(sections).slice(0, Object.keys(sections).indexOf(type)).flat()
                    .length
              ]
            }
          >
            {#if item.type === MentionItemType.TAB && item.faviconURL}
              <Favicon url={item.faviconURL} title={item.label} />
            {:else if item.icon}
              <DynamicIcon name={item.icon} size="16px" />
            {/if}

            <div class="item-text">
              {item.suggestionLabel || item.label}
            </div>
          </div>
        {/each}
      </div>
    {/each}
  {:else if loading}
    <div class="item">
      <DynamicIcon name="spinner" size="16px" />
      <div class="item-text">Searching…</div>
    </div>
  {:else if !hideEmpty}
    <div class="item">Nothing found</div>
  {/if}
</div>

<style lang="scss">
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.25em;

    --ctx-background: light-dark(#fff, #1e2433);
    --ctx-border: light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.25));
    --ctx-shadow-color: light-dark(rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.5));

    --ctx-item-hover: #2497e9;
    --ctx-item-text: light-dark(#210e1f, #fff);
    --ctx-item-text-hover: #fff;

    &:not(.minimal) {
      width: 275px;
      max-height: 400px;
      background: var(--ctx-background);
      padding: 0.25em;
      border-radius: 12px;
      border: 0.5px solid var(--ctx-border);
      box-shadow: 0 2px 10px var(--ctx-shadow-color);
    }

    &.minimal .section {
      gap: 0;
    }

    user-select: none;
    font-size: 0.95em;
    overflow: auto;

    animation: scale-in 125ms cubic-bezier(0.19, 1, 0.22, 1);

    &::backdrop {
      background-color: rgba(0, 0, 0, 0);
    }
  }

  .item {
    padding: 0.25em 0.5em;
    border-radius: 9px;
    display: flex;
    align-items: center;
    gap: 0.5em;
    color: light-dark(#5b6882, #a8b3c9);
  }

  .item-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .active {
    background-color: light-dark(#e5e9ff, #2a3447);
    color: light-dark(#5b6882, #a8b3c9);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
  }

  .section-title {
    font-size: 0.9em;
    color: var(--ctx-item-text);
    padding: 0 0.5em;
  }
</style>
