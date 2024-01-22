<script lang="ts">
  import { writable } from 'svelte/store'
  import type { WebviewTag } from 'electron'

  export let src: string
  export let partition: string

  export const url = writable(src)
  export const canGoBack = writable(false)
  export const canGoForward = writable(false)
  export const isLoading = writable(false)
  export const title = writable('')

  let webview: WebviewTag

  $: if (webview) {
    webview.addEventListener('did-navigate', (e: any) => {
      $url = e.url
      $canGoBack = webview.canGoBack()
      $canGoForward = webview.canGoForward()
    })
    webview.addEventListener('did-navigate-in-page', (e: any) => {
      $url = e.url
      $canGoBack = webview.canGoBack()
      $canGoForward = webview.canGoForward()
    })

    webview.addEventListener('did-start-loading', () => ($isLoading = true))
    webview.addEventListener('did-stop-loading', () => ($isLoading = false))
    webview.addEventListener('page-title-updated', (e: any) => ($title = e.title))
  }

  export function navigate(targetUrl: string): void {
    if (webview) {
      $url = targetUrl
      webview.src = targetUrl
    }
  }

  export function reload(): void {
    webview?.reload()
  }

  export function goBack(): void {
    if (webview?.canGoBack()) {
      webview.goBack()
    }
  }

  export function goForward(): void {
    if (webview?.canGoForward()) {
      webview.goForward()
    }
  }
</script>

<webview bind:this={webview} {src} {partition} />

<style>
  webview {
    user-select: none;
    width: 100%;
    height: 100%;
  }
</style>
