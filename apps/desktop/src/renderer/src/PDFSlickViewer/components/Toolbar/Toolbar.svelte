<script lang="ts">
  import { clsx } from 'clsx'
  import Tooltip from '../../Tooltip.svelte'
  import Splitter from './Splitter.svelte'
  import ZoomSelector from './ZoomSelector.svelte'
  import { pdfSlickStore, isThumbsbarOpen } from '../../store'
  import MoreActions from './MoreActions.svelte'
  import FreeTextMenu from './FreeTextMenu.svelte'
  import InkMenu from './InkMenu.svelte'
  import DocumentInfo from './DocumentInfo.svelte'

  let wantedPageNumber: number | string = 1
  let isDocumentInfoOpen: boolean
  let currentPageNumber = 1
  // let openPdfFileRef: HTMLInputElement
  const urlParams = new URLSearchParams(window.location.search)
  const url = decodeURIComponent(urlParams.get('path'))

  $: currentPageNumber = $pdfSlickStore?.pageNumber ?? 1
  $: wantedPageNumber = currentPageNumber
</script>

<div
  class={`w-full h-9 flex items-center justify-between bg-slate-50 border-b border-b-slate-300 shadow-sm text-xs select-none sticky top-0 bg-opacity-100 backdrop-blur z-30`}
>
  <div class="px-1 flex items-center space-x-1">
    <button
      class={`inline-flex enabled:hover:bg-slate-200 enabled:hover:text-black text-slate-500 disabled:text-slate-300 p-1 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent`}
      on:click={() => isThumbsbarOpen.set(!$isThumbsbarOpen)}
    >
      <iconify-icon
        height={16}
        icon="codicon:layout-sidebar-left-off"
        class={clsx({
          hidden: !$isThumbsbarOpen
        })}
      />

      <iconify-icon
        height={16}
        icon="codicon:layout-sidebar-left"
        class={clsx({
          hidden: $isThumbsbarOpen
        })}
      />
    </button>

    <Splitter />
    <ZoomSelector />
    <Splitter />

    <button
      disabled={$pdfSlickStore?.pageNumber <= 1}
      class="inline-flex enabled:hover:bg-slate-200 enabled:hover:text-black text-slate-500 disabled:text-slate-300 p-1 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent"
      on:click={() => $pdfSlickStore?.pdfSlick?.viewer?.previousPage()}
    >
      <iconify-icon height={16} icon="codicon:chevron-up" />
    </button>

    <button
      disabled={!$pdfSlickStore?.pdfSlick || $pdfSlickStore?.pageNumber >= $pdfSlickStore?.numPages}
      class="inline-flex enabled:hover:bg-slate-200 enabled:hover:text-black text-slate-500 disabled:text-slate-300 p-1 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent"
      on:click={() => $pdfSlickStore?.pdfSlick?.viewer?.nextPage()}
    >
      <iconify-icon height={16} icon="codicon:chevron-down" />
    </button>

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

      <span> of {$pdfSlickStore?.numPages ?? ''}</span>
    </div>
  </div>

  <div class="px-1 space-x-1 flex items-center justify-end">
    <FreeTextMenu />
    <InkMenu />

    <Splitter />

    <div class="items-center space-x-1 hidden sm:!flex">
      <!-- <button
        class="inline-flex enabled:hover:bg-slate-200 enabled:hover:text-black text-slate-500 disabled:text-slate-300 p-1 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent"
        on:click={() => openPdfFileRef.click()}
      >
        <iconify-icon height={16} icon="codicon:diff-added" />
        <Tooltip position="bottom">
          <p class="whitespace-nowrap">Open PDF File</p>
        </Tooltip>
      </button> -->

      <!-- <button
        class="inline-flex enabled:hover:bg-slate-200 enabled:hover:text-black text-slate-500 disabled:text-slate-300 p-1 rounded-sm transition-all group relative focus:border-blue-400 focus:ring-0 focus:shadow outline-none border border-transparent"
        on:click={() => $pdfSlickStore?.pdfSlick?.downloadOrSave()}
      >
        <iconify-icon height={16} icon="codicon:desktop-download" />
        <Tooltip position="bottom">
          <p class="whitespace-nowrap">Save</p>
        </Tooltip>
      </button> -->

      <DocumentInfo bind:isOpen={isDocumentInfoOpen} />
      <Splitter />
    </div>

    <MoreActions bind:isDocumentInfoOpen />
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
