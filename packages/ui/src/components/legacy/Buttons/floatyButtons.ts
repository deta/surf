import { spring, type Spring } from 'svelte/motion'
import { tick } from 'svelte'
import type { ComponentType, SvelteComponent } from 'svelte'

interface ButtonConfig {
  offsetX: number
  offsetY: number
  component: ComponentType
  props?: Record<string, any>
  className?: string
  style?: Partial<CSSStyleDeclaration>
}

interface FloatyButton {
  instance: SvelteComponent | null
  element: HTMLElement
  coords: Spring<{
    x: number
    y: number
    scale: number
  }>
  config: ButtonConfig
}

interface FloatyButtonsConfig {
  buttons: ButtonConfig[]
  springConfig?: {
    stiffness?: number
    damping?: number
  }
  origin: string
  containerClass?: string
  buttonClass?: string
  trigger?: 'hover' | 'click'
}

interface FloatyButtonsEvents {
  onExpand?: () => void
  onCollapse?: () => void
  onButtonClick?: (index: number) => void
}

const DEFAULT_SPRING_CONFIG = {
  stiffness: 0.15,
  damping: 0.8
}

// Safe area configuration
const SAFE_AREA = {
  width: 110,
  height: 80
}

// Track instances to ensure unique IDs
let instanceCounter = 0

