import { WEBVIEW_MOUSE_CLICK_WINDOW_EVENT, type Fn } from '@deta/types'
import type { Attachment } from 'svelte/attachments'
import type { Writable } from 'svelte/store'
import { hasClassOrParentWithClass } from './css'

export function clickOutside(callback: Fn): Attachment {
  return (element: Element) => {
    const handleClick = (e: MouseEvent) => {
      if (hasClassOrParentWithClass(e.target as HTMLElement, 'ignore-click-outside')) return
      // NOTE: This check prevents spacebar from triggering this.. i rly hate webdev
      // https://stackoverflow.com/questions/20849022/space-and-enter-click-on-the-input-thats-focused-how-do-i-disable-this-behav
      if (e.detail === 0) return
      if (!element?.contains(e.target as HTMLElement)) callback()
    }

    window.addEventListener('click', handleClick, { capture: true })
    window.addEventListener(WEBVIEW_MOUSE_CLICK_WINDOW_EVENT, callback, { capture: true })

    return () => {
      window.removeEventListener('click', handleClick, { capture: true })
      window.removeEventListener(WEBVIEW_MOUSE_CLICK_WINDOW_EVENT, () => callback(), {
        capture: true
      })
    }
  }
}

/** Dispatch event on click outside of node */
//export function clickOutside(node: HTMLElement, onEventFunction: () => void) {
//  const handleClick = (event: MouseEvent) => {
//    const target = event.target as HTMLElement
//    // Ignore clicks on elements (children of elements) with data-ignore-click-outside attribute
//    if (
//      target.hasAttribute('data-ignore-click-outside') ||
//      target.closest('[data-ignore-click-outside]') !== null
//    ) {
//      return
//    }
//
//    if (node && !node.contains(target) && !event.defaultPrevented) {
//      node.dispatchEvent(new CustomEvent('click_outside', { detail: node }))
//
//      onEventFunction()
//    }
//  }
//
//  document.addEventListener('click', handleClick, true)
//
//  return {
//    destroy() {
//      document.removeEventListener('click', handleClick, true)
//    }
//  }
//}

export type TooltipOptions = {
  text: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  disabled?: boolean
}

export function tooltip(node: HTMLElement, opts: string | TooltipOptions) {
  const defaultOptions = {
    position: 'top',
    disabled: false
  }

  const parsedOptions = typeof opts === 'string' ? { text: opts } : opts
  const options = Object.assign({}, defaultOptions, parsedOptions)

  if (!options.disabled) {
    node.setAttribute('data-tooltip', options.text)
    node.setAttribute('data-tooltip-position', options.position)
  }

  return {
    update(newOpts: string | TooltipOptions) {
      const parsedOptions = typeof newOpts === 'string' ? { text: newOpts } : newOpts
      const options = Object.assign({}, defaultOptions, parsedOptions)

      if (options.disabled) {
        return
      }

      node.setAttribute('data-tooltip', options.text)
      node.setAttribute('data-tooltip-position', options.position)
    },
    destroy() {
      node.removeAttribute('data-tooltip')
      node.removeAttribute('data-tooltip-position')
    }
  }
}

// take in a store and update it on hover
export function hover(node: HTMLElement, store: Writable<boolean>) {
  const handleMouseover = () => {
    store.set(true)
  }

  const handleMouseout = () => {
    store.set(false)
  }

  node.addEventListener('mouseenter', handleMouseover)
  node.addEventListener('mouseleave', handleMouseout)

  return {
    destroy() {
      node.removeEventListener('mouseenter', handleMouseover)
      node.removeEventListener('mouseleave', handleMouseout)
    }
  }
}

export function focus(node: HTMLElement, store: Writable<boolean>) {
  const handleFocus = () => {
    store.set(true)
  }

  const handleBlur = () => {
    store.set(false)
  }

  node.addEventListener('focus', handleFocus)
  node.addEventListener('blur', handleBlur)

  return {
    destroy() {
      node.removeEventListener('focus', handleFocus)
      node.removeEventListener('blur', handleBlur)
    }
  }
}

/**
 * Scroll horizontally no matter how the user scrolls (e.g. shift/no shift)
 * @param node
 * @returns
 */
export function horizontalScroll(node: HTMLElement) {
  function handleScroll(event: WheelEvent) {
    if (event.shiftKey) {
      node.scrollLeft += event.deltaX
    } else {
      node.scrollLeft += event.deltaY
    }
  }

  node.addEventListener('wheel', handleScroll, { passive: true })

  return {
    destroy() {
      node.removeEventListener('wheel', handleScroll)
    }
  }
}
