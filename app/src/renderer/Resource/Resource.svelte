<script lang="ts">
  import { onMount } from 'svelte'
  import { createTelemetry, provideConfig } from '@deta/services'
  import { createResourceManager, type Resource } from '@deta/services/resources'
  import { setupTelemetry } from '@deta/services/helpers'
  import { useTabs } from '@deta/services/tabs'
  import { provideAI } from '@deta/services/ai'
  import { ResourceTypes } from '@deta/types'

  import { Note } from '@deta/ui'
  import TextResource from './components/TextResource.svelte'

  const searchParams = new URLSearchParams(window.location.search)
  const resourceId = searchParams.get('resourceId') || ''

  const telemetry = setupTelemetry()
  const config = provideConfig()
  const resourceManager = createResourceManager(telemetry, config)
  const tabs = useTabs()
  const ai = provideAI(resourceManager, tabs, config, false)

  const contextManager = ai.contextManager

  let resource: Resource | null = $state(null)

  onMount(async () => {
    console.log('Resource mounted with ID:', resourceId)

    resource = await resourceManager.getResource(resourceId)
    console.log('Loaded resource:', resource)
  })
</script>

<svelte:head>
  {#if resource}
    <title>{resource.metadata.name}</title>
  {/if}
</svelte:head>

<div class="wrapper">
  {#if resource}
    {#if resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
      <!-- <Note {resource} /> -->
      <TextResource resourceId={resource.id} {resource} {contextManager} />
    {:else}
      <div>
        <p><strong>Name:</strong> {resource.metadata.name}</p>
        <p><strong>Description:</strong> {resource.type}</p>
      </div>
    {/if}
  {:else}
    <!-- NOTE: This should be instant, if we show it like this it creates a flicker at the top -->
    <!-- If we want we can add a delay to show it after 1 sec of loading just in case -->
    <!--<p>Loading resource…</p>-->
  {/if}
</div>

<style lang="scss">
  :global(#app) {
    height: 100%;
    width: 100%;
    margin: 0;
  }
  :global(html, body) {
    height: 100%;
    width: 100%;
    margin: 0;
    background: #ffffff00;
  }

  .wrapper {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #ffffff73;
    border: 0.5px solid rgba(0, 0, 0, 0.1);

    h1 {
      font-size: 20px;
      margin-bottom: 5px;
    }
  }
</style>
