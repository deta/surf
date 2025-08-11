<script lang="ts">
  import Unknown from './UnknownFileView.svelte'
  import type { Resource } from '../../../../service/resources'
  import { onMount } from 'svelte'
  import { useLogScope } from '@deta/utils'

  export let resource: Resource

  const log = useLogScope('PDFView')

  let error = false
  let webview: Electron.WebviewTag

  const webviewSrc = `${window.api.PDFViewerEntryPoint}?path=${encodeURIComponent(`file://${resource.path}`)}`

  onMount(() => {
    webview.addEventListener('did-finish-load', () => {
      log.debug('did finish load')
    })

    webview.addEventListener('did-fail-load', (e) => {
      log.error('did fail load', e)
      error = true
    })
  })
</script>

{#if error}
  <p>
    Error loading PDF. <a
      href="file://{resource.path}"
      download
      target="_blank"
      rel="noopener noreferrer">Download PDF</a
    >
  </p>
  <Unknown {resource} />
{:else}
  <webview
    bind:this={webview}
    src={webviewSrc}
    webpreferences="autoplayPolicy=user-gesture-required,defaultFontSize=16,contextIsolation=true,nodeIntegration=false,sandbox=true,webSecurity=true"
  >
    <Unknown {resource} />
  </webview>
{/if}

<style lang="scss">
  webview {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
