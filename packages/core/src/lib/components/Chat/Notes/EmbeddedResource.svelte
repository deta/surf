<script lang="ts">
  import { onMount } from 'svelte'

  import { ResourceTagsBuiltInKeys, WEB_RESOURCE_TYPES } from '@deta/types'
  import { mimeTypeToCodeLanguage, useLogScope } from '@deta/utils'
  import { Icon } from '@horizon/icons'

  import { useResourceManager, type Resource } from '@horizon/core/src/lib/service/resources'
  import OasisResourceLoader from '@horizon/core/src/lib/components/Oasis/OasisResourceLoader.svelte'

  import SurfletRenderer from '../SurfletRenderer.svelte'
  import CollapsableResourceEmbed from '@horizon/core/src/lib/components/Chat/Notes/CollapsableResourceEmbed.svelte'

  export let id: string
  export let preview: boolean = false
  export let expanded: boolean = false
  export let isEditable: boolean = true

  const log = useLogScope('EmbeddedResource')
  const resourceManager = useResourceManager()

  let resource: Resource | null = null
  let loading: boolean = true

  $: generatedResource = (resource?.tags ?? []).some(
    (tag) => tag.name === ResourceTagsBuiltInKeys.SAVED_WITH_ACTION && tag.value === 'generated'
  )

  $: imageResource = resource?.type?.startsWith('image/')

  $: canBeEmbedded = resource && WEB_RESOURCE_TYPES.some((x) => resource?.type.startsWith(x))
  $: canonicalUrl = (resource?.tags ?? []).find(
    (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
  )?.value

  $: hidePreview = preview || !expanded

  onMount(async () => {
    try {
      resource = await resourceManager.getResource(id)
      log.debug('Resource:', resource, preview, expanded)
    } catch (error) {
      log.error('Error loading resource:', error)
    } finally {
      loading = false
    }
  })
</script>

{#if resource}
  {#if generatedResource}
    <SurfletRenderer
      {resource}
      {isEditable}
      expandable={!hidePreview}
      collapsable
      initialCollapsed={preview ? true : expanded ? false : 'auto'}
      resizable={true}
      minHeight="150px"
      maxHeight="800px"
      initialHeight="450px"
    />
  {:else if canBeEmbedded && canonicalUrl}
    <CollapsableResourceEmbed
      {resource}
      {isEditable}
      language={mimeTypeToCodeLanguage(resource.type)}
      showPreview={!hidePreview}
      expandable={!hidePreview}
      collapsable
      initialCollapsed={preview ? true : expanded ? false : 'auto'}
      resizable={true}
      minHeight="150px"
      maxHeight="800px"
      initialHeight="450px"
    />
  {:else if imageResource}
    <CollapsableResourceEmbed
      {resource}
      {isEditable}
      hideHeader
      showPreview={expanded}
      expandable={expanded}
      collapsable
      initialCollapsed={expanded ? false : 'auto'}
      resizable={true}
      minHeight="150px"
      maxHeight="800px"
      initialHeight="-1"
    />
  {:else}
    <OasisResourceLoader resourceOrId={resource} />
  {/if}
{:else if loading}
  <div class="loading">
    <Icon name="spinner" />
    Loading...
  </div>
{:else}
  <div class="loading">
    <Icon name="alert-triangle" />
    Embedded resource not found
  </div>
{/if}

<style>
  .loading {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
