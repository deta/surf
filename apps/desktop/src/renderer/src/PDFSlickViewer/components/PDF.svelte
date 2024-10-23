<script lang="ts">
  import type { PDFSlickState, PDFSlick } from '@pdfslick/core'
  import { onMount, onDestroy } from 'svelte'
  import Thumbsbar from './Thumbsbar/Thumbsbar.svelte'
  import Toolbar from './Toolbar/Toolbar.svelte'
  import { pdfSlickStore, isThumbsbarOpen } from '../store'

  const urlParams = new URLSearchParams(window.location.search)
  const path = decodeURIComponent(urlParams.get('path'))
  export let url = `file://${path}`

  let RO: ResizeObserver

  let container: HTMLDivElement
  let thumbs: HTMLDivElement
  let store: import('zustand/vanilla').StoreApi<PDFSlickState>
  let pdfSlick: PDFSlick
  let unsubscribe: () => void = () => {}
  let openedInitial = false

  $: {
    if ($pdfSlickStore && $pdfSlickStore.pagesReady && !openedInitial) {
      isThumbsbarOpen.set(true)
      openedInitial = true
    }
  }

  onMount(async () => {
    const { create, PDFSlick } = await import('@pdfslick/core')

    store = create()

    pdfSlick = new PDFSlick({
      container,
      store,
      thumbs,
      options: {
        scaleValue: 'auto'
      }
    })

    pdfSlick.loadDocument(url).then(async () => {
      const { info, metadata } = await pdfSlick.document.getMetadata()
      const pageTitle =
        info['Title'] || metadata?.get('dc:title') || pdfSlick.filename || 'Surf PDF Viewer'

      document.title = pageTitle
    })
    store.setState({ pdfSlick })

    RO = new ResizeObserver(() => {
      const { scaleValue } = store.getState()
      if (scaleValue && ['page-width', 'page-fit', 'auto'].includes(scaleValue)) {
        pdfSlick.viewer.currentScaleValue = scaleValue
      }
    })

    unsubscribe = store.subscribe((s) => {
      pdfSlickStore.set(s)
    })
  })

  onDestroy(() => {
    unsubscribe()
    RO?.disconnect()
  })

  $: {
    if (RO && container) {
      RO.observe(container)
    }
  }
</script>

<div class="absolute inset-0 bg-slate-200/70 flex flex-col pdfSlick">
  <Toolbar />
  <div class="flex-1 flex">
    <Thumbsbar bind:thumbsRef={thumbs} />

    <div class="flex-1 relative h-full" id="container">
      <div id="viewerContainer" class="pdfSlickContainer absolute inset-0" bind:this={container}>
        <div id="viewer" class="pdfSlickViewer pdfViewer" />
      </div>
    </div>
  </div>
</div>

<div id="printContainer" />
<dialog id="printServiceDialog" class="min-w-[200px]">
  <div class="row">
    <span data-l10n-id="print_progress_message">Preparing document for printing…</span>
  </div>
  <div class="row">
    <progress value="0" max="100" />
    <span
      data-l10n-id="print_progress_percent"
      data-l10n-args={`{ "progress": 0 }`}
      class="relative-progress">0%</span
    >
  </div>
  <div class="buttonRow">
    <button id="printCancel" class="dialogButton"
      ><span data-l10n-id="print_progress_close">Cancel</span></button
    >
  </div>
</dialog>