export function floatyButtons(
  node: HTMLElement,
  {
    buttons = [],
    springConfig = DEFAULT_SPRING_CONFIG,
    origin = '',
    containerClass = '',
    buttonClass = '',
    trigger = 'hover',
    ...events
  }: FloatyButtonsConfig & FloatyButtonsEvents
) {
  const instanceId = `floaty-${instanceCounter++}`
  let floatyButtons: FloatyButton[] = []
  let isExpanded = false
  let hitArea: HTMLElement | null = null
  let safeArea: HTMLElement | null = null
  let triggerButton: HTMLElement | null = null

  function initializeTriggerButton() {
    triggerButton = node.querySelector('button')
  }

  function getTriggerButtonRect() {
    if (!triggerButton) return { x: 0, y: 0, width: 0, height: 0 }
    const rect = triggerButton.getBoundingClientRect()
    const nodeRect = node.getBoundingClientRect()
    return {
      x: rect.left - nodeRect.left,
      y: rect.top - nodeRect.top,
      width: rect.width,
      height: rect.height
    }
  }

  function calculateHitAreaBounds() {
    const triggerRect = getTriggerButtonRect()

    let minX = triggerRect.x
    let maxX = triggerRect.x + triggerRect.width
    let minY = triggerRect.y
    let maxY = triggerRect.y + triggerRect.height

    buttons.forEach((config) => {
      minX = Math.min(minX, triggerRect.x + triggerRect.width / 2 + config.offsetX - 50)
      maxX = Math.max(maxX, triggerRect.x + triggerRect.width / 2 + config.offsetX + 50)
      minY = Math.min(minY, triggerRect.y + triggerRect.height / 2 + config.offsetY - 50)
      maxY = Math.max(maxY, triggerRect.y + triggerRect.height / 2 + config.offsetY + 50)
    })

    const padding = 20
    return {
      left: minX - padding,
      right: maxX + padding,
      top: minY - padding,
      bottom: maxY + padding
    }
  }

  function createSafeArea() {
    if (safeArea) {
      safeArea.remove()
    }

    safeArea = document.createElement('div')
    safeArea.id = `${instanceId}-safe-area`
    Object.assign(safeArea.style, {
      position: 'fixed',
      left: '0',
      bottom: '0',
      width: `${SAFE_AREA.width}px`,
      height: `${SAFE_AREA.height}px`,
      pointerEvents: 'none',
      zIndex: '100000'
    })

    document.body.appendChild(safeArea)
  }

  function createHitArea() {
    if (hitArea) {
      hitArea.remove()
    }

    const bounds = calculateHitAreaBounds()

    hitArea = document.createElement('div')
    hitArea.id = `${instanceId}-hit-area`
    Object.assign(hitArea.style, {
      position: 'absolute',
      left: `${bounds.left}px`,
      top: `${bounds.top}px`,
      width: `${bounds.right - bounds.left}px`,
      height: `${bounds.bottom - bounds.top}px`,
      pointerEvents: isExpanded ? 'auto' : 'none',
      zIndex: '100',
      clipPath:
        origin === 'sidebar'
          ? `polygon(
        0 0,
        100% 0,
        100% 100%,
        ${SAFE_AREA.width}px 100%,
        ${SAFE_AREA.width}px ${bounds.bottom - bounds.top - SAFE_AREA.height}px,
        0 ${bounds.bottom - bounds.top - SAFE_AREA.height}px
      )`
          : undefined
    })

    node.appendChild(hitArea)
  }

  async function setupButtons() {
    initializeTriggerButton()

    floatyButtons.forEach((btn) => {
      if (btn.instance) {
        btn.instance.$destroy()
      }
      btn.element.remove()
    })
    floatyButtons = []

    await tick()

    const triggerRect = getTriggerButtonRect()

    buttons.forEach((config, index) => {
      const wrapper = document.createElement('div')
      wrapper.id = `${instanceId}-button-${index}`

      Object.assign(wrapper.style, {
        position: 'absolute',
        left: `${triggerRect.x}px`,
        top: `${triggerRect.y}px`,
        width: `${triggerRect.width}px`,
        height: `${triggerRect.height}px`,
        transformOrigin: '50% 50%',
        opacity: '0',
        zIndex: '1000'
      })

      const coords = spring(
        { x: 0, y: 0, scale: 0 },
        {
          stiffness: springConfig.stiffness || DEFAULT_SPRING_CONFIG.stiffness,
          damping: springConfig.damping || DEFAULT_SPRING_CONFIG.damping
        }
      )

      coords.subscribe(({ x, y, scale }) => {
        wrapper.style.opacity = scale.toString()
        const translateX = x - triggerRect.width / 2
        const translateY = y - triggerRect.height / 2
        wrapper.style.transform = `
          translate(${translateX}px, ${translateY}px)
          scale(${scale})
        `
      })

      node.appendChild(wrapper)
      floatyButtons.push({
        instance: null,
        element: wrapper,
        coords,
        config
      })
    })

    if (origin === 'sidebar') {
      createSafeArea()
    }

    createHitArea()
  }

  function mountButton(button: FloatyButton, index: number) {
    if (!button.instance) {
      button.instance = new button.config.component({
        target: button.element,
        props: {
          ...(button.config.props || {}),
          index,
          onClick: () => {
            if (button.config.props?.onClick) {
              button.config.props.onClick()
            }
            if (events.onButtonClick) {
              events.onButtonClick(index)
            }
            if (trigger === 'click') {
              toggleButtons(false)
            }
          }
        }
      })
    }
  }

  function unmountButton(button: FloatyButton) {
    if (button.instance) {
      button.instance.$destroy()
      button.instance = null
    }
  }

  let timeoutRef: NodeJS.Timeout | null = null

  function toggleButtons(expand?: boolean) {
    isExpanded = expand ?? !isExpanded

    if (hitArea) {
      hitArea.style.pointerEvents = isExpanded ? 'auto' : 'none'
    }

    const triggerRect = getTriggerButtonRect()

    floatyButtons.forEach((button, index) => {
      if (isExpanded) {
        if (timeoutRef !== null) {
          clearTimeout(timeoutRef)
          timeoutRef = null
        }
        mountButton(button, index)
        button.coords.set({
          x: triggerRect.width / 2 + button.config.offsetX,
          y: triggerRect.height / 2 + button.config.offsetY,
          scale: 1
        })
        events.onExpand?.()
      } else {
        button.coords.set({
          x: triggerRect.width / 2,
          y: triggerRect.height / 2,
          scale: 0
        })
        if (timeoutRef === null) {
          timeoutRef = setTimeout(() => {
            floatyButtons.forEach((b) => unmountButton(b))
            timeoutRef = null
          }, 300)
        }
        events.onCollapse?.()
      }
    })
  }

  if (trigger === 'hover') {
    const handleMouseEnter = () => toggleButtons(true)
    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.relatedTarget as Node
      if (node.contains(target)) return
      toggleButtons(false)
    }

    node.addEventListener('mouseenter', handleMouseEnter)
    node.addEventListener('mouseleave', handleMouseLeave)
    ;(node as any)._mouseEnterHandler = handleMouseEnter
    ;(node as any)._mouseLeaveHandler = handleMouseLeave
  } else {
    const handleClick = (e: MouseEvent) => {
      e.stopPropagation()
      toggleButtons()
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (!node.contains(e.target as Node)) {
        toggleButtons(false)
      }
    }

    node.addEventListener('click', handleClick)
    document.addEventListener('click', handleClickOutside)
    ;(node as any)._clickHandler = handleClick
    ;(node as any)._clickOutsideHandler = handleClickOutside
  }

  node.style.position = 'relative'
  if (containerClass) {
    node.classList.add(containerClass)
  }
  setupButtons()

  return {
    update(newConfig: FloatyButtonsConfig & FloatyButtonsEvents) {
      if (trigger === 'hover') {
        node.removeEventListener('mouseenter', (node as any)._mouseEnterHandler)
        node.removeEventListener('mouseleave', (node as any)._mouseLeaveHandler)
      } else {
        node.removeEventListener('click', (node as any)._clickHandler)
        document.removeEventListener('click', (node as any)._clickOutsideHandler)
      }

      Object.assign(buttons, newConfig.buttons)
      Object.assign(springConfig, newConfig.springConfig || {})
      Object.assign(events, newConfig)
      trigger = newConfig.trigger || 'hover'

      setupButtons()
    },
    destroy() {
      floatyButtons.forEach((btn) => {
        btn.instance?.$destroy()
        btn.element.remove()
      })

      if (hitArea) {
        hitArea.remove()
      }

      if (safeArea) {
        safeArea.remove()
      }

      if (trigger === 'hover') {
        node.removeEventListener('mouseenter', (node as any)._mouseEnterHandler)
        node.removeEventListener('mouseleave', (node as any)._mouseLeaveHandler)
      } else {
        node.removeEventListener('click', (node as any)._clickHandler)
        document.removeEventListener('click', (node as any)._clickOutsideHandler)
      }
    }
  }
}
