<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { type Resource } from '@deta/services/resources'
  import { useNotebookManager, type Notebook } from '@deta/services/notebooks'
  import { ResourceTagsBuiltInKeys, ResourceTypes, type Option, type SFFSResourceTag, type SFFSSearchParameters, type SFFSSearchResult } from '@deta/types'
  import { type ResourceSearchResult, useResourceManager, ResourceManagerEvents} from '@deta/services/resources'
  import { SearchResourceTags, useThrottle } from '@deta/utils'
  import { NotebookManagerEvents } from '@deta/services/notebooks'

  interface Search {
    query: string
    tags?: SFFSResourceTag[],
    parameters?: Omit<SFFSSearchParameters, 'spaceId'>
  }

  let {
    tags,
    // Only used in contents, not search.. our apis are bonked
    excludeWithinSpaces = false,
    search,
    children,
    loading,
    error,
  }: {
    tags: SFFSResourceTag[]
    excludeWithinSpaces?: boolean
    search?: Search
    children: Snippet<[Notebook]>
    loading?: Snippet
    error?: Snippet<[unknown]>
  } = $props()

  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()

  // TODO: Reuse or dispose
  //const getNotebook = (id: string) => {
  //  return new Promise<[Notebook, Option<ResourceSearchResult>]>((res, _) => {
  //    notebookManager.getNotebook(notebookId)
  //      .then((notebook: Notebook) => {
  //        if (fetchContents) notebook.fetchContents()
  //        res([notebook, undefined])
  //      })
  //  })
  //}
  //const getNotebookSearch = (search: Search) => {
  //  return new Promise<[Notebook, Option<ResourceSearchResult>]>((res, _) => {
  //    Promise.all([
  //      getNotebook(notebookId),
  //      useResourceManager().searchResources(search.query, search.tags ?? [], {
  //        ...search.parameters,
  //        spaceId: notebookId
  //      })
  //    ]).then(([notebook, searchResults]) => res([notebook, searchResults]))
  //  })
  //}
  //const notebookLoader = $derived(search && search.query ? getNotebookSearch(search) : getNotebook(notebookId))

  // NOTE: This makes them reactive, so that in the children snippets, it doesn't
  // re-render the entire snippet but only the items further down the chain if the
  // notebook or the search results change!
  let resources: Resource[] = $state()
  let searchResults: Option<ResourceSearchResult> = $state()
  let searching: boolean = $state(false)

  const runQuery = (search: Search) => {
    searching = true
    resourceManager.searchResources(search.query, [
        ...SearchResourceTags.NonHiddenDefaultTags({
          excludeAnnotations: true
        }),
        SearchResourceTags.NotExists(ResourceTagsBuiltInKeys.EMPTY_RESOURCE),
        ...(search.tags ?? [])
      ], {
        ...search.parameters,
        spaceId: undefined
      }).then(results => {
        searchResults = results.resources
          .sort((a, b) => new Date(b.resource.updatedAt).getTime() - new Date(a.resource.updatedAt).getTime())
          .map(e => e.resource)
          .filter((e) => {
            if (excludeWithinSpaces && resources !== undefined) {
              return resources.find(item => item.id === e.id)
            }
            return e
          })
        searching = false
      })
  }
  $effect(() => {
    if (search && search.query) {
      runQuery(search)
    } else {
      searchResults = undefined
      searching = false
    }
  })

  // TODO: Use everything contents for reactivity?
  const load = useThrottle(() => {
    if (search && search.query) runQuery(search)
    else {
      resourceManager.listResourcesByTags([
        ...SearchResourceTags.NonHiddenDefaultTags({
          excludeAnnotations: true
        }),
        SearchResourceTags.NotExists(ResourceTagsBuiltInKeys.EMPTY_RESOURCE),
        ...(tags ?? [])
      ], { includeAnnotations: false, excludeWithinSpaces }).then(result => {
        resources = result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      })
    }
  }, 250)
  load()

  onMount(() => {
    const unsubs =  [
      //notebookManager.on(NotebookManagerEvents.CreatedResource, () => load()),
      notebookManager.on(NotebookManagerEvents.DeletedResource, (resourceId: string) => {
        resources = resources.filter(e => resourceId != e.id)
        if (searchResults) searchResults = searchResults.filter(e => resourceId != e.id)
      }),
      notebookManager.on(NotebookManagerEvents.RemovedResources, (_, resourceIds: string[]) => {
        resources = resources.filter(e => !resourceIds.includes(e.id))
        if (searchResults) searchResults = searchResults.filter(e => !resourceIds.includes(e.id))
      })
    ]
    if (excludeWithinSpaces) {
      unsubs.push(
        notebookManager.on(NotebookManagerEvents.AddedResources, () => load()),
      )
    }
    return () => unsubs.forEach(f => f())
  })
</script>

<!--{#await notebookLoader}
  {@render loading?.()}
{:then notebook}
  {@render children?.([notebook, searchResults])}
{:catch error}
  {@render error?.(error)}
{/await}
-->
{#if resources}
  {@render children?.([resources, searchResults, searching])}
{:else}
  {@render loading?.()}
{/if}

