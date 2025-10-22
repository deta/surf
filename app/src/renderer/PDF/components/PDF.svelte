<script lang="ts">
  import type { PDFSlickState, PDFSlick } from '@pdfslick/core'
  import { onMount, onDestroy } from 'svelte'
  import Thumbsbar from './Thumbsbar/Thumbsbar.svelte'
  import Toolbar from './Toolbar/Toolbar.svelte'
  import { pdfSlickStore, isThumbsbarOpen } from '../store'
  import { WebViewEventReceiveNames, type WebViewReceiveEvents } from '@deta/types'
  import { isDev, parsePDFViewerParams } from '@deta/utils'

  let debugInfo = {
    anchorWord: '',
    targetText: '',
    fullText: '',
    matchStart: -1,
    matchEnd: -1,
    similarity: 0,
    totalSpans: 0
  }
  let showDebugInfo = false

  let pdfSlickReady = null
  const pdfSlickInstance: Promise<PDFSlick> = new Promise((resolve) => {
    pdfSlickReady = resolve
  })

  const params = parsePDFViewerParams(window.location.href)
  const { path, pathOverride, loading, error, page, filename } = params
  const pdfURL = path
  const pdfDownloadURL = pathOverride || path

  let RO: ResizeObserver

  let container: HTMLDivElement
  let thumbs: HTMLDivElement
  let store: import('zustand/vanilla').StoreApi<PDFSlickState>
  let pdfSlick: PDFSlick
  let unsubscribe: () => void = () => {}
  let openedInitial = false

  if (isDev) {
    // @ts-ignore
    window.pdfSlickInstance = pdfSlickInstance
  }

  $: {
    if ($pdfSlickStore && $pdfSlickStore.pagesReady && !openedInitial) {
      isThumbsbarOpen.set(false)
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
        scaleValue: 'auto',
        getDocumentParams: {
          isEvalSupported: false
        }
      }
    })

    if (!loading && !error) {
      if (pdfDownloadURL) {
        pdfSlick.loadDocument(pdfDownloadURL).then(async () => {
          if (pdfSlickReady) pdfSlickReady(pdfSlick)
          if (!path.startsWith('surf://surf/resource')) {
            const title = filename ?? (await getDocumentTitle(pdfSlick))
            if (title && title !== 'document.pdf') document.title = title
          }

          if (page) {
            try {
              pdfSlick.gotoPage(page)
            } catch (err) {
              console.error(`failed to go to page ${page}: ${err}`)
            }
          }
        })
      }
    }
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

  const getDocumentTitle = async (pdfSlick: PDFSlick): Promise<string> => {
    const getFilename = new Promise<string | null>((resolve) => {
      try {
        const xhr = new XMLHttpRequest()
        xhr.open('HEAD', pdfURL)
        xhr.timeout = 5000

        xhr.onload = () => {
          try {
            const filename = xhr
              .getResponseHeader('Content-Disposition')
              ?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)?.[1]
              ?.replace(/['"]/g, '')
            resolve(filename)
          } catch (e) {
            console.warn('failed to parse content-disposition:', e)
            resolve(null)
          }
        }
        xhr.onerror = xhr.ontimeout = () => {
          console.warn('failed to get content-disposition filename')
          resolve(null)
        }

        xhr.send()
      } catch (e) {
        console.warn('failed to make HEAD request:', e)
        resolve(null)
      }
    })

    const [filename, metadata] = await Promise.all([getFilename, pdfSlick.document.getMetadata()])

    return (
      filename ||
      metadata?.info?.['Title'] ||
      metadata?.metadata?.get('dc:title') ||
      pdfSlick.filename ||
      'Surf PDF Viewer'
    )
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
    const anchorWord = targetText.slice(0, 10)
    if (import.meta.env.DEV) {
      debugInfo.anchorWord = anchorWord
    }

    let pos = 0
    const wordPositions: number[] = []

    while (true) {
      pos = fullText.indexOf(anchorWord, pos)
      if (pos === -1) break
      wordPositions.push(pos)
      pos += anchorWord.length
    }

    // find the best match!!!
    for (const startPos of wordPositions) {
      const windowStart = Math.max(0, startPos)
      const windowEnd = Math.min(fullText.length, startPos + targetLength)
      const substring = fullText.substring(windowStart, windowEnd)

      const similarity = calculateSimilarity(substring, targetText)

      if (similarity > bestMatch.similarity) {
        bestMatch = {
          idx: windowStart,
          length: windowEnd - windowStart,
          similarity: similarity
        }

        if (import.meta.env.DEV) {
          debugInfo.matchStart = windowStart
          debugInfo.matchEnd = windowEnd
          debugInfo.similarity = similarity
        }

        if (similarity > 0.95) break
      }
    }

    return [bestMatch]
  }

  const ensurePageRendered = async (page: number, pdfSlick: PDFSlick): Promise<void> => {
    const promise = new Promise<void>((resolve, reject) => {
      const pageDiv = document.querySelector(`.page[data-page-number="${page}"]`)
      if (pageDiv?.querySelector('.textLayer')) {
        resolve()
        return
      }

      const handler = (e: { pageNumber: number }) => {
        if (e.pageNumber === page) {
          pdfSlick.eventBus.off('textlayerrendered', handler)
          resolve()
        }
      }
      pdfSlick.eventBus.on('textlayerrendered', handler)
      setTimeout(() => {
        pdfSlick.eventBus.off('textlayerrendered', handler)
        reject('text layer rendering timed out')
      }, 2000)
    })

    pdfSlick.gotoPage(page)
    return promise
  }

  const handleGoToPDFPage = async (page: number, targetText?: string) => {
    Array.from(document.querySelectorAll('span')).map((span) => span.classList.remove('highlight'))

    const normalizeString = (str: string) => {
      // log these in dev mode
      if (import.meta.env.DEV) {
        const nonBasic = str.match(/[^a-zA-Z0-9\s.,!?-]/g)
        if (nonBasic) {
          console.log(
            'special characters found:',
            nonBasic.map((c) => ({
              char: c,
              unicode: `U+${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
              context: str.substring(
                Math.max(0, str.indexOf(c) - 10),
                Math.min(str.length, str.indexOf(c) + 10)
              )
            }))
          )
        }
      }

      // thank ya claude
      return (
        str
          .normalize('NFKD')
          // Common PDF ligatures
          .replace(/ﬁ/g, 'fi')
          .replace(/ﬂ/g, 'fl')
          .replace(/ﬀ/g, 'ff')
          .replace(/ﬃ/g, 'ffi')
          .replace(/ﬄ/g, 'ffl')
          // Smart quotes to regular quotes
          .replace(/[''‚‛]/g, "'")
          .replace(/[""„‟]/g, '"')
          // Various hyphens/dashes to simple hyphen
          .replace(/[‐‑‒–—―]/g, '-')
          // Final cleanup
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .trim()
      )
    }

    const pdfSlick = await pdfSlickInstance
    await ensurePageRendered(page, pdfSlick)
    if (!targetText) return

    const pageContainer = document.querySelector(`.page[data-page-number="${page}"]`)
    if (!pageContainer) return
    const spans = Array.from(pageContainer.querySelectorAll('span[dir="ltr"]'))

    if (import.meta.env.DEV) {
      debugInfo.totalSpans = spans.length
      debugInfo.targetText = targetText
    }

    let fullText = ''
    const spanMapping: number[] = []

    spans.forEach((span, idx) => {
      const text = normalizeString(span.textContent || '')
      fullText += text
      for (let i = 0; i < text.length; i++) {
        spanMapping.push(idx)
      }
    })

    const result = findApproximateMatch(fullText, normalizeString(targetText))
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

<div
  class="absolute inset-0 flex flex-col pdfSlick"
  style="background: light-dark(rgba(226, 232, 240, 0.7), rgba(30, 41, 59, 0.7));"
>
  <Toolbar />
  <div class="flex-1 flex">
    <Thumbsbar bind:thumbsRef={thumbs} />

    <div class="flex-1 relative h-full" id="container">
      <div
        id="viewerContainer"
        class="pdfSlickContainer absolute inset-0 overflow-auto"
        bind:this={container}
      >
        <div id="viewer" class="pdfSlickViewer pdfViewer" />
      </div>
    </div>
  </div>
</div>

{#if showDebugInfo}
  <div
    class="fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg shadow-lg text-sm font-mono z-50 max-w-md"
    style="background: black; color: white; font-family: monospace;"
  >
    <h3 class="text-xs uppercase tracking-wider mb-2">Debug Info</h3>
    <div class="space-y-1">
      <div>anchor 0: <span class="text-yellow-400">{debugInfo.anchorWord}</span></div>
      <div>Target 0: <span class="text-blue-400">{debugInfo.targetText.slice(0, 40)}</span></div>
      <div>
        Target 1: <span class="text-blue-400"
          >{debugInfo.targetText.slice(
            debugInfo.targetText.length - 40,
            debugInfo.targetText.length
          )}</span
        >
      </div>
      <div>Match: {debugInfo.matchStart}->{debugInfo.matchEnd}</div>
      <div>Similarity: {(debugInfo.similarity * 100).toFixed(1)}%</div>
    </div>
  </div>
{/if}

<div id="printContainer" />
<dialog
  id="printServiceDialog"
  class="min-w-[200px]"
  style="background: light-dark(#ffffff, #1b2435); color: light-dark(rgba(0, 0, 0, 0.9), rgba(255, 255, 255, 0.9));"
>
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
    <button
      id="printCancel"
      class="dialogButton"
      style="background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.1)); color: light-dark(rgba(0, 0, 0, 0.85), rgba(255, 255, 255, 0.9));"
      ><span data-l10n-id="print_progress_close">Cancel</span></button
    >
  </div>
</dialog>
