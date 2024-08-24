<script lang="ts">
  import clsx from 'clsx'
  import { clamp } from 'lodash'
  import { onMount } from 'svelte'

  const Open = {
    Open: 'open',
    Closed: 'closed'
  } as const

  type Open = (typeof Open)[keyof typeof Open]

  let selected: string | null = null
  let width = 250
  let originalWidth = width
  let originalClientX = width
  let isDragging = false
  let isOpen: Open = Open.Open

  let ownerDocument: Document

  onMount(() => {
    ownerDocument = document
  })

  function handlePointerDown(e: PointerEvent) {
    // this prevents dragging from selecting
    e.preventDefault()

    originalWidth = width
    originalClientX = e.clientX
    isDragging = true

    function onPointerMove(e: PointerEvent) {
      if (e.clientX < 50) isOpen = Open.Closed
      else isOpen = Open.Open

      width = Math.floor(clamp(originalWidth + e.clientX - originalClientX, 200, 400))
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

  function toggleSidebar() {
    isOpen = isOpen === Open.Closed ? Open.Open : Open.Closed
  }

  $: navClasses = clsx(
    'fixed top-0 bottom-0 left-0 flex flex-col space-y-2 h-screen max-h-screen flex-shrink-0 bg-[rgb(251,251,250)] transition-transform ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300',
    {
      'cursor-col-resize': isDragging
    },
    isDragging
      ? 'shadow-[rgba(0,0,0,0.2)_-2px_0px_0px_0px_inset]'
      : 'shadow-[rgba(0,0,0,0.04)_-2px_0px_0px_0px_inset]',
    isOpen === Open.Open ? 'translate-x-0' : '-translate-x-full'
  )

  $: buttonClasses = clsx(
    'w-6 h-6 transition-transform ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300',
    isOpen === Open.Open ? 'rotate-180' : 'rotate-0'
  )

  $: mainStyle = `padding-left: ${isOpen === Open.Open ? width : 0}px;`
  $: mainClasses = clsx(
    'flex flex-grow max-h-screen h-full px-2',
    isDragging
      ? 'transition-none'
      : 'transition-all ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300'
  )
</script>

<div class="flex w-screen h-screen justify-start items-start">
  <nav class={navClasses} aria-labelledby="nav-heading" style="width: {width}px;">
    <div class="h-full overflow-auto">
      <slot name="sidebar" />
    </div>
    <button
      class="absolute bg-white p-1 border-y-2 border-r-2 border-[rgba(0,0,0,0.08)] text-slate-600 -right-[34px] no-drag cursor-pointer"
      on:click={toggleSidebar}
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
      class="absolute z-10 right-0 bg-red-500 flex-grow-0 top-0 bottom-0 no-drag w-1 cursor-col-resize"
    >
      <div on:pointerdown={handlePointerDown} class="w-3 h-full cursor-col-resize shrink-0" />
    </div>
  </nav>

  <main style={mainStyle} class={mainClasses}>
    <div class="flex flex-col px-5 py-12 flex-grow overflow-auto">
      <slot name="content" />
    </div>
  </main>
</div>
