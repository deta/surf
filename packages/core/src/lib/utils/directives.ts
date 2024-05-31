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
