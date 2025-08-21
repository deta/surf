<script lang="ts">
  import { onMount } from 'svelte'
  import { createTelemetry, provideConfig } from '@deta/services'
  import { createResourceManager, type Resource } from '@deta/services/resources'

  const searchParams = new URLSearchParams(window.location.search)
  const notebookId = searchParams.get('notebookId') || ''

  let telemetryAPIKey = ''
  let telemetryActive = false
  let telemetryProxyUrl: string | undefined = undefined
  if (import.meta.env.PROD || import.meta.env.R_VITE_TELEMETRY_ENABLED) {
    telemetryActive = true
    telemetryProxyUrl = import.meta.env.R_VITE_TELEMETRY_PROXY_URL
    if (!telemetryProxyUrl) {
      telemetryAPIKey = import.meta.env.R_VITE_TELEMETRY_API_KEY
    }
  }

  const telemetry = createTelemetry({
    apiKey: telemetryAPIKey,
    active: telemetryActive,
    trackHostnames: false,
    proxyUrl: telemetryProxyUrl
  })
  const config = provideConfig()
  const resourceManager = createResourceManager(telemetry, config)

  onMount(async () => {
    console.log('Notebook mounted with ID:', notebookId)
  })
</script>

<div class="wrapper">
  <h1>Notebook Component</h1>

  <p><strong>Notebook ID:</strong> {notebookId}</p>
</div>

<style lang="scss">
  :global(html, body) {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 10px;
    background: #ffffff00;
  }

  .wrapper {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #ffffff73;
    backdrop-filter: blur(10px);
    border: 0.5px solid rgba(0, 0, 0, 0.1);

    h1 {
      font-size: 20px;
      margin-bottom: 5px;
    }
  }
</style>
