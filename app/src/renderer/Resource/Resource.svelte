<script lang="ts">
  import { onMount } from 'svelte'
  import { provideConfig } from '@deta/services'
  import { createResourceManager, type Resource } from '@deta/services/resources'
  import { setupTelemetry } from '@deta/services/helpers'
  import { provideAI } from '@deta/services/ai'
  import { ResourceTypes, WEB_RESOURCE_TYPES, type CitationClickEvent } from '@deta/types'

  import { Note } from '@deta/ui'
  import TextResource from './components/TextResource.svelte'
  import { useMessagePortClient } from '@deta/services/messagePort'

  const resourceId = window.location.pathname.slice(1)

  const telemetry = setupTelemetry()
  const config = provideConfig()
  const resourceManager = createResourceManager(telemetry, config)
  const ai = provideAI(resourceManager, config, false)
  const messagePort = useMessagePortClient()

  const contextManager = ai.contextManager

  let resource: Resource | null = $state(null)

  let canBeNoteResource = $derived(
    WEB_RESOURCE_TYPES.some((x) => resource.type.startsWith(x)) ||
      resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE
  )

  function handleCitationClick(data: CitationClickEvent) {
    console.log('Citation clicked:', data)
    window.api.citationClick(data)
  }

  onMount(async () => {
    console.log('Resource mounted with ID:', resourceId)

    resource = await resourceManager.getResource(resourceId)
    console.log('Loaded resource:', resource)

    // if ([ResourceTypes.ARTICLE, ResourceTypes.LINK].includes(resource.type)) {
    //   // @ts-ignore - TODO: Add to window d.ts
    //   navigation.navigate(resource.url, { history: 'replace' })
    // }
  })
</script>

<svelte:head>
  {#if resource}
    <title>{resource.metadata.name}</title>
  {/if}
</svelte:head>

<div class="wrapper">
  {#if resource}
    {#if canBeNoteResource}
      <!-- <Note {resource} /> -->
      <TextResource
        resourceId={resource.id}
        {resource}
        {contextManager}
        {messagePort}
        onCitationClick={handleCitationClick}
      />
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
