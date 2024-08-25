<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
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

  const MIN_VERTICAL_SIZE = 200
  const MAX_VERTICAL_SIZE = 400
  const HORIZONTAL_SIZE = 40
  const PEEK_DELAY = 300
  const ERROR_ZONE = 20

  onMount(() => {
    ownerDocument = document
    loadSavedSize()
  })

  function loadSavedSize() {
    const savedSize = Number(
      localStorage.getItem(`panelSize-${horizontalTabs ? 'horizontal' : 'vertical'}-sidebar`)
    )
    size = horizontalTabs ? HORIZONTAL_SIZE : savedSize || MIN_VERTICAL_SIZE
    if (!horizontalTabs && (size < MIN_VERTICAL_SIZE || size > MAX_VERTICAL_SIZE)) {
      size = MIN_VERTICAL_SIZE
    }
  }

  const saveSizeToLocalStorage = debounce(() => {
    if (!horizontalTabs) {
      localStorage.setItem(`panelSize-vertical-sidebar`, size.toString())
    }
  }, 200)

  function handlePointerDown(e: PointerEvent) {
    e.preventDefault()
    isDragging = true
    startPos = horizontalTabs ? e.clientY : e.clientX
    startSize = size

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', handlePointerUp)
    ownerDocument.addEventListener('pointercancel', handlePointerUp)
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return
    const currentPos = horizontalTabs ? e.clientY : e.clientX
    const newSize = startSize + (horizontalTabs ? currentPos - startPos : currentPos - startPos)

    if (horizontalTabs) {
      isOpen = newSize > HORIZONTAL_SIZE / 2 ? State.Open : State.Closed
      size = HORIZONTAL_SIZE
    } else {
      size = Math.max(MIN_VERTICAL_SIZE, Math.min(MAX_VERTICAL_SIZE, newSize))
      saveSizeToLocalStorage()
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDragging) return
    isDragging = false
    ownerDocument.removeEventListener('pointermove', handlePointerMove)
    ownerDocument.removeEventListener('pointerup', handlePointerUp)
    ownerDocument.removeEventListener('pointercancel', handlePointerUp)
  }

  function toggleBar() {
    isOpen = isOpen === State.Open ? State.Closed : State.Open
  }

  function handleMouseEnter() {
    if (isOpen === State.Closed) {
      clearTimeout(peekTimeout!)
      isOpen = State.Peek
    }
  }

  function handleMouseLeave(event: MouseEvent) {
    if (isDragging) {
      handlePointerUp(event as unknown as PointerEvent)
    }
    if (isOpen === State.Peek) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const isWithinErrorZone =
        event.clientX >= rect.left - ERROR_ZONE &&
        event.clientX <= rect.right + ERROR_ZONE &&
        event.clientY >= rect.top - ERROR_ZONE &&
        event.clientY <= rect.bottom + ERROR_ZONE

      if (!isWithinErrorZone) {
        peekTimeout = setTimeout(() => {
          isOpen = State.Closed
        }, PEEK_DELAY)
      }
    }
  }

  $: {
    if (showLeftSidebar === true) {
      isOpen = State.Open
    } else if (showLeftSidebar === false) {
      isOpen = State.Closed
    }
  }

  $: barClasses = [
    'fixed left-0 right-0 h-full flex flex-shrink-0 bg-[rgb(251,251,250)] transition-transform ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300',
    {
      'cursor-row-resize': horizontalTabs && isDragging,
      'cursor-col-resize': !horizontalTabs && isDragging,
      'shadow-lg': isOpen === State.Peek,
      'top-0 bottom-0 flex-col space-y-2': !horizontalTabs,
      'top-0 flex-row space-x-2': horizontalTabs
    },
    isDragging
      ? horizontalTabs
        ? 'shadow-[rgba(0,0,0,0.2)_0px_-2px_0px_0px_inset]'
        : 'shadow-[rgba(0,0,0,0.2)_-2px_0px_0px_0px_inset]'
      : horizontalTabs
        ? 'shadow-[rgba(0,0,0,0.04)_0px_-2px_0px_0px_inset]'
        : 'shadow-[rgba(0,0,0,0.04)_-2px_0px_0px_0px_inset]',
    isOpen === State.Open || isOpen === State.Peek
      ? 'translate-x-0 translate-y-0'
      : horizontalTabs
        ? '-translate-y-full'
        : '-translate-x-full'
  ]
    .filter(Boolean)
    .join(' ')

  $: buttonClasses = [
    'w-6 h-6 transition-transform ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300',
    isOpen === State.Open || isOpen === State.Peek
      ? horizontalTabs
        ? 'rotate-90'
        : 'rotate-180'
      : horizontalTabs
        ? '-rotate-90'
        : 'rotate-0'
  ].join(' ')

  $: mainStyle = horizontalTabs
    ? `padding-top: ${isOpen === State.Open ? HORIZONTAL_SIZE : 0}px;`
    : `padding-left: ${isOpen === State.Open ? size : 0}px;`
  $: mainClasses = [
    'flex flex-grow max-h-screen h-full px-2',
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

<div class="flex w-screen h-screen justify-start items-start">
  <nav
    class={barClasses}
    aria-labelledby="nav-heading"
    style="{horizontalTabs ? 'height' : 'width'}: {size}px; z-index: 10000000000000;"
    on:mouseleave={handleMouseLeave}
  >
    <div class="h-full w-full overflow-auto no-scrollbar">
      <slot name="sidebar" />
    </div>
    <button
      class="absolute bg-white p-1 border-2 border-[rgba(0,0,0,0.08)] text-slate-600 no-drag cursor-pointer {horizontalTabs
        ? '-bottom-[34px] left-1/2 -translate-x-1/2'
        : '-right-[34px]'}"
      on:click={toggleBar}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class={buttonClasses}
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75"
        />
      </svg>
    </button>
    <div
      class="absolute z-10 bg-red-500 flex-grow-0 no-drag {horizontalTabs
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
  <div class={peekAreaClasses} on:mouseenter={handleMouseEnter} />
  <main style={mainStyle} class={mainClasses}>
    <div class="flex flex-col flex-grow overflow-auto">
      <slot name="content" />
    </div>
  </main>
</div>
