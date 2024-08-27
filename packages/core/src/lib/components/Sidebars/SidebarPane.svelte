<script lang="ts">
  import { useDebounce } from '@horizon/utils'
  import { onMount, createEventDispatcher, onDestroy } from 'svelte'

  export let horizontalTabs = false
  export let showLeftSidebar = true
  export let showRightSidebar = true

  const dispatch = createEventDispatcher()

  const State = {
    Open: 'open',
    Closed: 'closed',
    Peek: 'peek'
  } as const

  type SidebarState = (typeof State)[keyof typeof State]

  const MIN_VERTICAL_SIZE = 200
  const MAX_VERTICAL_SIZE = 400
  const MAX_VERTICAL_RIGHT_SIZE = 600
  const HORIZONTAL_SIZE = 40
  const TRANSITION_DURATION = 300
  const BUFFER = 50
  const CLOSE_THRESHOLD = 10

  let leftSize: number
  let rightSize: number
  let leftIsOpen: SidebarState = State.Open
  let rightIsOpen: SidebarState = State.Open
  let isDraggingLeft = false
  let isDraggingRight = false
  let startPos: number
  let startSize: number
  let ownerDocument: Document
  let peekTimeout: ReturnType<typeof setTimeout> | null = null
  let transitionEndTimeout: ReturnType<typeof setTimeout> | null = null
  let leftIsTransitioning = false
  let rightIsTransitioning = false
  let previousOrientation: boolean
  let isDraggingTab = false
  let mouseX: number = 0
  let mouseY: number = 0

  const saveSizeToLocalStorage = useDebounce((side: 'left' | 'right', size: number) => {
    const key =
      side === 'left'
        ? `panelSize-${horizontalTabs ? 'horizontal' : 'vertical'}-sidebar`
        : 'panelSize-right-sidebar'
    localStorage.setItem(key, size.toString())
  }, 100)

  function startTransition(side: 'left' | 'right') {}

  function loadSavedSizes() {
    const savedVerticalSize =
      Number(localStorage.getItem('panelSize-vertical-sidebar')) || MIN_VERTICAL_SIZE
    const savedHorizontalSize =
      Number(localStorage.getItem('panelSize-horizontal-sidebar')) || HORIZONTAL_SIZE
    rightSize = Number(localStorage.getItem('panelSize-right-sidebar')) || MIN_VERTICAL_SIZE
    leftSize = horizontalTabs ? savedHorizontalSize : savedVerticalSize
    if (!horizontalTabs && (leftSize < MIN_VERTICAL_SIZE || leftSize > MAX_VERTICAL_SIZE)) {
      leftSize = MIN_VERTICAL_SIZE
    }
    if (rightSize < MIN_VERTICAL_SIZE || rightSize > MAX_VERTICAL_RIGHT_SIZE) {
      rightSize = MIN_VERTICAL_SIZE
    }
  }

  function handlePointerDown(e: PointerEvent, side: 'left' | 'right') {
    e.preventDefault()
    if (side === 'left') {
      isDraggingLeft = true
    } else {
      isDraggingRight = true
    }
    startPos = horizontalTabs && side === 'left' ? e.clientY : e.clientX
    startSize = side === 'left' ? leftSize : rightSize
    ownerDocument.addEventListener('pointermove', handleGlobalPointerMove)
    ownerDocument.addEventListener('pointerup', handleGlobalPointerUp)
  }
  function handleGlobalPointerMove(e: PointerEvent) {
    if (isDraggingLeft) {
      if (horizontalTabs) {
        const newSize = startSize - (e.clientY - startPos)
        if (newSize < CLOSE_THRESHOLD) {
          leftIsOpen = State.Closed
          leftSize = HORIZONTAL_SIZE
          dispatch('leftPeekClose')
        } else {
          leftSize = HORIZONTAL_SIZE
        }
      } else {
        const newSize = startSize + (e.clientX - startPos)
        if (newSize < MIN_VERTICAL_SIZE - CLOSE_THRESHOLD) {
          leftIsOpen = State.Closed
          leftSize = MIN_VERTICAL_SIZE
          dispatch('leftPeekClose')
        } else {
          leftSize = Math.max(MIN_VERTICAL_SIZE, Math.min(MAX_VERTICAL_SIZE, newSize))
        }
      }
      saveSizeToLocalStorage('left', leftSize)
    } else if (isDraggingRight) {
      const newSize = startSize - (e.clientX - startPos)
      if (newSize < MIN_VERTICAL_SIZE - CLOSE_THRESHOLD) {
        rightIsOpen = State.Closed
        rightSize = MIN_VERTICAL_SIZE
        dispatch('rightPeekClose')
      } else {
        rightSize = Math.max(MIN_VERTICAL_SIZE, Math.min(MAX_VERTICAL_RIGHT_SIZE, newSize))
      }
      saveSizeToLocalStorage('right', rightSize)
    }
  }

  function handleGlobalPointerUp() {
    isDraggingLeft = false
    isDraggingRight = false
    ownerDocument.removeEventListener('pointermove', handleGlobalPointerMove)
    ownerDocument.removeEventListener('pointerup', handleGlobalPointerUp)

    if (!horizontalTabs && leftIsOpen !== State.Closed && leftSize < MIN_VERTICAL_SIZE) {
      leftIsOpen = State.Closed
      leftSize = MIN_VERTICAL_SIZE
      dispatch('leftPeekClose')
    }
    if (rightIsOpen !== State.Closed && rightSize < MIN_VERTICAL_SIZE) {
      rightIsOpen = State.Closed
      rightSize = MIN_VERTICAL_SIZE
      dispatch('rightPeekClose')
    }
  }

  function handleMouseEnter(side: 'left' | 'right') {
    if (side === 'left' && leftIsOpen === State.Closed) {
      leftIsOpen = State.Peek
      dispatch('leftPeekOpen')
    } else if (side === 'right' && rightIsOpen === State.Closed) {
      rightIsOpen = State.Peek
      dispatch('rightPeekOpen')
    }
  }

  $: {
    if (leftIsOpen === State.Peek) {
      if (horizontalTabs && mouseY > HORIZONTAL_SIZE + BUFFER) {
        leftIsOpen = State.Closed
        dispatch('leftPeekClose')
      } else if (!horizontalTabs && mouseX > leftSize + BUFFER && !isDraggingLeft) {
        leftIsOpen = State.Closed
        dispatch('leftPeekClose')
      }
    }
    if (
      rightIsOpen === State.Peek &&
      mouseX < window.innerWidth - rightSize - BUFFER &&
      !isDraggingRight
    ) {
      rightIsOpen = State.Closed
      dispatch('rightPeekClose')
    }
  }

  $: {
    if (showLeftSidebar === true) {
      leftIsOpen = State.Open
      startTransition('left')
    } else if (showLeftSidebar === false) {
      leftIsOpen = State.Closed
      startTransition('left')
    }
  }

  $: {
    if (showRightSidebar === true) {
      rightIsOpen = State.Open
      startTransition('right')
    } else if (showRightSidebar === false) {
      rightIsOpen = State.Closed
      startTransition('right')
    }
  }

  $: {
    if (previousOrientation !== horizontalTabs) {
      loadSavedSizes()
      previousOrientation = horizontalTabs
    }
  }

  $: leftBarClasses = [
    'fixed left-0 right-0 h-full flex flex-shrink-0 rounded-xl bg-blue-100',
    isDraggingLeft
      ? 'transition-none'
      : 'transition-all ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300',
    {
      'cursor-row-resize': horizontalTabs && isDraggingLeft,
      'cursor-col-resize': !horizontalTabs && isDraggingLeft,
      'shadow-lg': leftIsOpen === State.Peek,
      'top-0 bottom-0 flex-col space-y-2': !horizontalTabs,
      'top-0 flex-row space-x-2': horizontalTabs,
      'bg-[rgb(251,251,250)]':
        leftIsOpen === State.Peek || leftIsOpen === State.Open || leftIsTransitioning
    },
    leftIsOpen === State.Open || leftIsOpen === State.Peek
      ? 'translate-x-0 translate-y-0'
      : horizontalTabs
        ? '-translate-y-full'
        : '-translate-x-full'
  ]
    .filter(Boolean)
    .join(' ')

  $: rightBarClasses = [
    `fixed right-0 flex flex-shrink-0 rounded-xl bg-blue-100 bottom-0 flex-col space-y-2`,
    isDraggingRight
      ? 'transition-none'
      : 'transition-all ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300',
    {
      'cursor-col-resize': isDraggingRight,
      'shadow-lg': rightIsOpen === State.Peek,
      'bg-[rgb(251,251,250)]':
        rightIsOpen === State.Peek || rightIsOpen === State.Open || rightIsTransitioning
    },
    rightIsOpen === State.Open || rightIsOpen === State.Peek ? 'translate-x-0' : 'translate-x-full'
  ]
    .filter(Boolean)
    .join(' ')

  $: mainStyle = `
    ${horizontalTabs ? `padding-top: ${leftIsOpen === State.Open ? HORIZONTAL_SIZE : 0}px;` : ''}
    ${!horizontalTabs ? `padding-left: ${leftIsOpen === State.Open ? leftSize : 0}px;` : ''}
    padding-right: ${rightIsOpen === State.Open ? rightSize : 0}px;
  `
  $: mainClasses = [
    'flex flex-grow max-h-screen h-full px-2',
    isDraggingLeft || isDraggingRight ? 'pointer-events-none' : '',
    isDraggingLeft || isDraggingRight
      ? 'transition-none'
      : 'transition-all ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300'
  ].join(' ')

  $: leftPeakAreaClasses = [
    'fixed z-50 no-drag',
    leftIsOpen === State.Closed ? 'block' : 'hidden',
    horizontalTabs ? 'top-0 left-0 right-0 h-4' : 'top-0 left-0 w-4 h-full'
  ].join(' ')

  $: rightPeakAreaClasses = [
    'fixed z-50 no-drag w-4',
    rightIsOpen === State.Closed ? 'block' : 'hidden',
    'right-0 w-4 h-full'
  ].join(' ')

  $: rightSidebarStyle = `
    width: ${rightIsOpen === State.Closed ? '16px' : rightSize + 'px'};
    z-index: 10000000000000;
    ${
      horizontalTabs && (leftIsOpen === State.Open || leftIsOpen === State.Peek)
        ? `top: ${HORIZONTAL_SIZE}px;`
        : 'top: 0;'
    }
  `

  onMount(() => {
    ownerDocument = document
    loadSavedSizes()
    previousOrientation = horizontalTabs
    ownerDocument.addEventListener('pointermove', handleGlobalPointerMove)
    ownerDocument.addEventListener('pointerup', handleGlobalPointerUp)
  })

  onDestroy(() => {
    ownerDocument?.removeEventListener('pointermove', handleGlobalPointerMove)
    ownerDocument?.removeEventListener('pointerup', handleGlobalPointerUp)
  })
