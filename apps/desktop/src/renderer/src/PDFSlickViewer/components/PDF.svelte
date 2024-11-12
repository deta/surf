<script lang="ts">
  import type { PDFSlickState, PDFSlick } from '@pdfslick/core'
  import { onMount, onDestroy } from 'svelte'
  import Thumbsbar from './Thumbsbar/Thumbsbar.svelte'
  import Toolbar from './Toolbar/Toolbar.svelte'
  import { pdfSlickStore, isThumbsbarOpen } from '../store'
  import {
    WebViewEventReceiveNames,
    type WebViewEventGoToPDFPage,
    type WebViewReceiveEvents
  } from '@horizon/types'

  let pdfSlickReady = null
  const pdfSlickInstance: Promise<PDFSlick> = new Promise((resolve) => {
    pdfSlickReady = resolve
  })

  const urlParams = new URLSearchParams(window.location.search)
  export const url = decodeURIComponent(urlParams.get('path'))
  export const page = urlParams.get('page') ? parseInt(urlParams.get('page'), 10) : null

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
      if (pdfSlickReady) pdfSlickReady(pdfSlick)

      const { info, metadata } = await pdfSlick.document.getMetadata()
      const pageTitle =
        info['Title'] || metadata?.get('dc:title') || pdfSlick.filename || 'Surf PDF Viewer'

      document.title = pageTitle
      if (page) {
        try {
          pdfSlick.gotoPage(page)
        } catch (err) {
          console.error(`failed to go to page ${page}: ${err}`)
        }
      }
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

  window.addEventListener(
    'pdf-renderer-event',
    async (
      event: CustomEvent<
        {
          [K in WebViewEventReceiveNames]: {
            type: K
            data: WebViewReceiveEvents[K]
          }
        }[WebViewEventReceiveNames]
      >
    ) => {
      const { type, data } = event.detail
      console.log('pdf-renderer-event', type, data)

      switch (type) {
        case WebViewEventReceiveNames.GoToPDFPage: {
          handleGoToPDFPage(data.page, data.targetText)
          break
        }
      }
    }
  )

  const calculateSimilarity = (str1: string, str2: string): number => {
    let matches = 0
    const minLength = Math.min(str1.length, str2.length)

    for (let i = 0; i < minLength; i++) {
      if (str1[i].toLowerCase() === str2[i].toLowerCase()) {
        matches++
      }
    }

    return matches / Math.max(str1.length, str2.length)
  }

  const findApproximateMatch = (
    fullText: string,
    targetText: string
  ): { idx: number; length: number; similarity: number }[] => {
    const targetLength = targetText.length
    let bestMatch = {
      idx: -1,
      length: 0,
      similarity: 0
    }

    const targetWords = targetText.toLowerCase().split(/\s+/)
    // pick a proper anchor word here
    const anchorWord =
      targetWords.find((w) => w.length > 5) ||
      targetWords.reduce((a, b) => (a.length >= b.length ? a : b))

    let pos = 0
    const wordPositions: number[] = []

    // find possible start positions
    while (true) {
      pos = fullText.toLowerCase().indexOf(anchorWord, pos)
      if (pos === -1) break
      wordPositions.push(pos)
      pos += anchorWord.length
    }

    // find the best match!!!
    for (const startPos of wordPositions) {
      const windowStart = Math.max(0, startPos - 20)
      const windowEnd = Math.min(fullText.length, startPos + targetLength + 20)
      const substring = fullText.substring(windowStart, windowEnd)

      const similarity = calculateSimilarity(substring, targetText)

      if (similarity > bestMatch.similarity) {
        bestMatch = {
          idx: windowStart,
          length: windowEnd - windowStart,
          similarity: similarity
        }

        if (similarity > 0.95) break
      }
    }

    return [bestMatch]
  }

  const handleGoToPDFPage = async (page: number, targetText?: string) => {
    // remove the existing highlight classes
    Array.from(document.querySelectorAll('span'))
      .map((span) => span.classList.remove('highlight'))

    const pdfSlick = await pdfSlickInstance
    pdfSlick.gotoPage(page)

    if (!targetText) return
    // TODO: instead of this, wait until the page is ready by listening to the event bus
    await new Promise((resolve) => setTimeout(resolve, 150))

    const pageContainer = document.querySelector(`.page[data-page-number="${page}"]`)
    if (!pageContainer) return
    const spans = Array.from(pageContainer.querySelectorAll('span'))

    let fullText = ''
    const spanMapping: number[] = []

    spans.forEach((span, idx) => {
      const text = span.textContent || ''
      fullText += text
      for (let i = 0; i < text.length; i++) {
        spanMapping.push(idx)
      }
    })

    const result = findApproximateMatch(fullText, targetText)
    if (result.length > 0) {
      const match = result[0]
      const startSpanIndex = spanMapping[match.idx]
      const endSpanIndex = spanMapping[match.idx + match.length - 1]

      for (let i = startSpanIndex; i <= endSpanIndex; i++) {
        spans[i].classList.add('highlight')
      }
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
