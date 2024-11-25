<script lang="ts">
  import { useDebounce } from '@horizon/utils'
  import { onMount, createEventDispatcher, onDestroy } from 'svelte'

  export let horizontalTabs = false
  export let showLeftSidebar = true
  export let showRightSidebar = true
  export let enablePeeking = true

  const dispatch = createEventDispatcher()

  const State = {
    Open: 'open',
    Closed: 'closed',
    Peek: 'peek'
  } as const

  type SidebarState = (typeof State)[keyof typeof State]

  const MIN_VERTICAL_SIZE = 250
  const MAX_VERTICAL_SIZE = 400
  const MIN_VERTICAL_RIGHT_SIZE = 380
  const MAX_VERTICAL_RIGHT_SIZE = 600
  const HORIZONTAL_SIZE = 42
  const TRANSITION_DURATION = 300
  const BUFFER = 50
  const CLOSE_THRESHOLD = 75

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
  let peekBg: string = ''

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
    if (rightSize < MIN_VERTICAL_RIGHT_SIZE || rightSize > MAX_VERTICAL_RIGHT_SIZE) {
      rightSize = MIN_VERTICAL_RIGHT_SIZE
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
      if (newSize < MIN_VERTICAL_RIGHT_SIZE - CLOSE_THRESHOLD) {
        rightIsOpen = State.Closed
        showRightSidebar = false
        rightSize = MIN_VERTICAL_RIGHT_SIZE
        dispatch('rightPeekClose')
      } else {
        rightSize = Math.max(MIN_VERTICAL_RIGHT_SIZE, Math.min(MAX_VERTICAL_RIGHT_SIZE, newSize))
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
      peekBg = 'bg-blue-300/75 dark:bg-gray-900/75 backdrop-blur-sm'
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

        // wait for the transition to finish, then change peekbg to transparent
        // peekTimeout = setTimeout(() => {
        //   peekBg = ''
        // }, 300)
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
      peekBg = ''
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
    'fixed left-0 right-0 h-full flex flex-shrink-0',
    peekBg,
    isDraggingLeft
      ? 'transition-none'
      : 'transition-all ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-200',
    {
      'cursor-row-resize': horizontalTabs && isDraggingLeft,
      'cursor-col-resize': !horizontalTabs && isDraggingLeft,
      'shadow-lg': leftIsOpen === State.Peek,
      'top-0 bottom-0 flex-col space-y-2': !horizontalTabs,
      'top-0 flex-row space-x-2': horizontalTabs
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
    `fixed right-0 flex flex-shrink-0 rounded-xl bg-sky-50 dark:bg-gray-900 text-gray-900 dark:text-gray-10 bottom-0 flex-col space-y-2`,
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
    showRightSidebar ? 'mr-2' : '',
    'flex flex-grow max-h-screen h-full',
    isDraggingLeft || isDraggingRight ? 'pointer-events-none' : '',
    isDraggingLeft || isDraggingRight
      ? 'transition-none'
      : 'transition-all ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300'
  ].join(' ')

  $: leftPeakAreaClasses = [
    'fixed no-drag',
    leftIsOpen === State.Closed ? 'block' : 'hidden',
    horizontalTabs ? 'top-0 left-0 right-0 h-4' : 'top-0 left-0 w-4 h-full'
  ].join(' ')

  $: rightPeakAreaClasses = [
    'fixed no-drag w-4',
    rightIsOpen === State.Closed ? 'block' : 'hidden',
    'right-0 w-4 h-full'
  ].join(' ')

  $: rightSidebarStyle = `
    width: ${rightIsOpen === State.Closed ? '16px' : rightSize + 'px'};
    ${
      horizontalTabs && (leftIsOpen === State.Open || leftIsOpen === State.Peek)
        ? `top: ${HORIZONTAL_SIZE}px;`
        : 'top: 0;'
    }
  `

  onMount(() => {
    document
      .querySelectorAll('iframe[tabindex="-1"][src="about:blank"]')
      .forEach((iframe) => iframe.remove())

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

<div
  class="flex w-screen h-screen justify-start items-start"
  style:--left-sidebar-size={leftSize + 'px'}
  style:--right-sidebar-size={rightSize + 'px'}
>
  <nav
    class={leftBarClasses}
    class:horizontalTabs
    class:verticalTabs={!horizontalTabs}
    aria-labelledby="nav-heading"
    style="{horizontalTabs ? 'height' : 'width'}: {leftSize}px; z-index: 502;"
  >
    <div class="h-full w-full">
      <slot name="sidebar" />
    </div>
    {#if !horizontalTabs}
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
    {/if}
  </nav>
  <!-- svelte-ignore a11y-no-static-element-interactions -->

  {#if enablePeeking}
    <div
      class="left-peeking-area {leftPeakAreaClasses}"
      on:mouseenter={() => handleMouseEnter('left')}
      style="z-index: 550;"
    />
  {/if}
  <main style={mainStyle} class={mainClasses}>
    <slot name="content" />
  </main>

  <div
    class="sidebar-right {rightBarClasses}"
    aria-labelledby="nav-heading"
    style="z-index: 490; {rightSidebarStyle}"
  >
    <div
      class="absolute z-10 hover:bg-purple-500/50 transition-all duration-300 flex-grow-0 no-drag left-0 top-0 bottom-0 w-1 cursor-col-resize"
    >
      <div
        on:pointerdown={(e) => handlePointerDown(e, 'right')}
        class="w-3 h-full cursor-col-resize shrink-0"
      />
    </div>
    <!-- NOTE: This margin-top is weird, i dunno why it exists, but we have to kill it here -->

    {#if showRightSidebar}
      <div class="h-full w-full" style="margin-top: 0;">
        <slot name="right-sidebar" />
      </div>
    {/if}
  </div>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!--<div
    class={rightPeakAreaClasses}
    on:mouseenter={() => handleMouseEnter('right')}
    style={rightSidebarStyle}
  />-->
</div>
