<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { useNotebookManager, type Notebook, NotebookManagerEvents } from '@deta/services/notebooks'
  import { ResourceTagsBuiltInKeys, type Option, type SFFSResourceTag, type SFFSSearchParameters } from '@deta/types'
  import { type ResourceSearchResult, useResourceManager } from '@deta/services/resources'
  import { SearchResourceTags, useCancelableDebounce, useLogScope, useThrottle } from '@deta/utils'

  interface Search {
    query: string
    tags?: SFFSResourceTag[],
    parameters?: Omit<SFFSSearchParameters, 'spaceId'>
  }

  let {
    notebookId,
    fetchContents = false,
    search,
    children,
    loading,
    error,
  }: {
    notebookId: string
    fetchContents?: boolean
    search?: Search
    children: Snippet<[Notebook]>
    loading?: Snippet
    error?: Snippet<[unknown]>
  } = $props()

  const log = useLogScope('NotebookLoader')
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
  let notebook: Notebook | undefined = $state(undefined)
  let searchResults: Option<ResourceSearchResult> = $state()
  let searching: boolean = $state(false)
  let isLoading = $state(false)
  
  const { execute: runQuery, cancel: cancelQuery } = useCancelableDebounce(async (search: Search) => {
    try {
      searching = true

      log.debug('Running notebook search', search)

      const results = await resourceManager.searchResources(search.query, [
        ...SearchResourceTags.NonHiddenDefaultTags({
          excludeAnnotations: true
        }),
        SearchResourceTags.NotExists(ResourceTagsBuiltInKeys.EMPTY_RESOURCE),
        ...(search.tags ?? [])
      ], {
        ...search.parameters,
        spaceId: notebookId,
      })

      log.debug('Notebook search results', results)

      searchResults = results.resources
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        // Map to NoteobokEntry format for compatability with the contents directly
        .map((entry, i) => ({
          id: i,
          entry_id: entry.resource.id,
          resource_type: entry.resource.type
        }))

      log.debug('Mapped notebook search results', searchResults)
    } catch (error) {
      log.error('Error running notebook search', error)
    } finally {
      searching = false
      isLoading = false
    }
  }, 250)

  $effect(() => {
    if (search && search.query) {
      runQuery(search)
    } else {
      cancelQuery()
      searchResults = undefined
      searching = false
    }
  })

  const load = useThrottle(async () => {
    try {
      isLoading = true
      log.debug('Loading notebook', notebookId)
      const _notebook = await notebookManager.getNotebook(notebookId)
      if (fetchContents) {
        _notebook.fetchContents({
          sort_by: 'resource_updated',
          order: 'desc',
        })
      }

      log.debug('Loaded notebook', _notebook)

      notebook = _notebook
    } catch (error) {
      log.error('Error loading notebook', error)
    } finally {
      isLoading = false
    }
  }, 250)

  const init = async () => {
    isLoading = true
    
    if (search && search.query) {
      await runQuery(search)
    }

    await load()
  }

  init()

  onMount(() => {
    const unsubs = [
      notebookManager.on(NotebookManagerEvents.DeletedResource, (resourceId: string) => {
        //notebook.contents = notebook.contents.filter((e) => e.entry_id !== resourceId)
                          notebook?.fetchContents()
        if (searchResults) searchResults = searchResults.filter(e => e.entry_id !== resourceId)
      }),
      notebookManager.on(NotebookManagerEvents.RemovedResources, (_notebookId: string, resourceIds: string[]) => {
                //notebook.contents = notebook.contents.filter((e) => !resourceIds.includes(e.id))
        if (notebookId !== _notebookId) return
                          notebook?.fetchContents()
        if (searchResults) searchResults = searchResults.filter(e => !resourceIds.includes(e.entry_id))
      })
    ]
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
{#if isLoading}
  {@render loading?.()}
{:else}
  {@render children?.([notebook, searchResults, searching])}
{/if}

{#snippet failed(error, reset)}
        <b>crash!?</b>
        <p>{error}</p>
        <button onclick={reset}>reload</button>
{/snippet}
