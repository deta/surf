<script lang="ts">
  import { clsx } from 'clsx'
  import { pdfSlickStore, isThumbsbarOpen } from '../../store'
  import { Button } from '@deta/ui'
  import Splitter from './Splitter.svelte'
  //import ZoomSelector from './ZoomSelector.svelte'
  //import MoreActions from './MoreActions.svelte'
  import DocumentInfo from './DocumentInfo.svelte'
  import Tooltip from '../../Tooltip.svelte'

  let wantedPageNumber: number | string = 1
  let currentPageNumber = 1
  // let openPdfFileRef: HTMLInputElement
  const urlParams = new URLSearchParams(window.location.search)
  const url = decodeURIComponent(urlParams.get('path'))

  $: currentPageNumber = $pdfSlickStore?.pageNumber ?? 1
  $: wantedPageNumber = currentPageNumber
</script>

<div
  class={`toolbar-wrapper w-full h-9 px-0.5 flex items-center justify-between shadow-sm text-xs select-none sticky top-0 z-30`}
>
  <div class="px-1 flex items-center space-x-1">
    <Button size="md" square onclick={() => isThumbsbarOpen.set(!$isThumbsbarOpen)}>
      <iconify-icon
        height="1em"
        icon="codicon:layout-sidebar-left-off"
        class={clsx({
          hidden: !$isThumbsbarOpen
        })}
      />

      <iconify-icon
        height="1em"
        icon="codicon:layout-sidebar-left"
        class={clsx({
          hidden: $isThumbsbarOpen
        })}
      />
    </Button>

    <Splitter />
    <!-----------------------<ZoomSelector />
    <Splitter />-->

    <Button
      size="md"
      square
      onclick={() => $pdfSlickStore?.pdfSlick?.viewer?.previousPage()}
      disabled={$pdfSlickStore?.pageNumber <= 1}
    >
      <iconify-icon height="1em" icon="codicon:chevron-up" />
    </Button>
    <Button
      size="md"
      square
      onclick={() => $pdfSlickStore?.pdfSlick?.viewer?.nextPage()}
      disabled={!$pdfSlickStore?.pdfSlick || $pdfSlickStore?.pageNumber >= $pdfSlickStore?.numPages}
    >
      <iconify-icon height="1em" icon="codicon:chevron-down" />
    </Button>

    <div class="flex items-center text-center space-x-2">
      <form
        on:submit|preventDefault={() => {
          const newPageNumber = parseInt(wantedPageNumber + '')
          if (
            Number.isInteger(newPageNumber) &&
            newPageNumber > 0 &&
            newPageNumber <= $pdfSlickStore.numPages
          ) {
            $pdfSlickStore.pdfSlick?.linkService.goToPage(newPageNumber)
          } else {
            wantedPageNumber = $pdfSlickStore.pageNumber
          }
        }}
      >
        <input
          type="text"
          bind:value={wantedPageNumber}
          class="block w-12 text-right rounded-sm border border-slate-300 focus:shadow focus:border-blue-400 focus:ring-0 outline-none text-xs p-1 px-1.5 placeholder:text-gray-300 focus:placeholder:text-gray-400 placeholder:italic"
          style="color: rgba(0,0,0,0.5);border-radius: 8px;"
          on:focus={(e) => {
            e.currentTarget.select()
          }}
          on:keydown={(e) => {
            switch (e.key) {
              case 'Down':
              case 'ArrowDown': {
                e.preventDefault()
                const page = Math.max(1, ($pdfSlickStore.pageNumber ?? 0) - 1)
                $pdfSlickStore.pdfSlick?.gotoPage(page)
                wantedPageNumber = page
                break
              }
              case 'Up':
              case 'ArrowUp': {
                e.preventDefault()
                const page = Math.min(
                  $pdfSlickStore.numPages ?? 0,
                  ($pdfSlickStore.pageNumber ?? 0) + 1
                )
                $pdfSlickStore.pdfSlick?.gotoPage(page)
                wantedPageNumber = page
                break
              }
              default:
                return
            }
          }}
        />
      </form>

      <span style="color: rgba(0,0,0,0.5);"> of {$pdfSlickStore?.numPages ?? ''}</span>
    </div>
  </div>

  <div class="px-1 space-x-1 flex items-center justify-end">
    <Button size="md" square onclick={() => $pdfSlickStore?.pdfSlick?.downloadOrSave()}>
      <iconify-icon height="1em" icon="tabler:download" />
      <Tooltip position="bottom" alignX="right">
        <p class="whitespace-nowrap">Download to System</p>
      </Tooltip>
    </Button>
    <DocumentInfo />
    <!--------<MoreActions />-->
  </div>
</div>

<!-- <div class="absolute -top-10 overflow-hidden w-0 h-0">
  <input
    id="openPdfFile"
    bind:this={openPdfFileRef}
    tabIndex={-1}
    type="file"
    accept=".pdf,application/pdf"
    on:change={(e) => {
      if (e.currentTarget?.files && e.currentTarget?.files[0]) {
        const file = e.currentTarget.files[0]
        const url = URL.createObjectURL(file)
        $pdfSlickStore.pdfSlick?.loadDocument(url, { filename: file.name })
      }
    }}
    class="absolute -top-[10000px]"
  />
</div> -->

<style>
  .toolbar-wrapper {
    background: #fff;
    border-bottom: 1px solid rgba(0, 0, 0, 0.15);
  }
</style>
