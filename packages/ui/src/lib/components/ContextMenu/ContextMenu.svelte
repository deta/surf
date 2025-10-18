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
      contextMenuUseOverlay?: boolean
    }
  }

  import { isDev, wait } from '@deta/utils'
  import { copyStyles } from '@deta/utils/src/dom/copy-styles.svelte'
  import {
    type Overlay,
    type OverlayManager,
    useOverlayManager,
    useViewManager
  } from '@deta/services/views'
  import ContextMenu from './ContextMenu.svelte'

  const contextMenuOpen = writable(false)
  const contextMenuKey = writable<string | null>(null)
  export const CONTEXT_MENU_OPEN = derived(contextMenuOpen, ($contextMenuOpen) => $contextMenuOpen)
  export const CONTEXT_MENU_KEY = derived(contextMenuKey, ($contextMenuKey) => $contextMenuKey)

  let overlayManager: OverlayManager
  let setupComplete = false
  let ctxMenuCmp: ReturnType<typeof mount> | null = null
  let overlay: Overlay | null = null

  const log = useLogScope('ContextMenu')
  let styleCleanup: (() => void) | null = null

  /**
   * Call once at app startup to prepare listener.
   */
  export function prepareContextMenu(useOverlay = false) {
    if (setupComplete) return
    if (useOverlay) overlayManager = useOverlayManager()

    const prevent = (e: Event) => !isDev && e.preventDefault()
    const cbk = async (e: Event) => {
      let target = e.target as HTMLElement | null

      // Find closest element which has contextMenuHint property set
      while (target && !target.contextMenuItems) {
        target = target.parentElement
      }

      if (target === null) return prevent(e)
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
        key: target.contextMenuKey,
        useOverlay: useOverlay
      })
    }

    window.addEventListener('contextmenu', cbk, { capture: true })
    setupComplete = true
    return () => window.removeEventListener('contextmenu', cbk, { capture: true })
  }

  /**
   * Open a context menu at the specified position.
   * You must either specify a target element or items directly!
   */
  export async function openContextMenu(props: {
    useOverlay?: boolean
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

    if (props.useOverlay) {
      overlay = await overlayManager.create({
        bounds: {
          x: props.x - 12,
          y: props.y - 12,
          width: 300,
          height: 600
        }
      })

      // Copy styles including color-scheme to overlay window
      if (overlay?.window) {
        styleCleanup = copyStyles(overlay.window)
      }
    }

    // await wait(50)

    ctxMenuCmp = mount(ContextMenu, {
      target: props.useOverlay ? (overlay.wrapperElement ?? document.body) : document.body,
      props: {
        targetX: props.x,
        targetY: props.y,
        targetEl: props.targetEl ?? null,
        items: props.items,
        overlay: props.useOverlay ? overlay : null
      }
    })

    document.body.setAttribute('data-context-menu', 'true')
  }
  export function closeContextMenu() {
    if (ctxMenuCmp) unmount(ctxMenuCmp)

    contextMenuOpen.set(false)
    contextMenuKey.set(null)

    if (styleCleanup) {
      styleCleanup()
      styleCleanup = null
    }

    if (overlay) {
      overlayManager.destroy(overlay.id)
      overlay = null
    }

    document.body.removeAttribute('data-context-menu')
  }

  // TODO: (maxu): FIx typings
  // TODO: (maxu): Add support for lazy evaluation of canOpen with reference to target element?
  // NOTE: We allow undefined for more easy items construction (ternary)
  export function contextMenu(props: CtxMenuProps): Attachment {
    return (node: HTMLElement) => {
      node.contextMenuKey = props?.key ?? null
      if (Array.isArray(props.items)) {
        node.contextMenuItems = props.items.filter((item, i) => item !== undefined)
      } else {
        node.contextMenuItems = props.items
      }

      if (props.canOpen === false) {
        node.contextMenuItems = undefined
        node.contextMenuKey = undefined
      }

      return () => {
        node.contextMenuItems = undefined
        node.contextMenuKey = undefined
      }
    }
  }
  /** @deprecated DONT USE
   */
  export function contextMenuSvelte4(
    node: HTMLElement,
    props: CtxMenuProps
  ): ActionReturn<any, any> {
    node.contextMenuKey = props?.key
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
  import { mount, onDestroy, onMount, tick, unmount } from 'svelte'
  import type { ActionReturn } from 'svelte/action'
  import { derived, writable, get } from 'svelte/store'
  import ContextMenuItems from './ContextMenuItems.svelte'
  import { useLogScope } from '@deta/utils/io'
  import { clickOutside } from '@deta/utils'

  import './style.scss'
  import { type Attachment } from 'svelte/attachments'

  export let targetX: number
  export let targetY: number
  export let targetEl: HTMLElement | null
  export let items: CtxItem[] = []
  export let overlay: Overlay | null = null

  const viewManager = useViewManager()

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

    log.debug('Context menu opened at', targetX, targetY, overlay, ref)

    if (ref) {
      const bounds = ref.getBoundingClientRect()
      log.debug('Context menu bounds:', bounds)

      // @ts-ignore
      // window.api.updateViewBounds({
      //   x: targetX,
      //   y: targetY,
      //   width: bounds.width,
      //   height: bounds.height
      // })

      // viewManager.updateViewBounds(overlayId, {
      //   x: targetX,
      //   y: targetY,
      //   width: bounds.width,
      //   height: bounds.height
      // })

      // overlay?.saveBounds({
      //   width: Math.round(bounds.width + 20),
      //   height: Math.round(bounds.height + 20)
      // })

      // overlay?.focus()
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

<svelte:window
  on:contextmenu={(e) => {
    closeContextMenu()
  }}
  on:keydown={(e) => {
    // TODO: FIX: Need to focus overlay automatically to make this work with WCVs
    if (e.key === 'Escape') {
      closeContextMenu()
    }
  }}
/>

<dialog
  bind:this={ref}
  id="context-menu"
  class:overlay={overlay !== null}
  style="--x: {targetX}px; --y: {targetY}px;"
  autofocus
  on:click={(_) => {
    closeContextMenu()
  }}
  {@attach clickOutside(() => closeContextMenu())}
>
  <ContextMenuItems {items} />
</dialog>
