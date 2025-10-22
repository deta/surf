<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { provideConfig } from '@deta/services'
  import { createResourceManager, type Resource } from '@deta/services/resources'
  import { provideAI } from '@deta/services/ai'
  import { isWebResourceType, ResourceTypes, type CitationClickEvent } from '@deta/types'

  import TextResource from '../components/TextResource.svelte'
  import { useMessagePortClient } from '@deta/services/messagePort'
  import { useLogScope, wait } from '@deta/utils'
  import { type RouteResult } from '@mateothegreat/svelte5-router'

  let {
    route
  }: {
    route: RouteResult
  } = $props()

  const resourceId = (route.result.path.params as any).resourceId as string

  const log = useLogScope('ResourceRenderer')
  const messagePort = useMessagePortClient()
  const config = provideConfig()
  const resourceManager = createResourceManager(config)
  const ai = provideAI(resourceManager, config, false)

  const contextManager = ai.contextManager

  let resource: Resource | null = $state(null)

  let canBeNoteResource = $derived(
    resource &&
      (isWebResourceType(resource.type) || resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE)
  )

  function handleCitationClick(data: CitationClickEvent) {
    log.debug('Citation clicked:', data)

    messagePort.citationClick.send(data)
  }

  const isImageResource = $derived(resource?.type?.startsWith(ResourceTypes.IMAGE))

  onMount(async () => {
    log.debug('Resource mounted with ID:', resourceId)

    if (resourceId === 'blank') {
      log.debug('Blank resource, not loading anything')
      return
    }

    resource = await resourceManager.getResource(resourceId)
    log.debug('Loaded resource:', resource)

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
    {:else if isImageResource}
      <img src={`surf://surf/resource/${resource.id}?raw`} />
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
  // well.. this is another sin
  :global(.router-content:not(:has(.text-resource-wrapper)):not(:has(.tty-wrapper))) {
    position: relative !important;
  }
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
    position: relative;
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: light-dark(var(--app-background), var(--app-background-dark));
    background: light-dark(#fff, rgba(27, 36, 53, 1));
    border: 0.5px solid rgba(0, 0, 0, 0.1);

    h1 {
      font-size: 20px;
      margin-bottom: 5px;
    }
  }

  img {
    max-height: 100vh;
    max-width: 100vw;
    height: auto;
    width: auto;
    display: block;
    margin: auto;
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
  }
</style>
