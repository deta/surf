<script lang="ts">
  import clsx from 'clsx'
  import { clamp } from 'lodash'
  import { onMount } from 'svelte'

  const Open = {
    Open: 'open',
    Closed: 'closed',
    Peek: 'peek'
  } as const

  type Open = (typeof Open)[keyof typeof Open]

  export let horizontalTabs = false

  let selected: string | null = null
  let size = horizontalTabs ? 100 : 250
  let originalSize = size
  let originalClientPos = size
  let isDragging = false
  let isOpen: Open = Open.Closed
  let ownerDocument: Document

  onMount(() => {
    ownerDocument = document
  })

  function handlePointerDown(e: PointerEvent) {
    e.preventDefault()
    originalSize = size
    originalClientPos = horizontalTabs ? e.clientY : e.clientX
    isDragging = true

    function onPointerMove(e: PointerEvent) {
      const currentPos = horizontalTabs ? e.clientY : e.clientX
      if (currentPos < (horizontalTabs ? 25 : 50)) isOpen = Open.Closed
      size = Math.floor(
        clamp(
          originalSize +
            (horizontalTabs ? currentPos - originalClientPos : currentPos - originalClientPos),
          horizontalTabs ? 50 : 200,
          horizontalTabs ? 200 : 400
        )
      )
    }

    function onPointerUp() {
      ownerDocument.removeEventListener('pointermove', onPointerMove)
      isDragging = false
    }

    ownerDocument.addEventListener('pointermove', onPointerMove)
    ownerDocument.addEventListener('pointerup', onPointerUp, {
      once: true
    })
  }

  function toggleBar() {
    isOpen = isOpen === Open.Closed ? Open.Open : Open.Closed
  }

  function handleMouseEnter() {
    if (isOpen === Open.Closed) {
      isOpen = Open.Peek
    }
  }

  function handleMouseLeave() {
    if (isOpen === Open.Peek) {
      isOpen = Open.Closed
    }
  }

  $: console.error('isOpen', isOpen)

  $: barClasses = clsx(
    'fixed left-0 right-0 flex flex-shrink-0 bg-[rgb(251,251,250)] transition-transform ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300',
    {
      'cursor-row-resize': horizontalTabs && isDragging,
      'cursor-col-resize': !horizontalTabs && isDragging,
      'shadow-lg': isOpen === Open.Peek,
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
    isOpen === Open.Open || isOpen === Open.Peek
      ? 'translate-x-0 translate-y-0'
      : horizontalTabs
        ? '-translate-y-full'
        : '-translate-x-full'
  )

  $: buttonClasses = clsx(
    'w-6 h-6 transition-transform ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300',
    isOpen === Open.Open || isOpen === Open.Peek
      ? horizontalTabs
        ? 'rotate-90'
        : 'rotate-180'
      : horizontalTabs
        ? '-rotate-90'
        : 'rotate-0'
  )

  $: mainStyle = horizontalTabs
    ? `padding-top: ${isOpen === Open.Open ? size : 0}px;`
    : `padding-left: ${isOpen === Open.Open ? size : 0}px;`
  $: mainClasses = clsx(
    'flex flex-grow max-h-screen h-full px-2',
    isDragging
      ? 'transition-none'
      : 'transition-all ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300'
  )

  $: peekAreaClasses = clsx(
    'fixed z-50 no-drag',
    isOpen === Open.Closed ? 'block' : 'hidden',
    horizontalTabs ? 'top-0 left-0 right-0 h-4' : 'top-0 left-0 w-4 h-full'
  )
</script>

<div class="flex w-screen h-screen justify-start items-start">
  <nav
    class={barClasses}
    aria-labelledby="nav-heading"
    style="{horizontalTabs ? 'height' : 'width'}: {size}px; z-index: 10000000000000;"
    on:mouseleave={handleMouseLeave}
  >
    <div class="h-full w-full overflow-auto">
      <slot name="sidebar" />
    </div>
    <button
      class="absolute bg-white p-1 border-2 border-[rgba(0,0,0,0.08)] text-slate-600 no-drag cursor-pointer
      {horizontalTabs ? '-bottom-[34px] left-1/2 -translate-x-1/2' : '-right-[34px]'} "
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
      class="absolute z-10 bg-red-500 flex-grow-0 no-drag cursor-{horizontalTabs
        ? 'row'
        : 'col'}-resize {!horizontalTabs ? 'right-0' : ''} {horizontalTabs
        ? 'bottom-0'
        : ''} {!horizontalTabs ? 'top-0 bottom-0 w-1' : ''} {horizontalTabs
        ? 'left-0 right-0 h-1'
        : ''}"
    >
      <div
        on:pointerdown={handlePointerDown}
        class="{horizontalTabs
          ? 'cursor-row-resize h-3 w-full'
          : 'cursor-col-resize w-3 h-full'} shrink-0"
      />
    </div>
  </nav>
  <div
    class={peekAreaClasses}
    on:mouseenter={handleMouseEnter}
    on:mousemove={(e) => {
      if (isOpen === Open.Closed) {
        handleMouseEnter()
      }
    }}
  />
  <main style={mainStyle} class={mainClasses}>
    <div class="flex flex-col flex-grow overflow-auto">
      <slot name="content" />
    </div>
  </main>
</div>
