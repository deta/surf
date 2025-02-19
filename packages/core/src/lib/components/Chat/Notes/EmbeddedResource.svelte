<script lang="ts">
  import { onMount } from 'svelte'

  import { ResourceTagsBuiltInKeys, WEB_RESOURCE_TYPES } from '@horizon/types'
  import { mimeTypeToCodeLanguage, useLogScope } from '@horizon/utils'
  import { Icon } from '@horizon/icons'

  import { useResourceManager, type Resource } from '@horizon/core/src/lib/service/resources'
  import OasisResourceLoader from '@horizon/core/src/lib/components/Oasis/OasisResourceLoader.svelte'

  import CodeRenderer from '../CodeRenderer.svelte'
  import CollapsableResourceBlock from '@horizon/core/src/lib/components/Oasis/CollapsableResourceBlock.svelte'

  export let id: string
  export let preview: boolean = false

  const log = useLogScope('EmbeddedResource')
  const resourceManager = useResourceManager()

  let resource: Resource | null = null

  $: generatedResource = (resource?.tags ?? []).some(
    (tag) => tag.name === ResourceTagsBuiltInKeys.SAVED_WITH_ACTION && tag.value === 'generated'
  )

  $: canBeEmbedded = resource && WEB_RESOURCE_TYPES.some((x) => resource?.type.startsWith(x))
  $: canonicalUrl = (resource?.tags ?? []).find(
    (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
  )?.value

  onMount(async () => {
    resource = await resourceManager.getResource(id)
    log.debug('Resource:', resource, preview)
  })
</script>

{#if resource}
  {#if generatedResource}
    <CodeRenderer
      {resource}
      language={mimeTypeToCodeLanguage(resource.type)}
      showPreview={!preview}
      expandable={!preview}
      collapsable
      initialCollapsed={preview ? true : 'auto'}
      resizable={true}
      minHeight="150px"
      maxHeight="800px"
      initialHeight="450px"
    />
  {:else if canBeEmbedded && canonicalUrl}
    <CollapsableResourceBlock
      {resource}
      language={mimeTypeToCodeLanguage(resource.type)}
      showPreview={!preview}
      expandable={!preview}
      collapsable
      initialCollapsed={preview ? true : 'auto'}
      resizable={true}
      minHeight="150px"
      maxHeight="800px"
      initialHeight="450px"
    />
  {:else}
    <OasisResourceLoader resourceOrId={resource} />
  {/if}
{:else}
  <div class="loading">
    <Icon name="spinner" />
    Loading...
  </div>
{/if}

<style>
  .loading {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
