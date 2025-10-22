<script lang="ts">
  /**
   *  This component allows loading resources by the id and automatically handles "lazy" loading
   *  delaying loading and displaying the resource / children until the element is in view.
   *
   *  Usage:
   *
   *  <ResourceLoader {resource}>
   *    {#snippet loading()}
   *    {/snippet}
   *
   *    {#snippet children(resource: Resource)}
   *      Resource: {resource.metadata.name}
   *    {/snippet}
   *  </ResourceLoader>
   */
  import { type Snippet } from 'svelte'
  import { onMount, onDestroy } from 'svelte'
  import { useResourceManager, ResourceManagerEvents } from '@deta/services/resources'
  import { type Resource } from '@deta/services/resources'

  let {
    resource,
    includeAnnotations = false,
    lazy = true,

    children,
    loading
  }: {
    resource: Resource | string
    includeAnnotations?: boolean

    /** Results in only loading the resource and children if the element becomes visible */
    lazy?: boolean

    children: Snippet<[Resource]>
    loading?: Snippet
  } = $props()

  const resourceManager = useResourceManager()

  let resourcePromise = $derived(lazy ? undefined : typeof resource === 'string' ? resourceManager.getResource(resource, { includeAnnotations }) : Promise.resolve(resource))

  const onContentVisibilityChanged = (e: ContentVisibilityAutoStateChangeEvent) => {
    if (!e.skipped && resourcePromise === undefined) {
      if (typeof resource === 'string') {
        resourcePromise = resourceManager.getResource(resource, { includeAnnotations })
      }
      else resourcePromise = Promise.resolve(resource)
    }
  }
</script>

{#if !lazy && resourcePromise}
  {#await resourcePromise}
    {@render loading?.()}
  {:then resource}
      {@render children?.(resource)}
  {/await}
{:else}
  <div oncontentvisibilityautostatechange={onContentVisibilityChanged}>
    {#if resourcePromise}
      {#await resourcePromise}
        {@render loading?.()}
      {:then resource}
          {@render children?.(resource)}
      {/await}
    {/if}
  </div>
{/if}

<style>
div {
  display: contents;
  content-visibility: auto;
}
</style>