</script>

<svelte:window
  on:mousemove={(e) => {
    if (isDraggingTab) return
    mouseX = e.clientX
    mouseY = e.clientY
  }}
  on:DragStart={(drag) => {
    isDraggingTab = true
  }}
  on:DragEnd={(drag) => {
    isDraggingTab = false
  }}
/>

<div class="flex w-screen h-screen justify-start items-start">
  <nav
    class={leftBarClasses}
    aria-labelledby="nav-heading"
    style="{horizontalTabs ? 'height' : 'width'}: {leftSize}px; z-index: 10000000000000;"
  >
    <div class="h-full w-full">
      <slot name="sidebar" />
    </div>
    <div
      class="absolute z-10 hover:bg-purple-500/50 transition-all duration-300 flex-grow-0 no-drag {horizontalTabs
        ? 'bottom-0 left-0 right-0 h-1 cursor-row-resize'
        : 'right-0 top-0 bottom-0 w-1 cursor-col-resize'}"
    >
      <div
        on:pointerdown={(e) => handlePointerDown(e, 'left')}
        class="{horizontalTabs ? 'h-3 w-full' : 'w-3 h-full'} cursor-{horizontalTabs
          ? 'row'
          : 'col'}-resize shrink-0"
      />
    </div>
  </nav>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class={leftPeakAreaClasses} on:mouseenter={() => handleMouseEnter('left')} />
  <main style={mainStyle} class={mainClasses}>
    <slot name="content" />
  </main>

  <div class={rightBarClasses} aria-labelledby="nav-heading" style={rightSidebarStyle}>
    <div
      class="absolute z-10 hover:bg-purple-500/50 transition-all duration-300 flex-grow-0 no-drag left-0 top-0 bottom-0 w-1 cursor-col-resize"
    >
      <div
        on:pointerdown={(e) => handlePointerDown(e, 'right')}
        class="w-3 h-full cursor-col-resize shrink-0"
      />
    </div>
    <div class="h-full w-full">
      <slot name="right-sidebar" />
    </div>
  </div>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class={rightPeakAreaClasses}
    on:mouseenter={() => handleMouseEnter('right')}
    style={rightSidebarStyle}
  />
</div>
