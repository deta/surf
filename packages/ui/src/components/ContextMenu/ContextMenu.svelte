<script lang="ts" context="module">
  /**
   * The context (right click) menu should only be used thrugh these exposed
   * methods and never instantiated manually!
   *
   * Strategy: Opening the menu requires a target element or manually specifying the items.
   * When a target is specified, it will traverse it / its parents to find the contextMenuItems property.
   *  -> When found, it will open the menu with these items.
   *  -> When not found, it will not open the menu and return.
   */

  export interface CtxItemBase {
    type: 'separator' | 'action' | 'sub-menu'
    hidden?: boolean
  }
  export interface CtxItemSeparator extends CtxItemBase {
    type: 'separator'
  }
  export interface CtxItemAction extends CtxItemBase {
    type: 'action'
    kind?: 'danger'
    disabled?: boolean
    text: string
    tagText?: string
    tagIcon?: string
    icon?: string | [string, string] | any // TODO @BetaHuhn: rework the space icons to be independent of the OasisSpace class
    action: () => void
  }
  export interface CtxItemSubMenu extends CtxItemBase {
    type: 'sub-menu'
    kind?: 'danger'
    disabled?: boolean
    search?: boolean
    text: string
    icon?: string | [string, string] | any // TODO @BetaHuhn: rework the space icons to be independent of the OasisSpace class
    items: CtxItem[]
  }

  export type CtxItem = CtxItemSeparator | CtxItemAction | CtxItemSubMenu

  export type CtxMenuProps = {
    key?: string
    canOpen?: boolean
    items: CtxItem[] | (() => Promise<CtxItem[]>)
  }

  declare global {
    interface HTMLElement {
      contextMenuItems?: CtxItem[] | (() => Promise<CtxItem[]>)
      contextMenuKey?: string
    }
  }

  import ContextMenu from './ContextMenu.svelte'

  const contextMenuOpen = writable(false)
  const contextMenuKey = writable<string | null>(null)
  export const CONTEXT_MENU_OPEN = derived(contextMenuOpen, ($contextMenuOpen) => $contextMenuOpen)
  export const CONTEXT_MENU_KEY = derived(contextMenuKey, ($contextMenuKey) => $contextMenuKey)

  let ctxMenuCmp: ContextMenu | null = null
  let setupComplete = false

  /**
   * Call once at app startup to prepare listener.
   */
  export function prepareContextMenu() {
    if (setupComplete) return
    window.addEventListener(
      'contextmenu',
      async (e) => {
        let target = e.target as HTMLElement | null
        // for browesr-action-list for extensions
        if (target?.tagName.toLowerCase() === 'browser-action-list') {
          return
        }

        // Find closest element which has contextMenuHint property set
        while (target && !target.contextMenuItems) {
          target = target.parentElement
        }

        if (target === null) return
        e.preventDefault()
        e.stopImmediatePropagation()

        let items: CtxItem[]
        if (Array.isArray(target.contextMenuItems)) {
          items = target.contextMenuItems
        } else {
          items = await target.contextMenuItems!()
        }

        // TODO: give target ref
        openContextMenu({
          x: e.clientX,
          y: e.clientY,
          targetEl: target,
          items,
          key: target.contextMenuKey
        })
      },
      { capture: true }
    )
    setupComplete = true
  }

  /**
   * Open a context menu at the specified position.
   * You must either specify a target element or items directly!
   */
  export function openContextMenu(props: {
    x: number
    y: number
    targetEl?: HTMLElement
    items?: CtxItem[]
    key?: string
  }) {
    if (get(contextMenuOpen)) {
      closeContextMenu()
    }
    if (!props.targetEl && !props.items)
      log.error('No target element or items provided for context menu!')

    contextMenuOpen.set(true)
    contextMenuKey.set(props.key ?? null)
    ctxMenuCmp = new ContextMenu({
      target: document.body,
      props: {
        targetX: props.x,
        targetY: props.y,
        targetEl: props.targetEl ?? null,
        items: props.items
      }
    })
    document.body.setAttribute('data-context-menu', 'true')
  }
  export function closeContextMenu() {
    ctxMenuCmp?.$destroy()
    contextMenuOpen.set(false)
    contextMenuKey.set(null)
    document.body.removeAttribute('data-context-menu')
  }

  // TODO: (maxu): FIx typings
  // TODO: (maxu): Add support for lazy evaluation of canOpen with reference to target element?
  // NOTE: We allow undefined for more easy items construction (ternary)
  export function contextMenu(node: HTMLElement, props: CtxMenuProps): ActionReturn<any, any> {
    node.contextMenuKey = props.key
    if (Array.isArray(props.items)) {
      node.contextMenuItems = props.items.filter((item, i) => item !== undefined)
    } else {
      node.contextMenuItems = props.items
    }

    if (props.canOpen === false) {
      node.contextMenuItems = undefined
      node.contextMenuKey = undefined
    }
    return {
      update(props: { canOpen?: boolean; items: CtxItem[] }) {
        node.contextMenuItems = props.items
        if (props.canOpen === false) {
          node.contextMenuItems = undefined
          node.contextMenuKey = undefined
        }
      },
      destroy() {
        node.contextMenuItems = undefined
        node.contextMenuKey = undefined
      }
    }
  }
