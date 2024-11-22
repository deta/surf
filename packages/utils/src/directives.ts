import type { Writable } from 'svelte/store'

/** Dispatch event on click outside of node */
export function clickOutside(node: HTMLElement, onEventFunction: () => void) {
  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    // Ignore clicks on elements (children of elements) with data-ignore-click-outside attribute
    if (
      target.hasAttribute('data-ignore-click-outside') ||
      target.closest('[data-ignore-click-outside]') !== null
    ) {
      return
    }

    if (node && !node.contains(target) && !event.defaultPrevented) {
      node.dispatchEvent(new CustomEvent('click_outside', { detail: node }))

      onEventFunction()
    }
  }

  document.addEventListener('click', handleClick, true)

  return {
    destroy() {
      document.removeEventListener('click', handleClick, true)
    }
  }
}

export type TooltipOptions = {
  text: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function tooltip(node: HTMLElement, opts: string | TooltipOptions) {
  const defaultOptions = {
    position: 'top'
  }

  const parsedOptions = typeof opts === 'string' ? { text: opts } : opts
  const options = Object.assign({}, defaultOptions, parsedOptions)

  node.setAttribute('data-tooltip', options.text)
  node.setAttribute('data-tooltip-position', options.position)

  return {
    update(newOpts: string | TooltipOptions) {
      const parsedOptions = typeof newOpts === 'string' ? { text: newOpts } : newOpts
      const options = Object.assign({}, defaultOptions, parsedOptions)

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
