import type { SvelteComponent, ComponentType } from 'svelte'
import Popover from './Popover.svelte'

type PopoverOptions = {
  content:
    | {
        component: ComponentType
        props: Record<string, any>
        on?: Record<string, Function>
      }
    | string
  action?: 'click' | 'hover' | 'focus'
  position?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right'
    | 'left-top'
    | 'left-center'
    | 'left-bottom'
    | 'right-top'
    | 'right-center'
    | 'right-bottom'
    | 'auto'
  animation?: 'fade' | 'fly' | 'none'
  delay?: number
  style?: Record<string, string>
}

function forwardEvent(node: HTMLElement, popoverComponent: SvelteComponent, eventName: string) {
  popoverComponent.$on(eventName, (event) => {
    const customEvent = new CustomEvent(eventName, {
      detail: event.detail,
      bubbles: true
    })
    node.dispatchEvent(customEvent)
  })
}

export function popover(node: HTMLElement, options: PopoverOptions) {
  let popoverComponent: SvelteComponent
  let timeout: NodeJS.Timeout | null = null
  let popoverEl: HTMLElement

  const {
    content,
    action = 'click',
    position = 'bottom-center',
    animation = 'fade',
    delay = 400,
    style = {}
  } = options

  const openPopover = () => {
    if (timeout) clearTimeout(timeout)
    if (popoverComponent) (popoverComponent as any).openPopover()
  }

  const closePopover = () => {
    if (timeout) clearTimeout(timeout)
    if (popoverComponent) (popoverComponent as any).closePopover()
  }

  const handleMouseEnter = () => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      openPopover()
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      if (popoverEl && !popoverEl.matches(':hover') && !node.matches(':hover')) {
        closePopover()
      }
    }, delay)
  }

  if (typeof content === 'string') {
    popoverComponent = new Popover({
      target: document.body,
      props: {
        targetEl: node,
        content,
        position,
        animate: animation !== 'none',
        style
      }
    })
  } else {
    popoverComponent = new Popover({
      target: document.body,
      props: {
        targetEl: node,
        content: content.component,
        contentProps: content.props,
        position,
        animate: animation !== 'none',
        style,
        ...content.on
      }
    })
  }

  // Wait for the component to be mounted to get the popover element
  popoverComponent.$on('mount', () => {
    popoverEl = (popoverComponent as any).$$.ctx[0]
    popoverEl.addEventListener('mouseenter', handleMouseEnter)
    popoverEl.addEventListener('mouseleave', handleMouseLeave)
  })

  const eventsToForward = [
    'popoverOpen',
    'popoverClose',
    'create-tab-from-space',
    'save-resource-in-space',
    'create-new-space'
  ]
  eventsToForward.forEach((eventName) => {
    forwardEvent(node, popoverComponent, eventName)
  })

  const shouldKeepPopoverOpen = (target: HTMLElement): boolean => {
    return target.closest('[data-keep-open]') !== null
  }

  if (action === 'hover') {
    node.addEventListener('mouseenter', handleMouseEnter)
    node.addEventListener('mouseleave', handleMouseLeave)
  } else if (action === 'click') {
    node.addEventListener('click', openPopover)
    document.addEventListener(
      'click',
      (event) => {
        const target = event.target as HTMLElement
        if (
          !node.contains(target) &&
          !(popoverComponent as any).$$.ctx[0].contains(target) &&
          !shouldKeepPopoverOpen(target)
        ) {
          closePopover()
        }
      },
      true
    )
  } else if (action === 'focus') {
    node.addEventListener('focus', handleMouseEnter)
    node.addEventListener('blur', handleMouseLeave)
  }

  return {
    destroy() {
      if (popoverComponent) {
        popoverComponent.$destroy()
      }
      if (timeout) clearTimeout(timeout)
      node.removeEventListener('mouseenter', handleMouseEnter)
      node.removeEventListener('mouseleave', handleMouseLeave)
      if (popoverEl) {
        popoverEl.removeEventListener('mouseenter', handleMouseEnter)
        popoverEl.removeEventListener('mouseleave', handleMouseLeave)
      }
    }
  }
}