</script>

<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte'
  import type { ActionReturn } from 'svelte/action'
  import { derived, writable, get } from 'svelte/store'
  import ContextMenuItems from './ContextMenuItems.svelte'
  import { useLogScope } from '@deta/utils'
  // import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'
  // import { useTabsViewManager } from '@horizon/core/src/lib/service/tabs'

  export let targetX: number
  export let targetY: number
  export let targetEl: HTMLElement | null
  export let items: CtxItem[] = []

  const log = useLogScope('ContextMenu')

  // const viewManager = useTabsViewManager()

  let ref: HTMLDialogElement | null = null
  onMount(async () => {
    if (targetEl) {
      targetEl.setAttribute('data-context-menu-anchor', '')
    }

    if (!ref) {
      log.error(
        'Ref is null for context menu! Cannot update position correctly / show context menu!'
      )
      return
    }

    ref.showModal()

    await tick()
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

    // check if the context menu would overlap with the active webcontents view
    // and if so notify the view manager that the right click menu is open
    // const activeWebview = document.querySelector(
    //   '.browser-window.active .webcontentsview-container'
    // )
    // if (activeWebview) {
    //   const rect = activeWebview.getBoundingClientRect()
    //   if (
    //     targetX < rect.right &&
    //     targetX + width > rect.left &&
    //     targetY < rect.bottom &&
    //     targetY + height > rect.top
    //   ) {
    //     viewManager.changeOverlayState({
    //       rightClickMenuOpen: true
    //     })
    //   }
    // }
  })
  onDestroy(() => {
    if (ref) {
      ref.close()
    }
    if (targetEl) {
      targetEl.removeAttribute('data-context-menu-anchor')
    }

    // viewManager.changeOverlayState({
    //   rightClickMenuOpen: false
    // })
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
    closeContextMenu()
  }}
  on:keydown={(e) => {
    if (e.key === 'Escape') {
      closeContextMenu()
    }
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
    --ctx-background: #fff;
    --ctx-border: rgba(0, 0, 0, 0.25);
    --ctx-shadow-color: rgba(0, 0, 0, 0.12);

    --ctx-item-hover: #2497e9;
    --ctx-item-danger-hover: #ff4d4f;
    --ctx-item-submenu-open: rgba(0, 0, 0, 0.065);
    --ctx-item-text: #210e1f;
    --ctx-item-text-hover: #fff;

    isolation: isolate;
    position: fixed;
    top: var(--y);
    left: var(--x);
    z-index: 2147483647; /* max value lol */
    min-width: 180px;
    height: fit-content;
    background: var(--ctx-background);
    padding: 0.25rem;
    border-radius: 9px;
    border: 0.5px solid var(--ctx-border);
    box-shadow: 0 2px 10px var(--ctx-shadow-color);
    user-select: none;
    font-size: 0.9em;
    transform-origin: top left;

    animation: scale-in 125ms cubic-bezier(0.19, 1, 0.22, 1);

    &::backdrop {
      background-color: rgba(0, 0, 0, 0);
    }
  }

  :global(body.dark) #context-menu {
    --ctx-background: #111b2b;
    --ctx-border: rgba(255, 255, 255, 0.25);

    --ctx-item-text: #fff;
    --ctx-item-submenu-open: rgba(255, 255, 255, 0.075);
    --ctx-shadow-color: rgba(125, 125, 125, 0.25);
  }

  :global(body[data-context-menu='true'] *) {
    -webkit-app-region: no-drag !important;
  }
</style>
