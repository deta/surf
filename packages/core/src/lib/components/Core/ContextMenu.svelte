<script lang="ts" context="module">
  /**
   * The context (right click) menu should only be used thrugh these exposed
   * methods and never instantiated manually!
   *
   * Strategy: Opening the menu requires a target element or manually specifying the items.
   *  TODO: readme
   */

  export interface CtxItemBase {
    type: 'separator' | 'action' | 'sub-menu'
  }
  export interface CtxItemSeparator extends CtxItemBase {
    type: 'separator'
  }
  export interface CtxItemAction extends CtxItemBase {
    type: 'action'
    kind?: 'danger'
    disabled?: boolean
    text: string
    icon?: string
    action: () => void
  }
  export interface CtxItemSubMenu extends CtxItemBase {
    type: 'sub-menu'
    disabled?: boolean
    text: string
    icon?: string
    items: CtxItem[]
  }

  export type CtxItem = CtxItemSeparator | CtxItemAction | CtxItemSubMenu

  declare global {
    interface HTMLElement {
      contextMenuItems?: CtxItem[]
    }
  }

  import ContextMenu from './ContextMenu.svelte'

  const contextMenuOpen = writable(false)
  export const CONTEXT_MENU_OPEN = derived(contextMenuOpen, ($contextMenuOpen) => $contextMenuOpen)

  let ctxMenuCmp: ContextMenu | null = null

  export function prepareContextMenu() {
    window.addEventListener('contextmenu', (e) => {
      // Find closest element which has contextMenuHint property set
      let target = e.target as HTMLElement | null
      while (target && !target.contextMenuItems) {
        target = target.parentElement
      }

      if (target === null) return
      e.preventDefault()

      // TODO: give target ref
      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        targetEl: target,
        items: target.contextMenuItems
      })
    })
  }

  export function openContextMenu(props: {
    x: number
    y: number
    targetEl?: HTMLElement
    items?: CtxItem[]
  }) {
    if (get(contextMenuOpen)) {
      closeContextMenu()
    }
    if (!props.targetEl && !props.items)
      throw new Error('No target element or items provided for context menu!')

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

  // TODO: (maxu): FIx typings
  // NOTE: We allow undefined for more easy items construction (ternary)
  export function contextMenu(
    node: HTMLElement,
    props: {
      canOpen?: boolean
      items: (CtxItem | undefined)[]
    }
  ): ActionReturn<any, any> {
    node.contextMenuItems = props.items.filter((item) => item !== undefined) as CtxItem[]
    if (props.canOpen === false) node.contextMenuItems = undefined
    return {
      update(props: { canOpen?: boolean; items: CtxItem[] }) {
        node.contextMenuItems = props.items
        if (props.canOpen === false) node.contextMenuItems = undefined
      },
      destroy() {
        node.contextMenuItems = undefined
      }
    }
  }
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { ActionReturn } from 'svelte/action'
  import { derived, writable, get } from 'svelte/store'
  import ContextMenuItems from './ContextMenuItems.svelte'

  export let targetX: number
  export let targetY: number
  export let targetEl: HTMLElement | null
  export let items: CtxItem[] = []

  let ref: HTMLDialogElement | null = null
  onMount(() => {
    if (targetEl) {
      targetEl.setAttribute('data-context-menu-anchor', '')
    }

    if (!ref) throw new Error('Ref is null for context menu! Cannot update position correctly!')
    const width = ref.clientWidth
    const height = ref.clientHeight

    if (targetX + width > window.innerWidth) {
      const edgeOffset = window.innerWidth - targetX
      targetX = window.innerWidth - width - edgeOffset
    }
    if (targetY + height > window.innerHeight) {
      const edgeOffset = window.innerHeight - targetY
      targetY = window.innerHeight - height - edgeOffset
    }
    ref.showModal()
  })
  onDestroy(() => {
    if (targetEl) {
      targetEl.removeAttribute('data-context-menu-anchor')
    }
  })
</script>

<dialog
  id="context-menu"
  bind:this={ref}
  style="--x: {targetX}px; --y: {targetY}px;"
  on:click={(e) => {
    closeContextMenu()
  }}
  on:contextmenu={(e) => {
    e.preventDefault()
    closeContextMenu()
  }}
  autofocus
>
  <ContextMenuItems {items} />
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
    min-width: 180px;
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

    &::backdrop {
      background-color: rgba(0, 0, 0, 0);
    }
  }
</style>
