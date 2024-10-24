<script lang="ts">
  import { onMount } from 'svelte'
  import Portal from 'svelte-portal'
  import { clsx } from 'clsx'
  import { pdfSlickStore, tab } from '../../store'

  export let thumbsRef: HTMLDivElement

  let cols = 1
  let RO: ResizeObserver

  onMount(() => {
    RO = new ResizeObserver(() => {
      const width = thumbsRef.clientWidth
      cols = Math.round(width / 200)
    })

    return () => RO?.disconnect()
  })

  $: {
    if (RO && thumbsRef) {
      RO.observe(thumbsRef)
    }
  }
</script>

<div
  class={clsx('overflow-auto absolute inset-0', {
    invisible: $tab !== 'thumbnails'
  })}
>
  <div class="px-2 relative h-full">
    <div
      class={clsx('grid gap-2 mx-auto pb-4 absolute overflow-auto inset-0', {
        'grid-cols-1': cols === 1,
        'grid-cols-2': cols === 2,
        'grid-cols-3': cols === 3,
        'grid-cols-4': cols > 3
      })}
      bind:this={thumbsRef}
    />
  </div>
</div>

{#each Array.from($pdfSlickStore?.thumbnailViews ?? []) as [pageNumber, { div, src, loaded, canvasWidth: width, canvasHeight: height, pageLabel }] (pageNumber)}
  <Portal target={div}>
    <div class="box-border pt-4 h-full w-full inline-flex justify-center">
      <div>
        <div class="flex justify-center">
          <button
            on:click={() => $pdfSlickStore?.pdfSlick?.gotoPage(pageNumber)}
            class={clsx('p-0.5', {
              'bg-blue-400 shadow': loaded && pageNumber === $pdfSlickStore?.pageNumber,
              'bg-transparent': pageNumber !== $pdfSlickStore?.pageNumber || !loaded
            })}
          >
            <div
              class={clsx('box-border relative border', {
                'border-slate-300 border-solid bg-slate-400 bg-opacity-5 shadow-sm': !loaded,
                'border-slate-300 border-solid hover:border-blue-400 shadow hover:shadow':
                  loaded && pageNumber !== $pdfSlickStore?.pageNumber,
                'border-transparent border-solid shadow-md':
                  loaded && pageNumber === $pdfSlickStore?.pageNumber
              })}
              style:width={`${width + 2}px`}
              style:height={`${height + 2}px`}
            >
              {#if src}
                <img {...{ src, width, height }} alt={`Page ${pageNumber}`} />
              {/if}
            </div>
          </button>
        </div>
        <div class="text-center text-xs text-slate-500 py-2">
          {pageLabel ?? pageNumber}
        </div>
      </div>
    </div>
  </Portal>
{/each}
