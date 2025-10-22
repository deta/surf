<script lang="ts">
  import { onMount } from 'svelte'
  import { clsx } from 'clsx'
  import { select } from 'd3-selection'
  import { drag } from 'd3-drag'
  import { Button } from '@deta/ui'
  import ButtonsBar from './ButtonsBar.svelte'
  import Outline from './Outline.svelte'
  import Thumbnails from './Thumbnails.svelte'
  import Attachments from './Attachments.svelte'
  import { isThumbsbarOpen } from '../../store'

  export let thumbsRef: HTMLDivElement

  let isResizing: boolean = false
  let width = 233
  let containerRef: HTMLDivElement
  let resizerRef: HTMLDivElement

  onMount(() => {
    let newWidth = 0

    const dragResize = drag<HTMLDivElement, unknown>()
      .on('start', () => {
        newWidth = containerRef.clientWidth
        isResizing = true
      })
      .on('drag', (e) => {
        newWidth += e.dx
        width = Math.min(620, Math.max(233, newWidth))
      })
      .on('end', () => {
        isResizing = false
      })

    select(resizerRef!).call(dragResize)
  })
</script>

<div
  bind:this={containerRef}
  class={clsx(
    `h-full flex relative bg-slate-50 border-r border-slate-300 [box-shadow:1px_0_2px_0_rgb(0_0_0_/_0.05)]`,
    {
      'transition-all': !isResizing,
      visible: $isThumbsbarOpen,
      'invisible border-r-0 overflow-hidden': !$isThumbsbarOpen
    }
  )}
  style:width={`${$isThumbsbarOpen ? width : 0}px`}
>
  <ButtonsBar />

  <div
    class={clsx(`flex-1 relative`, {
      'translate-x-0 visible opacity-100': $isThumbsbarOpen,
      '-translate-x-full invisible opacity-0': !$isThumbsbarOpen
    })}
  >
    <Thumbnails bind:thumbsRef />
    <Outline />
    <Attachments />
  </div>
</div>
<div bind:this={resizerRef} class="hover:cursor-col-resize relative w-0">
  {#if $isThumbsbarOpen}
    <div
      class={clsx(
        `absolute -left-px top-0 h-full z-10 w-1 transition-all duration-150 ease-in hover:delay-150 hover:duration-150z`,
        {
          'bg-blue-400': isResizing,
          'bg-transparent hover:bg-blue-400': !isResizing
        }
      )}
    />
  {/if}
</div>
