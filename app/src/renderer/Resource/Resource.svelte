<script lang="ts">
  import { onMount } from 'svelte'
  import {
    createTelemetry,
    provideConfig,
    createResourceManager,
    type Resource
  } from '@deta/services'

  const searchParams = new URLSearchParams(window.location.search)
  const resourceId = searchParams.get('resourceId') || ''

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

  let resource: Resource | null = null

  onMount(async () => {
    console.log('Resource mounted with ID:', resourceId)

    resource = await resourceManager.getResource(resourceId)
    console.log('Loaded resource:', resource)
  })
</script>

<div class="wrapper">
  <h1>Resource Component</h1>

  <p><strong>Resource ID:</strong> {resourceId}</p>

  {#if resource}
    <div>
      <p><strong>Name:</strong> {resource.metadata.name}</p>
      <p><strong>Description:</strong> {resource.type}</p>
    </div>
  {:else}
    <p>Loading resource...</p>
  {/if}
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
