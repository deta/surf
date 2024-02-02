<script lang="ts">
  import { writable, get } from 'svelte/store'
  import type { WebviewTag } from 'electron'
  import { createEventDispatcher, onMount } from 'svelte'

  const dispatch = createEventDispatcher<{
    wheelWebview: any
    didFinishLoad: void
    focusWebview: any
    newWindowWebview: any
  }>()

  export let src: string
  export let partition: string

  export const url = writable(src)
  export const canGoBack = writable(false)
  export const canGoForward = writable(false)
  export const isLoading = writable(false)
  export const title = writable('')
  export const faviconURL = writable<string[]>([])

  export const historyStack = writable<string[]>([])
  export const currentHistoryIndex = writable(-1)
  let programmaticNavigation = false

  let webview: WebviewTag

  const updateNavigationState = () => {
    canGoBack.set(get(currentHistoryIndex) > 0)
    canGoForward.set(get(currentHistoryIndex) < get(historyStack).length - 1)
  }

  $: webview, updateNavigationState()
  $: {
    if (
      webview &&
      !programmaticNavigation &&
      $url !== get(historyStack)[get(currentHistoryIndex)]
    ) {
      historyStack.update((stack) => {
        let index = get(currentHistoryIndex)
        if (index < stack.length - 1) {
          stack = stack.slice(0, index + 1)
        }
        stack.push($url)
        return stack
      })
      currentHistoryIndex.update((n) => n + 1)
      updateNavigationState()
    }

    programmaticNavigation = false
  }

  onMount(() => {
    window.api.onNewWindowRequest((data) => {
      if (webview.getWebContentsId().toString() === data.webContentsId.toString()) {
        dispatch('newWindowWebview', data)
      }
    })
    webview.addEventListener('ipc-message', (event) => {
      if (event.channel !== 'webview-page-event') return

      const eventData = event.args[0]
      const eventType = eventData.type as string
      delete eventData.type

      switch (eventType) {
        case 'wheel':
          dispatch('wheelWebview', eventData)
          break
        case 'focus':
          dispatch('focusWebview', eventData)
          break
      }
    })

    // webview.addEventListener('dom-ready', (_) => webview.openDevTools())

    webview.addEventListener('did-navigate', (e: any) => url.set(e.url))
    webview.addEventListener('did-navigate-in-page', (e: any) => url.set(e.url))
    webview.addEventListener('did-start-loading', () => isLoading.set(true))
    webview.addEventListener('did-stop-loading', () => isLoading.set(false))
    webview.addEventListener('page-title-updated', (e: any) => title.set(e.title))
    webview.addEventListener('did-finish-load', () => dispatch('didFinishLoad'))
    webview.addEventListener('page-favicon-updated', (e:any) => {
      // Get the biggest favicon (last favicon in array)
      faviconURL.set(e.favicons[e.favicons.length - 1])
    })
  })

  export function navigate(targetUrl: string): void {
    if (webview) {
      webview.src = targetUrl
    }
  }

  export function reload(): void {
    webview?.reload()
  }

  export function goBack(): void {
    currentHistoryIndex.update((n) => {
      if (n > 0) {
        n--
        programmaticNavigation = true
        navigate(get(historyStack)[n])
        updateNavigationState()
        return n
      }
      return n
    })
  }

  export function goForward(): void {
    currentHistoryIndex.update((n) => {
      const stack = get(historyStack)
      if (n < stack.length - 1) {
        n++
        programmaticNavigation = true
        navigate(stack[n])
        updateNavigationState()
        return n
      }
      return n
    })
  }
</script>

<webview
  bind:this={webview}
  {src}
  {partition}
  preload={`file://${window.api.webviewPreloadPath}`}
  allowpopups
/>

<style>
  webview {
    user-select: none;
    width: 100%;
    height: 100%;
  }
</style>
