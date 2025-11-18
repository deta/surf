<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { type Resource } from '@deta/services/resources'
  import { useNotebookManager } from '@deta/services/notebooks'
  import {
    ResourceTagsBuiltInKeys,
    type Option,
    type SFFSResourceTag,
    type SFFSSearchParameters,
    type SFFSPaginatedResult
  } from '@deta/types'
  import { useResourceManager } from '@deta/services/resources'
  import { SearchResourceTags, useCancelableDebounce, useThrottle } from '@deta/utils'
  import { NotebookManagerEvents } from '@deta/services/notebooks'

  interface Search {
    query: string
    tags?: SFFSResourceTag[]
    parameters?: SFFSSearchParameters
  }

  interface PaginationState {
    cursor: string | null
    hasMore: boolean
    isLoadingMore: boolean
  }

  let {
    tags,
    notebookId,
    search,
    pageSize = 50,
    children,
    loading,
    error
  }: {
    tags: SFFSResourceTag[]
    notebookId?: string
    search?: Search
    pageSize?: number
    children: Snippet<
      [
        {
          resources: Resource[]
          searchResults: Option<Resource[]>
          searching: boolean
          pagination: PaginationState
          loadMore: () => Promise<void>
        }
      ]
    >
    loading?: Snippet
    error?: Snippet<[unknown]>
  } = $props()

  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()

  let resources: Resource[] = $state([])
  let searchResults: Option<Resource[]> = $state(undefined)
  let searching: boolean = $state(false)
  let isLoading: boolean = $state(false)

  let pagination: PaginationState = $state({
    cursor: null,
    hasMore: false,
    isLoadingMore: false
  })

  // TODO: fix using 'Drafts' like this
  const spaceId = $derived.by(() => {
    if (notebookId?.toLowerCase() === 'drafts') {
      // in the API an empty spaceId refers to the Drafts space i.e. does not belong to any space)
      return ''
    }
    return notebookId
  })

  const { execute: runQuery, cancel: cancelQuery } = useCancelableDebounce((search: Search) => {
    try {
      searching = true
      isLoading = true
      resourceManager
        .searchResources(
          search.query,
          [
            ...SearchResourceTags.NonHiddenDefaultTags({
              excludeAnnotations: true
            }),
            SearchResourceTags.NotExists(ResourceTagsBuiltInKeys.EMPTY_RESOURCE),
            ...(search.tags ?? [])
          ],
          {
            ...search.parameters,
            spaceId
          }
        )
        .then((results) => {
          searchResults = results.resources.map((e) => e.resource)
          searching = false
        })
    } catch (e) {
      console.error(e)
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

  const loadPage = async (cursor?: string) => {
    const result: SFFSPaginatedResult<Resource> = await resourceManager.listResourcesByTags(
      [
        ...SearchResourceTags.NonHiddenDefaultTags({
          excludeAnnotations: true
        }),
        SearchResourceTags.NotExists(ResourceTagsBuiltInKeys.EMPTY_RESOURCE),
        ...(tags ?? [])
      ],
      {
        limit: pageSize,
        cursor
      },
      {
        includeAnnotations: false,
        spaceId
      }
    )

    return result
  }

  const load = useThrottle(async () => {
    try {
      isLoading = true

      // reset pagination state on fresh load
      pagination.cursor = null
      pagination.hasMore = false

      const result = await loadPage()
      resources = result.items
      pagination.cursor = result.next_cursor
      pagination.hasMore = result.has_more
    } catch (error) {
      console.error('Error loading resources', error)
    } finally {
      isLoading = false
    }
  }, 250)

  const loadMore = async () => {
    if (!pagination.hasMore || pagination.isLoadingMore || !pagination.cursor) {
      return
    }

    try {
      pagination.isLoadingMore = true

      const result = await loadPage(pagination.cursor)
      const newResources = result.items
      resources.push(...newResources)

      pagination.cursor = result.next_cursor
      pagination.hasMore = result.has_more
    } catch (error) {
      console.error('Error loading more resources', error)
    } finally {
      pagination.isLoadingMore = false
    }
  }

  const init = async () => {
    isLoading = true

    await load()

    if (search && search.query) {
      runQuery(search)
    }
  }

  init()

  onMount(() => {
    const unsubs = [
      notebookManager.on(NotebookManagerEvents.DeletedResource, (resourceId: string) => {
        resources = resources.filter((e) => resourceId != e.id)
        if (searchResults) searchResults = searchResults.filter((e) => resourceId != e.id)
      }),
      notebookManager.on(NotebookManagerEvents.RemovedResources, (_, resourceIds: string[]) => {
        resources = resources.filter((e) => !resourceIds.includes(e.id))
        if (searchResults) searchResults = searchResults.filter((e) => !resourceIds.includes(e.id))
      })
    ]
    if (!notebookId) {
      unsubs.push(notebookManager.on(NotebookManagerEvents.AddedResources, () => load()))
    }

    return () => unsubs.forEach((f) => f())
  })
</script>

{#if isLoading || searching}
  {@render loading?.()}
{:else}
  {@render children?.({
    resources,
    searchResults,
    searching,
    pagination,
    loadMore
  })}
{/if}
