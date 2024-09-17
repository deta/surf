<script lang="ts" context="module">
  import ContextMenu from './ContextMenu.svelte'

  const contextMenuOpen = writable(false)
  export const CONTEXT_MENU_OPEN = derived(contextMenuOpen, ($contextMenuOpen) => $contextMenuOpen)

  let ctxMenuCmp: ContextMenu | null = null

  export function prepareContextMenu() {
    window.addEventListener('contextmenu', (e) => {
      // Find closest element which has contextMenuHint property set
      let target = e.target as HTMLElement
      while (target && !target.contextmenu) {
        target = target.parentElement
      }

      if (target === null) return
      e.preventDefault()

      // TODO: give target ref
      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        targetEl: target,
        items: target.contextmenu
      })
    })
  }

  export function openContextMenu(props: {
    x: number
    y: number
    targetEl?: HTMLElement
    items: CtxItem[]
  }) {
    if (get(contextMenuOpen)) {
      closeContextMenu()
    }
    contextMenuOpen.set(true)
    ctxMenuCmp = new ContextMenu({
      target: document.body,
      props: {
        targetX: props.x,
        targetY: props.y,
        targetEl: props.targetEl ?? null,
        items: props.items
      }
    })
  }
  export function closeContextMenu() {
    ctxMenuCmp?.$destroy()
    contextMenuOpen.set(false)
  }

  export interface CtxItemBase {
    type: 'separator' | 'action' | 'sub-menu'
  }
  export interface CtxItemSeparator extends CtxItemBase {
    type: 'separator'
  }
  export interface CtxItemAction extends CtxItemBase {
    type: 'action'
    kind?: 'danger'
    text: string
    icon?: string
    action: () => void
  }
  export type CtxItem = CtxItemSeparator | CtxItemAction

  export function contextMenu(
    node: HTMLElement,
    props: {
      items: CtxItem[]
    }
  ): ActionReturn {
    node.contextmenu = props.items
    return {
      update() {},
      destroy() {}
    }
  }
</script>

<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { onDestroy, onMount } from 'svelte'
  import type { ActionReturn } from 'svelte/action'
  import { derived, writable, get } from 'svelte/store'

  export let targetX: number
  export let targetY: number
  export let targetEl: HTMLElement | null
  export let items: CtxItem[] = []

  let ref: HTMLElement | null = null
  onMount(() => {
    // if anchro el ref -> add data-contrext-anchor to it / remove it on destory
    if (targetEl) {
      targetEl.setAttribute('data-context-menu-anchor', '')
    }

    if (!ref) throw new Error('Ref is null for context menu! Cannot update position correctly!')
    const width = ref.clientWidth
    const height = ref.clientHeight

    // MOve targetX / Y if it + with / height exceedes viewport
    if (targetX + width > window.innerWidth) {
      const edgeOffset = window.innerWidth - targetX
      targetX = window.innerWidth - width - edgeOffset
    }
    if (targetY + height > window.innerHeight) {
      const edgeOffset = window.innerHeight - targetY
      targetY = window.innerHeight - height - edgeOffset
    }
  })
  onDestroy(() => {
    if (targetEl) {
      targetEl.removeAttribute('data-context-menu-anchor')
    }
  })
</script>

<svelte:window
  on:click={(e) => {
    if (!ref) return
    closeContextMenu()
  }}
  on:keydown|capture={(e) => {
    if (e.key === 'Escape') {
      closeContextMenu()
    }
  }}
/>

<dialog id="context-menu" bind:this={ref} style="--x: {targetX}px; --y: {targetY}px;" open>
  <ul>
    {#each items as item}
      {#if item.type === 'separator'}
        <hr />
      {:else if item.type === 'action'}
        <li
          on:click|capture={() => {
            closeContextMenu()
            item.action()
          }}
          class:danger={item.kind === 'danger'}
        >
          {#if item.icon}
            <Icon name={item.icon} size="1.2em" />
          {/if}
          {item.text}
        </li>
      {/if}
    {/each}
    <!--<li>
      <Icon name="copy" size="1.2em" />
      Copy Link
    </li>
    <li>
      <Icon name="search" size="1.2em" />

      Share
    </li>
    <li>
      <Icon name="grid" size="1.2em" />

      Create Group
    </li>
    <hr />
    <li class="danger">
      <Icon name="trash" size="1.2em" />

      Archive
    </li>-->
  </ul>
</dialog>

<style lang="scss">
  @keyframes scale-in {
    0% {
      transform: scale(0.5);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  #context-menu {
    isolation: isolate;
    position: fixed;
    top: var(--y);
    left: var(--x);
    z-index: 2147483647; /* max value lol */
    width: 180px;
    height: fit-content;
    background: #fff;
    padding: 0.25rem;
    border-radius: 9px;
    border: 0.5px solid rgba(0, 0, 0, 0.25);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
    user-select: none;
    font-size: 0.95em;
    transform-origin: top left;

    animation: scale-in 125ms cubic-bezier(0.19, 1, 0.22, 1);

    &:focus {
      border-color: red !important;
    }

    ul {
      width: auto;
      display: flex;
      flex-direction: column;

      > li {
        display: flex;
        align-items: center;
        gap: 0.35em;
        padding: 0.4em 0.55em;
        padding-bottom: 0.385rem;
        border-radius: 6px;
        font-weight: 500;
        line-height: 1;
        letter-spacing: 0.0125rem;
        font-size: 0.99em;
        color: #210e1f;
        font-family: system-ui;
        -webkit-font-smoothing: antialiased;
        cursor: pointer;

        --highlight-color: #2497e9;

        &:hover {
          background: var(--highlight-color);
          color: #fff;
        }

        & * {
          pointer-events: none;
        }

        &.danger {
          --highlight-color: #ff4d4f;
        }
      }

      hr {
        margin-inline: 1.2ch;
        margin-block: 0.25rem;
        border-top: 0.07rem solid rgba(0, 0, 0, 0.15);
      }
    }
  }
</style>
