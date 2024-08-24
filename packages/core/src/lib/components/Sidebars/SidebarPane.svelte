<script lang="ts" context="module">
  export type SidebarPaneEvents = {
    'collapsed-left-sidebar': void
    'expanded-left-sidebar': void
    'pane-update': PaneAPI
    'collapsed-right-sidebar': void
    'expanded-right-sidebar': void
    'pane-update-right': PaneAPI
  }
</script>

<script lang="ts">
  import clsx from 'clsx'

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

  function handlePointerDown(e: PointerEvent) {
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
      window.removeEventListener('pointermove', onPointerMove)
      isDragging = false
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
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
    'flex flex-grow h-1/2',
    isDragging
      ? 'transition-none'
      : 'transition-all ease-[cubic-bezier(0.165,0.84,0.44,1)] duration-300'
  )
</script>

<div class="flex w-full h-full justify-start items-start no-drag">
  <nav class={navClasses} aria-labelledby="nav-heading" style="width: {width}px;">
    <slot name="sidebar" />
    <button
      class="absolute bg-red-500 p-1 border-y-2 border-r-2 border-[rgba(0,0,0,0.08)] text-slate-600 -bottom-0 -right-[34px] no-drag z-[500000000000001]"
      style="z-index: 1231221312321312312221321313212112312321312;"
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

    <div class="absolute z-10 right-0 flex-grow-0 top-0 bottom-0 no-drag bg-red-500 w-3">
      <div on:pointerdown={handlePointerDown} class="w-3 h-full cursor-col-resize shrink-0" />
    </div>
  </nav>

  <main style={mainStyle} class={mainClasses}>
    <slot name="content" />
  </main>
</div>
<!--
<PaneGroup direction={horizontalTabs ? 'vertical' : 'horizontal'} class="px-0.5">
  {#if horizontalTabs}
    <div>
      <slot name="sidebar" />
    </div>
  {:else}
    <Pane
      defaultSize={localStorage.getItem('panelSize-vertical-sidebar') === null
        ? 15
        : pxToPercentage(Number(localStorage.getItem('panelSize-vertical-sidebar')))}
      collapsible={true}
      bind:pane={$paneStore}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
      onResize={(size) => handleResizePane('sidebar', size)}
      order={1}
    >
      <slot name="sidebar" />
    </Pane>
    <PaneResizer class="hover:bg-neutral-100 z-[50001] my-1.5 rounded-full no-drag">
      <div
        class:h-full={!horizontalTabs}
        class:w-1.5={!horizontalTabs}
        class:w-full={horizontalTabs}
        class:h-0.5={horizontalTabs}
      />
    </PaneResizer>
  {/if}
  <Pane order={2}>
    <PaneGroup direction="horizontal">
      <Pane order={1}>
        <slot name="content" />
      </Pane>
      <PaneResizer class="hover:bg-neutral-100 z-[50001] my-1.5 rounded-full no-drag">
        <div class="h-full w-1.5" />
      </PaneResizer>
      <Pane
        order={2}
        defaultSize={localStorage.getItem('panelSize-right-sidebar') === null
          ? 15
          : pxToPercentage(Number(localStorage.getItem('panelSize-right-sidebar')))}
        collapsible={true}
        class="bg-sky-50 mb-1.5 rounded-xl {horizontalTabs ? '' : 'mt-1.5'}"
        onCollapse={handleRightCollapse}
        onExpand={handleRightExpand}
        bind:pane={$rightPaneStore}
        onResize={(size) => handleResizePane('right-sidebar', size)}
      >
        <slot name="right-sidebar" minimal={rightSidebarMinimal} />
      </Pane>
    </PaneGroup>
  </Pane>
</PaneGroup> -->
