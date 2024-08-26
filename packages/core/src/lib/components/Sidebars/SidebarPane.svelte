<script lang="ts">
  import { onMount, createEventDispatcher, onDestroy } from 'svelte'
  import { debounce } from 'lodash'

  export let horizontalTabs = false
  export let showLeftSidebar = true

  const dispatch = createEventDispatcher()

  const State = {
    Open: 'open',
    Closed: 'closed',
    Peek: 'peek'
  } as const

  type SidebarState = (typeof State)[keyof typeof State]

  let size: number
  let isOpen: SidebarState = State.Open
  let isDragging = false
  let startPos: number
  let startSize: number
  let ownerDocument: Document
  let peekTimeout: ReturnType<typeof setTimeout> | null = null
  let transitionEndTimeout: ReturnType<typeof setTimeout> | null = null
  let isTransitioning = false
  let previousOrientation: boolean

  const MIN_VERTICAL_SIZE = 200
  const MAX_VERTICAL_SIZE = 400
  const HORIZONTAL_SIZE = 40
  const PEEK_DELAY = 300
  const ERROR_ZONE = 40
  const TRANSITION_DURATION = 300

  onMount(() => {
    ownerDocument = document
    loadSavedSize()
    previousOrientation = horizontalTabs
    ownerDocument.addEventListener('pointermove', handleGlobalPointerMove)
    ownerDocument.addEventListener('pointerup', handleGlobalPointerUp)
  })

  onDestroy(() => {
    ownerDocument?.removeEventListener('pointermove', handleGlobalPointerMove)
    ownerDocument?.removeEventListener('pointerup', handleGlobalPointerUp)
  })

  function loadSavedSize() {
    const savedVerticalSize =
      Number(localStorage.getItem('panelSize-vertical-sidebar')) || MIN_VERTICAL_SIZE
    const savedHorizontalSize =
      Number(localStorage.getItem('panelSize-horizontal-sidebar')) || HORIZONTAL_SIZE
    size = horizontalTabs ? savedHorizontalSize : savedVerticalSize
    if (!horizontalTabs && (size < MIN_VERTICAL_SIZE || size > MAX_VERTICAL_SIZE)) {
      size = MIN_VERTICAL_SIZE
    }
  }

  const saveSizeToLocalStorage = debounce(() => {
    const key = `panelSize-${horizontalTabs ? 'horizontal' : 'vertical'}-sidebar`
    localStorage.setItem(key, size.toString())
  }, 200)

  function handlePointerDown(e: PointerEvent) {
    e.preventDefault()
    isDragging = true
    startPos = horizontalTabs ? e.clientY : e.clientX
    startSize = size
  }

  function handleGlobalPointerMove(e: PointerEvent) {
    if (!isDragging) return
    const currentPos = horizontalTabs ? e.clientY : e.clientX
    const newSize = startSize + (horizontalTabs ? startPos - currentPos : currentPos - startPos)

    if (horizontalTabs) {
      isOpen = newSize > HORIZONTAL_SIZE / 2 ? State.Open : State.Closed
      size = HORIZONTAL_SIZE
    } else {
      size = Math.max(MIN_VERTICAL_SIZE, Math.min(MAX_VERTICAL_SIZE, newSize))
      saveSizeToLocalStorage()
    }
  }

  function handleGlobalPointerUp() {
    isDragging = false
  }

  function toggleBar() {
    isOpen = isOpen === State.Open ? State.Closed : State.Open
    startTransition()
  }

  function handleMouseEnter() {
    if (isOpen === State.Closed) {
      clearTimeout(peekTimeout!)
      isOpen = State.Peek
      startTransition()
      dispatch('peekOpen')
    }
  }

  // Add these new variables
  let mouseX: number = 0
  let mouseY: number = 0
  const BUFFER = 50 // Buffer zone in pixels

  // Add this reactive statement to handle sidebar closing based on mouse position
  $: {
    if (isOpen === State.Peek) {
      if (horizontalTabs && mouseY > HORIZONTAL_SIZE + BUFFER) {
        isOpen = State.Closed
        dispatch('peekClose')
      } else if (!horizontalTabs && mouseX > size + BUFFER) {
        isOpen = State.Closed
        dispatch('peekClose')
      }
    }
  }

  function startTransition() {
    isTransitioning = true
    clearTimeout(transitionEndTimeout!)
    transitionEndTimeout = setTimeout(() => {
      isTransitioning = false
    }, TRANSITION_DURATION)
  }

  $: {
    if (showLeftSidebar === true) {
      isOpen = State.Open
      startTransition()
    } else if (showLeftSidebar === false) {
      isOpen = State.Closed
      startTransition()
    }
  }

  $: {
    if (previousOrientation !== horizontalTabs) {
      loadSavedSize()
      previousOrientation = horizontalTabs
    }
  }

  $: barClasses = [
    'fixed left-0 right-0 h-full flex flex-shrink-0 rounded-xl bg-blue-100',
    isDragging
      ? 'transition-none'
      : 'transition-all ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300',
    {
      'cursor-row-resize': horizontalTabs && isDragging,
      'cursor-col-resize': !horizontalTabs && isDragging,
      'shadow-lg': isOpen === State.Peek,
      'top-0 bottom-0 flex-col space-y-2': !horizontalTabs,
      'top-0 flex-row space-x-2': horizontalTabs,
      'bg-[rgb(251,251,250)]': isOpen === State.Peek || isOpen === State.Open || isTransitioning
    },
    isOpen === State.Open || isOpen === State.Peek
      ? 'translate-x-0 translate-y-0'
      : horizontalTabs
        ? '-translate-y-full'
        : '-translate-x-full'
  ]
    .filter(Boolean)
    .join(' ')

  $: mainStyle = horizontalTabs
    ? `padding-top: ${isOpen === State.Open ? HORIZONTAL_SIZE : 0}px;`
    : `padding-left: ${isOpen === State.Open ? size : 0}px;`
  $: mainClasses = [
    'flex flex-grow max-h-screen h-full px-2',
    isDragging ? 'pointer-events-none' : '',
    isDragging
      ? 'transition-none'
      : 'transition-all ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300'
  ].join(' ')

  $: peekAreaClasses = [
    'fixed z-50 no-drag',
    isOpen === State.Closed ? 'block' : 'hidden',
    horizontalTabs ? 'top-0 left-0 right-0 h-4' : 'top-0 left-0 w-4 h-full'
  ].join(' ')
</script>

<svelte:window
  on:mousemove={(e) => {
    mouseX = e.clientX
    mouseY = e.clientY
  }}
/>

<div class="flex w-screen h-screen justify-start items-start">
  <nav
    class={barClasses}
    aria-labelledby="nav-heading"
    style="{horizontalTabs ? 'height' : 'width'}: {size}px; z-index: 10000000000000;"
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
        on:pointerdown={handlePointerDown}
        class="{horizontalTabs ? 'h-3 w-full' : 'w-3 h-full'} cursor-{horizontalTabs
          ? 'row'
          : 'col'}-resize shrink-0"
      />
    </div>
  </nav>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class={peekAreaClasses} on:mouseenter={handleMouseEnter} />
  <main style={mainStyle} class={mainClasses}>
    <div class="flex flex-col flex-grow overflow-auto">
      <slot name="content" />
    </div>
  </main>
</div>
