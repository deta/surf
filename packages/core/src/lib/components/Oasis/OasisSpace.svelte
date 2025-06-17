<script lang="ts" context="module">
  export type ParsedSourceItem = {
    title: string
    link: string
    comments: string
    pubDate: string
    sourceUrl: string
    rawData: RSSItem
  }
</script>

<script lang="ts">
  import { get, writable, derived } from 'svelte/store'
  import { type ThemeData, getBackgroundImageUrlFromId } from '../../service/colors'

  import {
    useLogScope,
    parseTextIntoISOString,
    checkIfYoutubeUrl,
    isModKeyAndKeyPressed,
    truncate,
    parseStringIntoUrl,
    useDebounce,
    clickOutside,
    tooltip,
    isMac,
    conditionalArrayItem
  } from '@horizon/utils'
  import { OasisSpace, useOasis } from '../../service/oasis'
  import { DynamicIcon, Icon } from '@horizon/icons'
  import { createEventDispatcher, onDestroy, tick } from 'svelte'
  import {
    Resource,
    ResourcePost,
    type ResourceObject,
    type ResourceSearchResultItem,
    type SpaceSearchResultItem
  } from '../../service/resources'
  import OasisResourcesView from './ResourceViews/OasisResourcesView.svelte'
  import {
    DragTypeNames,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    SpaceEntryOrigin,
    type DragTypes,
    type SpaceEntry,
    type SpaceSource
  } from '../../types'
  import DropWrapper from './DropWrapper.svelte'

  import {
    createResourcesFromMediaItems,
    extractAndCreateWebResource,
    processDrop,
    processPaste
  } from '../../service/mediaImporter'

  import { Toast, useToasts } from '../../service/toast'
  import { RSSParser, type RSSItem } from '@horizon/web-parser/src/rss/index'
  import type { ResourceContent } from '@horizon/web-parser'
  import { DragculaDragEvent } from '@horizon/dragcula'
  import type { BrowserTabNewTabEvent } from '../Browser/BrowserTab.svelte'
  import type {
    ChatWithSpaceEvent,
    RenderableItem,
    SpaceEntrySortBy,
    SpaceRenderableItem
  } from '../../types'
  import {
    CreateTabEventTrigger,
    DeleteSpaceEventTrigger,
    EventContext,
    OpenInMiniBrowserEventFrom,
    RefreshSpaceEventTrigger,
    SaveToOasisEventTrigger,
    SearchOasisEventTrigger,
    SummarizeEventContentSource,
    ChangeContextEventTrigger,
    MultiSelectResourceEventAction,
    OpenSpaceEventTrigger
  } from '@horizon/types'
  import PQueue from 'p-queue'
  import { useConfig } from '../../service/config'
  import { sanitizeHTML } from '@horizon/web-parser/src/utils'
  import { useTabsManager } from '../../service/tabs'

  import CreateNewSpace, { type CreateNewSpaceEvents } from './CreateNewSpace.svelte'
  import MiniBrowser from '../MiniBrowser/MiniBrowser.svelte'
  import { useMiniBrowserService } from '@horizon/core/src/lib/service/miniBrowser'
  import ContextTabsBar from './ContextTabsBar.svelte'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { openDialog } from '../Core/Dialog/Dialog.svelte'
  import { isGeneratedResource } from '@horizon/core/src/lib/utils/resourcePreview'
  import ContextLinks from './Scaffolding/ContextLinks.svelte'
  import LazyScroll from '../Utils/LazyScroll.svelte'
  import ContextHeader from './ContextHeader.svelte'
  import OasisSpaceNavbar from './OasisSpaceNavbar.svelte'
  import { useColorService } from '../../service/colors'
  import { useDesktopManager } from '../../service/desktop'
  import type {
    FilterChangeEvent,
    OrderChangeEvent,
    SortByChangeEvent,
    ViewChangeEvent
  } from './SpaceFilterViewButtons.svelte'
  import OasisSpaceUpdateIndicator from './OasisSpaceUpdateIndicator.svelte'
  import OasisSpaceSettings from './Scaffolding/OasisSpaceSettings.svelte'
  import { fly } from 'svelte/transition'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import DesktopPreview from '../Chat/DesktopPreview.svelte'
  import SpaceFilterViewButtons from './SpaceFilterViewButtons.svelte'
  import OasisSpaceEmpty from './OasisSpaceEmpty.svelte'
  import { BuiltInSpaceId, isBuiltInSpaceId } from '../../constants/spaces'
  import { SearchResourceTags, ResourceTag } from '@horizon/core/src/lib/utils/tags'

  export let spaceId: string
  export let active: boolean = false
  export let handleEventsOutside: boolean = false
  export let insideDrawer: boolean = false

  $: isEverythingSpace = spaceId === BuiltInSpaceId.Everything
  $: isAllContextsSpace = spaceId === BuiltInSpaceId.AllSpaces
  $: isNotesSpace = spaceId === BuiltInSpaceId.Notes
  $: isInboxSpace = spaceId === BuiltInSpaceId.Inbox
  $: isPinnedContextsSpace = spaceId === BuiltInSpaceId.PinnedSpaces
  $: isSpaceView = !isBuiltInSpaceId(spaceId)

  const log = useLogScope('OasisSpace')
  const oasis = useOasis()
  const config = useConfig()

  const pinnedSpaces = derived(oasis.sortedSpacesList, ($sortedSpaces) => {
    const spaceMap = new Map()
    $sortedSpaces.pinned.forEach((space) => {
      spaceMap.set(space.id, space)
    })
    return Array.from(spaceMap.values())
  })

  const dispatch = createEventDispatcher<{
    open: string
    'create-resource-from-oasis': string
    'new-tab': BrowserTabNewTabEvent
    'updated-space': string | undefined
    deleted: string
    'go-back': void
    'select-space': string
    'open-space-and-chat': ChatWithSpaceEvent
    'handled-drop': void
    'created-space': OasisSpace
    'open-page-in-mini-browser': string
    'open-in-sidebar': string
    'chat-with-resource': {
      resourceId: string
      trigger: string
    }
    close: void
  }>()
  const toasts = useToasts()
  const tabsManager = useTabsManager()
  const ai = useAI()

  const miniBrowserService = useMiniBrowserService()
  const scopedMiniBrowser = miniBrowserService.createScopedBrowser(`OasisSpace-${spaceId}`)

  const desktopManager = useDesktopManager()
  const colors = useColorService()
  const resourceManager = oasis.resourceManager
  const selectedFilterType = oasis.selectedFilterType
  const telemetry = resourceManager.telemetry

  const userConfigSettings = config.settings

  const searchValue = writable('')
  const selectedItem = writable<string | null>(null)
  const showSettingsModal = writable(false)
  const loadingContents = writable(false)
  const loadingSpaceSources = writable(false)
  const space = writable<OasisSpace | null>(null)
  const oasisRenderableItems = writable<RenderableItem[]>([])

  const REFRESH_SPACE_SOURCES_AFTER = 15 * 60 * 1000 // 15 minutes

  const newlyLoadedResources = writable<string[]>([])
  const processingSourceItems = writable<string[]>([])

  $: spaceData = $space?.data
  $: darkMode = $userConfigSettings.app_style === 'dark'

  $: if (active) {
    setSelectedSpace(spaceId)
    loadSpaceContents(spaceId)
    telemetry.trackOpenOasis()
  }

  $: if (isPinnedContextsSpace && active) {
    pinnedSpaces.subscribe(() => {
      if (active && isPinnedContextsSpace) {
        loadSpaceContents(spaceId, true)
      }
    })
  }

  const setSelectedSpace = async (spaceId: string) => {
    const sp = await oasis.getSpace(spaceId)
    if (!sp) {
      log.error('failed to set selected space with id', spaceId, 'space not found')
      return
    }
    oasis.addToNavigationHistory(spaceId)
    oasis.selectedSpace.set(spaceId)
    space.set(sp)
    await loadSpaceContents(spaceId)
  }

  const navigateToSubSpace = async (e: CustomEvent<string> | string) => {
    const spaceId = typeof e === 'string' ? e : e.detail
    await setSelectedSpace(spaceId)
  }

  const navigateBack = async () => {
    const previousSpaceId = oasis.getPreviousSpaceInNavigationHistory()
    if (previousSpaceId) {
      await oasis.navigateBack()
      await setSelectedSpace(previousSpaceId)
    }
  }

  const filterSpaceEntriesByType = async (
    entries: SpaceEntry[],
    filterTypeId: string | null
  ): Promise<SpaceEntry[]> => {
    if (filterTypeId === null) {
      return entries
    }

    const filteredItems = await Promise.all(
      entries.map(async (item) => {
        if (item.entry_type === 'resource' && filterTypeId !== 'contexts') {
          let type = item.resource_type
          let resource

          if (!type || filterTypeId === 'surflets') {
            resource = await resourceManager.getResource(item.entry_id)
            if (!resource) {
              return false
            }

            type = resource.type
          }

          if (!type) {
            return false
          }
          return matchesFilterType(type, filterTypeId, resource) ? item : false
        } else if (item.entry_type === 'space' && filterTypeId === 'contexts') {
          return item
        } else {
          return false
        }
      })
    )
    return filteredItems.filter((item): item is SpaceEntry => item !== false)
  }

  const filterRenderableItemsByType = async (
    items: RenderableItem[],
    filterTypeId: string | null
  ): Promise<RenderableItem[]> => {
    if (filterTypeId === null) {
      return items
    }

    const filteredItems = await Promise.all(
      items.map(async (item) => {
        if (item.type === 'resource' && filterTypeId !== 'contexts') {
          let resource = item.data

          if (!resource) {
            resource = await resourceManager.getResource(item.id)
            if (!resource) {
              return false
            }
          }

          const type = resource.type
          if (!type) {
            return false
          }

          return matchesFilterType(type, filterTypeId, resource) ? item : false
        } else if (item.type === 'space' && filterTypeId === 'contexts') {
          return item
        } else {
          return false
        }
      })
    )
    return filteredItems.filter(
      (item): item is RenderableItem => item !== false && item !== undefined
    )
  }

  const matchesFilterType = (
    type: string,
    filterTypeId: string,
    resource?: Resource
  ): boolean | SpaceEntry => {
    switch (filterTypeId) {
      case 'media':
        return type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')
      case 'notes':
        return type === ResourceTypes.DOCUMENT_SPACE_NOTE
      case 'files':
        return (
          !type.startsWith('application/vnd.space.') &&
          !type.startsWith('image/') &&
          !type.startsWith('video/') &&
          !type.startsWith('audio/')
        )
      case 'links':
        return type.startsWith('application/vnd.space.')
      case 'surflets':
        return resource ? isGeneratedResource(resource) : false
      default:
        return true
    }
  }

  const loadFilteredContexts = async (query: string, pinned: boolean = false) => {
    const filteredSpaces = await resourceManager.sffs.searchSpaces(query)
    let renderableItems = await Promise.all(
      filteredSpaces.map(async (space) => ({
        id: space.id,
        type: 'space',
        data: space.id ? await oasis.getSpace(space.id) : null
      }))
    )
    if (pinned) {
      renderableItems = renderableItems
        .filter((item) => item.data && item.data.dataValue.pinned)
        .sort((a, b) => a.data!.indexValue - b.data!.indexValue)
    }
    let filteredItems = renderableItems.filter(
      (item): item is SpaceRenderableItem => item.data !== null
    )
    oasisRenderableItems.set([])
    oasisRenderableItems.set(filteredItems)
  }

  const loadAllContexts = async (pinned: boolean = false) => {
    try {
      loadingContents.set(true)

      let spacesData: OasisSpace[] = []
      if (pinned) {
        spacesData = $pinnedSpaces
      } else {
        spacesData = oasis.spacesObjectsValue
      }

      let userSpaces = spacesData.filter((space) => space.dataValue.folderName !== '.tempspace')

      if (pinned) {
        userSpaces = userSpaces.sort((a, b) => {
          return a.indexValue - b.indexValue
        })
      } else {
        userSpaces = userSpaces.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      }
      oasisRenderableItems.set(
        userSpaces.map((space) => ({
          id: space.id,
          type: 'space',
          data: space
        }))
      )
    } catch (error) {
      log.error('Error loading all contexts:', error)
      toasts.error('Failed to load contexts')
    } finally {
      loadingContents.set(false)
    }
  }

  const loadNoteContents = async () => {
    try {
      loadingContents.set(true)

      const tags = SearchResourceTags.NonHiddenDefaultTags().concat([
        SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
      ])

      const resources = await resourceManager.listResourcesByTags(tags)
      const notes = resources
        .sort((a, b) => {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        })
        .map(
          (resource) =>
            ({
              id: resource.id,
              type: 'resource',
              data: resource
            }) as RenderableItem
        )

      oasisRenderableItems.set(notes)
    } catch (error) {
      log.error('Error loading notes:', error)
    } finally {
      loadingContents.set(false)
    }
  }

  const spaceEntriesToRenderableItems = async (
    entries: SpaceEntry[]
  ): Promise<RenderableItem[]> => {
    const promises = entries.map(async (entry) => {
      if (entry.entry_type === 'resource') {
        return {
          id: entry.entry_id,
          type: entry.entry_type,
          data: null
        } as RenderableItem
      } else if (entry.entry_type === 'space') {
        const oasisSpace = await oasis.getSpace(entry.entry_id)
        if (oasisSpace) {
          // @ts-ignore
          return {
            id: entry.entry_id,
            type: entry.entry_type,
            data: oasisSpace
          } as RenderableItem
        }
      }
      return null
    })
    const results = await Promise.all(promises)
    return results.filter((item): item is RenderableItem => item !== null)
  }

  const setSpaceContents = async (folderContents: SpaceEntry[]) => {
    folderContents = folderContents.filter(
      (entry) => entry.manually_added !== SpaceEntryOrigin.Blacklisted
    )
    if (folderContents.length === 0) {
      oasisRenderableItems.set([])
      return
    }
    folderContents = await filterSpaceEntriesByType(folderContents, $selectedFilterType?.id || null)
    const renderableItems = await spaceEntriesToRenderableItems(folderContents)
    if (renderableItems) {
      oasisRenderableItems.set(renderableItems)
    }
  }

  const setRenderableItemsWithFilter = async (
    items: RenderableItem[],
    filterTypeId: string | null = null
  ) => {
    if (!items || items.length === 0) {
      oasisRenderableItems.set([])
      return
    }
    if (filterTypeId !== null) {
      const filteredItems = await filterRenderableItemsByType(items, filterTypeId)
      oasisRenderableItems.set(filteredItems)
    } else {
      oasisRenderableItems.set(items)
    }
  }

  // TODO: contents loading & searching should also be handled by the oasis service
  const loadSpaceContents = async (id: string, skipSources = false) => {
    if ($searchValue) {
      await runSearch()
      return
    }

    if (isEverythingSpace) {
      await loadEverything()
      return
    }
    if (isAllContextsSpace) {
      await loadAllContexts(false)
      return
    }
    if (isPinnedContextsSpace) {
      await loadAllContexts(true)
      return
    }
    if (isNotesSpace) {
      await loadNoteContents()
      return
    }
    if (isInboxSpace) {
      await loadInbox()
      return
    }
    loadingContents.set(true)

    const fetchedSpace = await oasis.getSpace(id)
    if (!fetchedSpace) {
      log.error('Space not found')
      toasts.error('Context not found')
      return
    }

    space.set(fetchedSpace)

    const sortBy = $space?.dataValue.sortBy ?? 'resource_updated'
    const order = $space?.dataValue.sortOrder ?? 'desc'

    const fetchedSpaceData = fetchedSpace.dataValue
    try {
      let folderContents = await oasis.getSpaceContents(id, {
        sort_by: sortBy,
        order: order,
        search_query: $searchValue
      })
      if (folderContents) {
        await setSpaceContents(folderContents)
      }

      if (skipSources) {
        return
      }

      // fetchedSpaceData is already declared above
      let addedResources = 0
      let fetchedSources = false
      let usedSmartQuery = false
      if (fetchedSpaceData.liveModeEnabled) {
        if ((fetchedSpaceData.sources ?? []).length > 0) {
          fetchedSources = true
          const fetchedResources = await loadSpaceSources(fetchedSpaceData.sources!)
          if (fetchedResources) {
            addedResources = fetchedResources.length
          }
        }

        if (fetchedSpaceData.smartFilterQuery) {
          usedSmartQuery = true
          const fetchedResources = await updateLiveSpaceContentsWithAI(
            fetchedSpaceData.smartFilterQuery,
            fetchedSpaceData.sql_query,
            fetchedSpaceData.embedding_query
          )
          if (fetchedResources) {
            addedResources += fetchedResources.length
          }
        }
      }

      if ($newlyLoadedResources.length > 0 && $oasisRenderableItems.length === 0) {
        await loadSpaceContents(spaceId, true)
        newlyLoadedResources.set([])
        processingSourceItems.set([])
      }

      // only track a refresh when one of the smart features is used
      if (fetchedSources || usedSmartQuery) {
        await telemetry.trackRefreshSpaceContent(RefreshSpaceEventTrigger.LiveSpaceAutoRefreshed, {
          usedSmartQuery: usedSmartQuery,
          fetchedSources: fetchedSources,
          addedResources: addedResources > 0
        })
      }
    } catch (error) {
      log.error('Error loading folder contents:', error)
    } finally {
      loadingContents.set(false)
    }
  }

  const loadEverything = async () => {
    try {
      loadingContents.set(true)

      oasisRenderableItems.set([])
      const items = await resourceManager.listAllResourcesAndSpaces(
        SearchResourceTags.NonHiddenDefaultTags()
      )
      if (items) {
        const renderableItems = await Promise.all(
          items.map(async (item) => {
            if (!item) {
              return null
            }
            if (item.type === 'resource') {
              return item
            } else if (item.type === 'space') {
              const oasisSpace = await oasis.getSpace(item.id)
              if (oasisSpace) {
                return {
                  id: item.id,
                  type: item.type,
                  data: oasisSpace
                } as RenderableItem
              }
            }
            return null
          })
        )
        const filtered = renderableItems.filter((item): item is RenderableItem => item !== null)
        await setRenderableItemsWithFilter(filtered, $selectedFilterType?.id || null)
      }
    } catch (error) {
      log.error('Error loading everything:', error)
    } finally {
      loadingContents.set(false)
    }
  }

  const getInboxItems = async () => {
    return await resourceManager.listResourcesByTags(SearchResourceTags.NonHiddenDefaultTags(), {
      excludeWithinSpaces: true
    })
  }

  const loadInbox = async () => {
    try {
      loadingContents.set(true)

      oasisRenderableItems.set([])

      const items = await getInboxItems()
      if (items) {
        const renderableItems = await Promise.all(
          items.map(async (item) => {
            if (!item) {
              return null
            }
            return {
              id: item.id,
              type: 'resource',
              data: item
            } as RenderableItem
          })
        )
        const filtered = renderableItems.filter((item): item is RenderableItem => item !== null)
        await setRenderableItemsWithFilter(filtered, $selectedFilterType?.id || null)
      }
    } catch (error) {
      log.error('Error loading everything:', error)
    } finally {
      loadingContents.set(false)
    }
  }

  const updateLiveSpaceContentsWithAI = async (
    query: string,
    sql_query: string | null,
    embedding_query: string | null
  ) => {
    try {
      loadingSpaceSources.set(true)

      log.debug('AI prompt:', query, sql_query, embedding_query)

      const response = await ai.getResourcesViaPrompt(query, {
        sqlQuery: sql_query || undefined,
        embeddingQuery: embedding_query || undefined
      })
      log.debug('AI response:', response)

      if ($space?.dataValue.sql_query !== response.sql_query) {
        await oasis.updateSpaceData(spaceId, {
          sql_query: response.sql_query,
          embedding_query: response.embedding_search_query ?? undefined
        })
      }

      const results = new Set([
        ...(response.embedding_search_results ?? []),
        ...(response.sql_query_results ?? [])
      ])

      const resourceIds = Array.from(results)

      if (!results) {
        log.debug('No results found')
        toasts.info('No results found')
        return
      }

      const fullSpaceContents = await oasis.getSpaceContents(spaceId)
      const newResults = resourceIds.filter((x) => {
        const entry = fullSpaceContents.find((y) => y.entry_id === x)
        if (!entry) return true

        return entry.manually_added !== SpaceEntryOrigin.Blacklisted
      })

      log.debug('Adding resources to space', newResults)

      newlyLoadedResources.update((resources) => [...resources, ...newResults])

      await oasis.addResourcesToSpace(spaceId, newResults, SpaceEntryOrigin.LlmQuery)
      return newResults
    } catch (error) {
      log.error('Error updating live space contents with AI:', error)
    } finally {
      loadingSpaceSources.set(false)
    }
  }

  const loadSpaceSources = async (sources: SpaceSource[], forceFetch = false) => {
    try {
      loadingSpaceSources.set(true)

      const fetchedSources = await Promise.all(
        sources.map((source) => {
          try {
            if (
              forceFetch ||
              !source.last_fetched_at ||
              new Date().getTime() - new Date(source.last_fetched_at).getTime() >
                REFRESH_SPACE_SOURCES_AFTER
            ) {
              log.debug('Fetching source:', source)
              return fetchSpaceSource(source)
            } else {
              log.debug('Source already fetched recently, skipping:', source)
              return Promise.resolve([])
            }
          } catch (error) {
            log.error('Error loading source:', error)
            toasts.error(`Failed to load source: ${source.url}`)
            return Promise.resolve([])
          }
        })
      )

      const items = fetchedSources.flat()

      if (!items) {
        log.debug('No items found')
        return
      }

      processingSourceItems.set(items.map((x) => x.link))

      const MAX_CONCURRENT_ITEMS = 8
      const PROCESS_TIMEOUT = 1000 * 15 // give each item max 15 seconds to process

      const processedItems: Resource[] = []

      log.debug('Processing items:', items)
      const queue = new PQueue({
        concurrency: MAX_CONCURRENT_ITEMS,
        timeout: PROCESS_TIMEOUT,
        autoStart: false
      })

      items.forEach((item) => {
        queue.add(async () => {
          log.debug('Processing item:', item)
          const resource = await processRSSItem(item)
          log.debug('Processed resource:', resource)

          if (resource) {
            processedItems.push(resource)
          }
        })
      })

      queue.start()

      await queue.onIdle()
      log.debug('Queue finished')

      const resources = processedItems.filter((x) => x !== null) as Resource[]
      log.debug('Parsed resources:', resources)

      if (resources.length > 0) {
        // TODO: when re-enabling live-spaces we need to set if the items are blacklisted or not
        await resourceManager.addItemsToSpace(
          spaceId,
          resources.map((r) => r.id),
          SpaceEntryOrigin.ManuallyAdded
        )
      }
      return resources
    } catch (error) {
      log.error('Error loading space sources:', error)
    } finally {
      loadingSpaceSources.set(false)
    }
  }

  const fetchSpaceSource = async (source: SpaceSource) => {
    source.last_fetched_at = new Date().toISOString()

    space.update((s) => {
      if (!s) {
        return null
      }

      s.dataValue.sources = (s.dataValue.sources ?? []).map((x) =>
        x.id === source.id ? source : x
      )
      return s
    })

    await oasis.updateSpaceData($space!.id, {
      sources: ($space?.dataValue.sources ?? []).map((x) => (x.id === source.id ? source : x))
    })

    const rssResult = await RSSParser.parse(source.url)

    log.debug('RSS result:', rssResult)

    if (!rssResult.items) {
      log.debug('No items found in RSS feed')
      return []
    }

    const MAX_ITEMS = 25

    const filtered = rssResult.items.filter((x) => x.link || x.comments)
    return filtered.slice(0, MAX_ITEMS).map((item) => {
      return {
        title: item.title ? sanitizeHTML(item.title) : undefined,
        link: item.link ? parseStringIntoUrl(item.link)?.href : undefined,
        comments: item.comments ? parseStringIntoUrl(item.comments)?.href : undefined,
        pubDate: (item.pubDate && parseTextIntoISOString(item.pubDate)) || '',
        sourceUrl: source.url,
        rawData: item
      } as ParsedSourceItem
    })
  }

  const processRSSItem = async (item: ParsedSourceItem) => {
    try {
      log.debug('Processing RSS item:', item)

      let sourceURL = new URL(item.sourceUrl)

      // for Hacker News item use the URL of the post as the source URL
      if (sourceURL.hostname === 'news.ycombinator.com' && item.comments) {
        sourceURL = new URL(item.comments)
      }

      const canonicalURL = item.link
      const existingResourceIds = await resourceManager.listResourceIDsByTags([
        SearchResourceTags.Deleted(false),
        SearchResourceTags.CanonicalURL(canonicalURL),
        SearchResourceTags.SpaceSource('rss')
      ])

      log.debug('Existing resources:', existingResourceIds)

      if (existingResourceIds.length > 0) {
        const resourceId = existingResourceIds[0]
        log.debug('Resource already exists', resourceId)

        // check if resource is in space
        const resourceInSpace = $oasisRenderableItems.find(
          (x) => x.id === resourceId && x.type === 'resource'
        )
        if (resourceInSpace) {
          log.debug('Resource already in space, skipping')
          return null
        } else {
          log.debug('Resource not in space, adding')
          const resource = await resourceManager.getResource(resourceId)
          if (resource) {
            newlyLoadedResources.update((resources) => [...resources, resource.id])
            return resource
          }
        }
      }

      let parsed: {
        resource: ResourceObject
        content?: ResourceContent
      } | null = null

      if (checkIfYoutubeUrl(sourceURL.href)) {
        log.debug('Youtube video, skipping webview parsing:', item)

        const postData = RSSParser.parseYouTubeRSSItemToPost(item.rawData)
        log.debug('Parsed youtube post data:', postData)

        const resource = await resourceManager.createResource(
          ResourceTypes.POST_YOUTUBE,
          new Blob([JSON.stringify(postData)], { type: 'application/json' }),
          {
            name: postData.title ?? '',
            sourceURI: canonicalURL
          },
          [
            ResourceTag.canonicalURL(canonicalURL),
            ResourceTag.spaceSource('rss'),
            ResourceTag.hideInEverything(),
            ResourceTag.viewedByUser(false),
            ...(postData.date_published
              ? [ResourceTag.sourcePublishedAt(postData.date_published)]
              : [])
          ]
        )

        parsed = {
          resource,
          content: {
            plain: postData.content_plain,
            html: null
          }
        }
      } else {
        parsed = await extractAndCreateWebResource(
          resourceManager,
          item.link ?? item.comments,
          {
            sourceURI: sourceURL.href
          },
          [
            ResourceTag.canonicalURL(canonicalURL),
            ResourceTag.spaceSource('rss'),
            ResourceTag.hideInEverything(),
            ResourceTag.viewedByUser(false),
            ...(item.pubDate ? [ResourceTag.sourcePublishedAt(item.pubDate)] : [])
          ]
        )
      }

      try {
        let contentToSummarize: string | null = null
        if (parsed.resource.type === ResourceTypes.POST_YOUTUBE) {
          const data = await (parsed.resource as ResourcePost).getParsedData()
          log.debug('Getting transcript for youtube video:', data.url)
          const transcriptData = await resourceManager.sffs.getAIYoutubeTranscript(data.url)
          log.debug('transcript:', transcriptData)

          if (transcriptData) {
            contentToSummarize = transcriptData.transcript
          }
        } else if (parsed.content && (parsed.content.plain || parsed.content.html)) {
          contentToSummarize = parsed.content.plain || parsed.content.html
        }

        if (contentToSummarize) {
          log.debug('Summarizing content:', truncate(contentToSummarize, 100))
          const completion = await ai.summarizeText(contentToSummarize, {
            systemPrompt:
              'Summarize the given text into a single paragraph with a maximum of 400 characters. Make sure you are still conveying the main idea of the text while keeping it concise. If possible try to be as close to 400 characters as possible. Do not go over 400 characters in any case.',
            context: EventContext.Space,
            contentSource: SummarizeEventContentSource.Resource
          })

          if (completion.error) {
            log.error('Error generating AI output', completion.error)
            return null
          }

          let summary = completion.output

          log.debug('summary:', summary)

          if (summary) {
            log.debug('updating resource metadata with summary:', summary)
            await resourceManager.updateResourceMetadata(parsed.resource.id, {
              userContext: summary
            })
          } else {
            log.debug('summary generation failed')
          }
        }
      } catch (error) {
        log.error('Error summarizing content:', error)
      }

      newlyLoadedResources.update((resources) => [...resources, parsed.resource.id])

      log.debug('Created RSS resource:', parsed.resource)
      return parsed.resource
    } catch (error) {
      log.error('Error processing RSS item:', error)
      return null
    }
  }

  const handlePin = async (e: CustomEvent) => {
    try {
      const id = e.detail
      const space = await oasis.getSpace(id)
      if (space) {
        const lastPinnedIndex = oasis.sortedSpacesListValue.pinned.length
        await space.updateData({ pinned: true })
        await oasis.moveSpaceToIndex(id, lastPinnedIndex)
        if (isPinnedContextsSpace) {
          loadSpaceContents(spaceId, true)
        }
      }
    } catch (error) {
      log.error('Failed to pin Space:', error)
    }
  }

  const handleUnpin = async (e: CustomEvent) => {
    try {
      const id = e.detail
      const space = await oasis.getSpace(id)
      if (space) {
        await space.updateData({ pinned: false })
        if (isPinnedContextsSpace) {
          loadSpaceContents(spaceId, true)
        }
      }
    } catch (error) {
      log.error('Failed to unpin Space:', error)
    }
  }

  const handleRefreshLiveSpace = async () => {
    if (!$space) {
      log.error('No space found')
      return
    }

    if ($newlyLoadedResources.length > 0) {
      log.debug('Newly loaded resources found, skipping refresh')
      await loadSpaceContents(spaceId, true)
      newlyLoadedResources.set([])
      processingSourceItems.set([])
      return
    }

    let addedResources = 0
    if ($space.dataValue.smartFilterQuery) {
      const fetchedResources = await updateLiveSpaceContentsWithAI(
        $space.dataValue.smartFilterQuery,
        $space.dataValue.sql_query,
        $space.dataValue.embedding_query
      )
      if (fetchedResources) {
        addedResources = fetchedResources.length
      }
    }

    const sources = $space.dataValue.sources
    if (sources && sources.length > 0) {
      const fetchedResources = await loadSpaceSources(sources, true)
      if (fetchedResources) {
        addedResources += fetchedResources.length
      }
    } else {
      log.debug('No sources found')
    }

    if ($newlyLoadedResources.length > 0) {
      await loadSpaceContents(spaceId, true)
      newlyLoadedResources.set([])
      processingSourceItems.set([])
    }

    await telemetry.trackRefreshSpaceContent(RefreshSpaceEventTrigger.LiveSpaceManuallyRefreshed, {
      usedSmartQuery: !!$space.dataValue.smartFilterQuery,
      fetchedSources: !!sources,
      addedResources: addedResources > 0
    })
  }

  const handleEscKey = () => {
    searchValue.set('')
  }

  // TODO: a more efficient way to do this
  const searchResultsToRenderableItems = async (
    resources: ResourceSearchResultItem[],
    spaces: SpaceSearchResultItem[]
  ) => {
    const resourceItems = await Promise.all(
      resources.map(async (item) => ({
        id: item.id,
        type: 'resource',
        data: await resourceManager.getResource(item.id)
      }))
    )

    const spaceItems = await Promise.all(
      spaces.map(async (item) => ({
        id: item.id,
        type: 'space',
        data: await oasis.getSpace(item.id)
      }))
    )
    const allItems = [...resourceItems, ...spaceItems]
    const filteredItems = allItems.filter((item): item is RenderableItem => item.data !== null)
    return filteredItems
  }

  // TODO: I've put most of the complexity of search and setting the items in this function
  // we have to refactor this later
  const runSearch = useDebounce(async () => {
    try {
      let value = $searchValue

      if (!value) {
        if (isSpaceView) {
          await loadSpaceContents(spaceId)
        } else if (isAllContextsSpace) {
          await loadAllContexts(false)
        } else if (isPinnedContextsSpace) {
          await loadAllContexts(true)
        } else if (isNotesSpace) {
          await loadNoteContents()
        } else if (isEverythingSpace) {
          await loadEverything()
        } else if (isInboxSpace) {
          await loadInbox()
        }
        return
      }

      loadingContents.set(true)
      const hashtagMatch = value.match(/#[a-zA-Z0-9]+/g)
      const hashtags = hashtagMatch ? hashtagMatch.map((x) => x.slice(1)) : []

      // if all words are hashtags, clear the search
      if (hashtags.length === value.split(' ').length) {
        value = ''
      }

      await telemetry.trackSearchOasis(SearchOasisEventTrigger.Oasis, !isEverythingSpace)

      if (isAllContextsSpace) {
        loadFilteredContexts(value, false)
        return
      }
      if (isPinnedContextsSpace) {
        loadFilteredContexts(value, true)
        return
      }

      // TODO: this behavior should just be managed by oasis service
      let searchInSpace: string | undefined = spaceId
      if (isBuiltInSpaceId(searchInSpace)) {
        searchInSpace = undefined
      }
      const result = await resourceManager.searchResources(
        value,
        [
          SearchResourceTags.Deleted(false),
          SearchResourceTags.ResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          SearchResourceTags.NotExists(ResourceTagsBuiltInKeys.SILENT),
          ...hashtags.map((x) => SearchResourceTags.Hashtag(x)),
          ...conditionalArrayItem(isNotesSpace, [
            SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
          ])
        ],
        {
          semanticEnabled: $userConfigSettings.use_semantic_search,
          spaceId: searchInSpace
        }
      )
      // TODO: this is bad, we should use resource tags to indicate if a resource is in a space
      if (isInboxSpace) {
        const inboxItems = await getInboxItems()
        if (!inboxItems) {
          oasisRenderableItems.set([])
          return
        }
        const inboxItemIds = inboxItems.map((x) => x.id)
        result.resources = result.resources.filter((x) => inboxItemIds.includes(x.id))
      }
      if (result.space_entries) {
        await setSpaceContents(result.space_entries)
      } else {
        const items = await searchResultsToRenderableItems(result.resources, result.spaces)
        await setRenderableItemsWithFilter(items, $selectedFilterType?.id || null)
      }
    } catch (error) {
      log.error('Error searching:', error)
    } finally {
      loadingContents.set(false)
    }
  }, 500)

  const handleBatchRemove = async (
    e: CustomEvent<{ resourceIds: string[]; spaceIds: string[]; deleteFromStuff: boolean }>
  ) => {
    const resourceIds = e.detail.resourceIds || []
    const spaceIds = e.detail.spaceIds || []
    const deleteFromStuff = e.detail.deleteFromStuff

    const totalItems = resourceIds.length + spaceIds.length
    if (totalItems === 0) {
      return
    }

    const titlePrefix = deleteFromStuff ? 'Delete' : 'Unlink'

    const confirmMessage = deleteFromStuff
      ? `Are you sure you want to delete ${totalItems} Item${totalItems > 1 ? 's' : ''} from your Stuff?`
      : `Are you sure you want to unlink ${totalItems} Item${totalItems > 1 ? 's' : ''} from this Context?`
    const { closeType: confirmed } = await openDialog({
      title: `${titlePrefix} ${totalItems} Item${totalItems > 1 ? 's' : ''}`,
      message: confirmMessage,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Remove', type: 'submit', kind: 'danger' }
      ]
    })

    if (!confirmed) {
      return
    }
    try {
      if (resourceIds.length > 0) {
        await oasis.removeResourcesFromSpaceOrOasis(
          resourceIds,
          deleteFromStuff ? undefined : spaceId,
          false
        )
      }
      if (spaceIds.length > 0) {
        if (deleteFromStuff) {
          for (const id of spaceIds) {
            await oasis.deleteSpace(id)
            await tabsManager.removeSpaceTabs(id)
            await telemetry.trackDeleteSpace(DeleteSpaceEventTrigger.SpacesView)
          }
        } else {
          const parentId = spaceId // this is a top level variable
          await oasis.removeSpacesFromNestedSpace(parentId, spaceIds, false)
          await telemetry.trackMultiSelectResourceAction(
            MultiSelectResourceEventAction.Delete,
            1,
            'space'
          )
        }
      }
      toasts.success(deleteFromStuff ? 'Items deleted!' : 'Items removed!')
      loadSpaceContents(spaceId)
    } catch (error: any) {
      log.error('Error removing resources or space ids:', error)
      toasts.error(`Failed to remove items: ${error}`)
    }
  }

  const handleResourceRemove = async (
    e: CustomEvent<{ ids: string | string[]; deleteFromStuff: boolean }>
  ) => {
    log.debug('Removing resources:', e.detail)
    const ids = e.detail.ids
    const deleteFromStuff = e.detail.deleteFromStuff

    try {
      const res = await oasis.removeResourcesFromSpaceOrOasis(
        ids,
        deleteFromStuff ? undefined : spaceId
      )
      if (!res) {
        return
      }

      toasts.success(
        `${res.length > 1 ? res.length : ''} Resource${res.length > 1 ? 's' : ''} ${isEverythingSpace ? 'deleted' : 'removed'}!`
      )

      // HACK: this is needed for the preview to update with the summary
      const contents = $oasisRenderableItems.filter((x) => !ids.includes(x.id))
      oasisRenderableItems.set([])
      await tick()
      oasisRenderableItems.set(contents)
    } catch (e: any) {
      toasts.error(e.toString())
      throw e
    }
  }

  const handleItemOpen = (e: CustomEvent<string>) => {
    log.debug('Opening resource item:', e.detail)
    const resourceId = e.detail
    scopedMiniBrowser.openResource(resourceId, {
      from: OpenInMiniBrowserEventFrom.Oasis
    })
  }

  const handleOpenInSidebar = (e: CustomEvent<string>) => {
    log.debug('Opening resource in sidebar:', e.detail)
    dispatch('open-in-sidebar', e.detail)
  }

  const handleItemClick = async (e: CustomEvent<string>) => {
    log.debug('Item clicked:', e.detail)
    selectedItem.set(e.detail)
  }

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (!active) {
      return
    }

    log.debug('Key down:', e.key)
    if (e.key === 'Escape') {
      e.preventDefault()
      handleEscKey()
    } else if (
      e.key === ' ' &&
      $selectedItem &&
      !get(scopedMiniBrowser.isOpen) &&
      !$showSettingsModal
    ) {
      e.preventDefault()
      openResourceDetailsModal($selectedItem)
    } else if (
      isModKeyAndKeyPressed(e, 'Enter') &&
      $selectedItem &&
      !get(scopedMiniBrowser.isOpen)
    ) {
      e.preventDefault()

      const resource = await resourceManager.getResource($selectedItem)
      if (!resource) return

      const url = resource.metadata?.sourceURI
      if (!url) return

      tabsManager.addPageTab(url, {
        active: e.shiftKey,
        trigger: CreateTabEventTrigger.OasisItem
      })
    }
  }

  const handleDrop = async (event: CustomEvent | DragculaDragEvent<DragTypes>) => {
    // Handle both CustomEvent and DragculaDragEvent
    const drag = 'item' in event ? event : event.detail

    log.debug('dropping onto DropWrapper', drag, ' | ', drag.from?.id, ' >> ', drag.to?.id, ' | ')
    log.debug('Current space ID:', spaceId)
    log.debug('Drag item data:', drag.item?.data)

    if (drag.from?.id === drag.to?.id) {
      log.debug('Drag from and to are the same, aborting drop')
      return
    }

    // Check if this is a space being dropped
    if (drag.item?.data.hasData(DragTypeNames.SURF_SPACE)) {
      const droppedSpace = drag.item.data.getData(DragTypeNames.SURF_SPACE) as OasisSpace

      // Don't allow dropping a space onto itself
      if (droppedSpace.id === spaceId) {
        return
      }

      try {
        const droppedFolderName = droppedSpace.dataValue.folderName
        const folderNameSuffix = `in ${$spaceData?.folderName}` || ''

        // Move the space into this folder
        await oasis.nestSpaceWithin(droppedSpace.id, spaceId)
        toasts.success(`Created a link to '${droppedFolderName}' '${folderNameSuffix}'`)

        // Stop propagation for folder nesting drops
        drag.stopPropagation()
      } catch (error) {
        log.error('Error moving space:', error)
        toasts.error('Error moving space')
      }

      return
    }

    // Handle other types of drops (files, resources, etc.)
    const toast = toasts.loading(`Copying to context...`)

    if (drag.isNative) {
      dispatch('handled-drop')
      const parsed = await processDrop(drag.event!)
      log.debug('Parsed', parsed)

      const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '', [
        ResourceTag.dragLocal()
      ])
      log.debug('Resources', newResources)

      await oasis.addResourcesToSpace(
        spaceId,
        newResources.map((r) => r.id),
        SpaceEntryOrigin.ManuallyAdded
      )

      for (const r of newResources) {
        telemetry.trackSaveToOasis(r.type, SaveToOasisEventTrigger.Drop, false)
      }

      await loadSpaceContents(spaceId)
    } else if (
      drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE) ||
      drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
    ) {
      let resource: Resource | null = null
      if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE)) {
        resource = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE)
      } else if (drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)) {
        const resourceFetcher = drag.item!.data.getData(DragTypeNames.ASYNC_SURF_RESOURCE)
        resource = await resourceFetcher()
      }

      if (resource === null) {
        log.warn('Dropped resource but resource is null! Aborting drop!')
        drag.abort()
        return
      }

      await oasis.addResourcesToSpace(spaceId, [resource.id], SpaceEntryOrigin.ManuallyAdded)

      await loadSpaceContents(spaceId)
    }
    /* TODO: See if this is relevant.. is there a case whwere a tab would be prefeered instead of just handling the rosurce directory?

    else if (drag.item!.data.hasData(DragTypeNames.SURF_TAB)) {
      const droppedTab = drag.item!.data.getData(DragTypeNames.SURF_TAB)
    }
    }*/

    drag.continue()
    toast.success(`Resources saved to Context!`)
  }

  const handleDeleteAutoSaved = async () => {
    const { closeType: confirmed } = await openDialog({
      message: 'Are you sure you want to delete all auto-saved resources from Your Stuff?'
    })
    if (!confirmed) {
      return
    }

    showSettingsModal.set(false)

    const toast = toasts.loading('Deleting auto-saved resources…')

    const resources = await resourceManager.listResourceIDsByTags([
      SearchResourceTags.Silent(),
      SearchResourceTags.Deleted(false)
    ])

    log.debug('Deleting auto-saved resources:', resources)

    await resourceManager.deleteResources(resources)

    toast.success('Auto-saved resources deleted!')

    await loadEverything()
  }

  const handleClearSpace = async () => {
    if (!$space) {
      log.error('No space found')
      return
    }

    const { closeType: confirmed } = await openDialog({
      message: 'Are you sure you want to clear all resources from this space?'
    })

    if (!confirmed) {
      return
    }

    showSettingsModal.set(false)

    const resources = await oasis.getSpaceContents($space.id)
    await oasis.removeResourcesFromSpace(
      $space.id,
      resources.map((x) => x.id),
      false
    )

    toasts.success('Context cleared!')

    await loadSpaceContents($space.id, true)
  }

  export const handleDeleteSpace = async (
    shouldDeleteAllResources: boolean = false,
    abortSpaceCreation: boolean = false
  ) => {
    const { closeType: confirmed } = await openDialog({
      message: abortSpaceCreation
        ? 'Are you sure you want to abort the creation of this context?'
        : shouldDeleteAllResources
          ? 'Are you sure you want to delete this context and all of its resources?'
          : 'Are you sure you want to delete this context?',
      actions: abortSpaceCreation
        ? undefined
        : [
            { title: 'Cancel', type: 'reset' },
            { title: 'Delete', type: 'submit', kind: 'danger' }
          ]
    })

    if (!confirmed) {
      return false
    }

    let toast
    if (!abortSpaceCreation) {
      toast = toasts.loading('Deleting space…')
    }

    showSettingsModal.set(false)

    try {
      if (shouldDeleteAllResources) {
        log.debug('Deleting all resources in space', spaceId)
        const resources = await oasis.getSpaceContents($space!.id)
        await resourceManager.deleteResources(resources.map((x) => x.entry_id))
      }

      log.debug('Deleting space', spaceId)
      await oasis.deleteSpace(spaceId)

      await tabsManager.removeSpaceTabs(spaceId)

      if ($spaceData?.folderName !== '.tempspace')
        telemetry.trackDeleteSpace(DeleteSpaceEventTrigger.SpaceSettings)

      return true
    } catch (error) {
      log.error('Error deleting space:', error)
      if (!abortSpaceCreation) {
        toast?.error(
          'Error deleting context: ' +
            (typeof error === 'string' ? error : (error as Error).message)
        )
      }
    }
  }

  const handleLoadSpace = () => {
    loadSpaceContents(spaceId)
  }

  const openResourceDetailsModal = (resourceId: string) => {
    scopedMiniBrowser.openResource(resourceId, {
      from: OpenInMiniBrowserEventFrom.Oasis
    })
  }

  const handleItemOpenAndChat = (e: CustomEvent<{ resource: Resource }>) => {
    const { resource } = e.detail
    dispatch('chat-with-resource', {
      resourceId: resource.id,
      trigger: EventContext.Space
    })
  }

  const handleUseAsContext = (e: CustomEvent<string>) => {
    const spaceId = e.detail
    log.debug('Opening space as context:', spaceId)
    tabsManager.changeScope(spaceId, ChangeContextEventTrigger.SpaceInOasis)
  }

  const handleFolderDrop = async (event: CustomEvent) => {
    // Log the event to debug what's being received
    log.debug('Folder drop event received:', event)

    // If the event has null detail, it's likely that the action was already handled
    // in the Folder component directly, so we can just return
    if (!event.detail) {
      log.debug('Drop event with null detail - action likely already handled in Folder component')
      return
    }

    // The event structure might vary depending on how it's forwarded through components
    let drag, targetSpaceId

    // Try to extract the drag and targetSpaceId from different possible event structures
    if (event.detail && event.detail.drag && event.detail.spaceId) {
      // Direct event from Folder component
      drag = event.detail.drag
      targetSpaceId = event.detail.spaceId
    } else if (
      event.detail &&
      event.detail.detail &&
      event.detail.detail.drag &&
      event.detail.detail.spaceId
    ) {
      // Event forwarded through OasisResourceLoader
      drag = event.detail.detail.drag
      targetSpaceId = event.detail.detail.spaceId
    } else {
      log.debug(
        'Drop event with unexpected structure - action likely already handled in Folder component'
      )
      return
    }

    if (!drag || !targetSpaceId) {
      log.error('Missing drag or target space ID in drop event:', event.detail)
      toasts.error('Error processing drop: Missing data')
      return
    }

    try {
      // Check if the drag contains a space
      if (drag.item!.data.hasData(DragTypeNames.SURF_SPACE)) {
        const droppedSpace = drag.item!.data.getData(DragTypeNames.SURF_SPACE) as OasisSpace

        if (!droppedSpace) {
          return
        }

        if (droppedSpace.id === targetSpaceId) {
          return
        }

        const targetSpace = await oasis.getSpace(targetSpaceId)
        const folderNameSuffix = targetSpace?.dataValue.folderName
          ? `in (${targetSpace.dataValue.folderName})`
          : ''

        // When dragging from the current space view, we know the source space ID is the current space
        const success = await oasis.nestSpaceWithin(droppedSpace.id, targetSpaceId)
        if (success) {
          // reload the current space contents
          await loadSpaceContents(spaceId)
          toasts.success(
            `Created a link to '${droppedSpace.dataValue.folderName}' ${folderNameSuffix}`
          )
        } else {
          toasts.error('')
        }
      } else if (
        drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE) ||
        drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
      ) {
        let resource: Resource | null = null

        if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE)) {
          resource = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE)
        } else if (drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)) {
          const resourceFetcher = drag.item!.data.getData(DragTypeNames.ASYNC_SURF_RESOURCE)
          resource = await resourceFetcher()
        }

        if (resource === null) {
          log.warn('Dropped resource but resource is null! Aborting drop!')
          drag.abort()
          return
        }

        // When dragging from the current space view, we know the source space ID is the current space
        const sourceSpaceId = spaceId
        const success = await oasis.moveResourceToSpace(resource.id, targetSpaceId, sourceSpaceId)
        if (success) {
          toasts.success(`Moved item`)
        } else {
          toasts.error('Failed to item')
        }
        await loadSpaceContents(spaceId)
      }
    } catch (error) {
      log.error('Error in handleFolderDrop:', error)
      toasts.error('Error processing drop')
    }
  }

  const handleOpenSpaceAsTab = async (e: CustomEvent<{ space: OasisSpace; active: boolean }>) => {
    const { space, active } = e.detail
    log.debug('Opening space as tab:', space.id, active)

    await tabsManager.addSpaceTab(space, { active: true })

    await tick()

    await telemetry.trackOpenSpace(OpenSpaceEventTrigger.SpacesView, {
      isLiveSpace: space.dataValue.liveModeEnabled,
      hasSources: (space.dataValue.sources ?? []).length > 0,
      hasSmartQuery: !!space.dataValue.smartFilterQuery
    })
    dispatch('close')
  }

  const handleOpenSpaceAndChat = (e: CustomEvent<{ spaceId: string }>) => {
    const { spaceId } = e.detail
    log.debug('Opening space in chat:', spaceId)
    dispatch('open-space-and-chat', { spaceId })
    dispatch('close')
  }

  const handleUpdateExistingSpace = async (
    e: CustomEvent<CreateNewSpaceEvents['update-existing-space']>
  ) => {
    const {
      space,
      name,
      colors,
      emoji,
      imageIcon,
      processNaturalLanguage,
      userPrompt,
      blacklistedResourceIds,
      llmFetchedResourceIds
    } = e.detail
    if (!space) {
      log.error('No space found')
      return
    }

    let createdSpace: OasisSpace | null = null

    try {
      await oasis.deleteSpace(space.id)

      createdSpace = await oasis.createSpace({
        ...space.dataValue,
        colors: colors,
        emoji: emoji,
        imageIcon: imageIcon,
        folderName: name,
        smartFilterQuery: processNaturalLanguage ? userPrompt : undefined,
        pinned: true // Automatically pin the newly created context
      })

      dispatch('created-space', createdSpace)

      if (blacklistedResourceIds && blacklistedResourceIds.length > 0) {
        await oasis.addResourcesToSpace(
          createdSpace.id,
          blacklistedResourceIds,
          SpaceEntryOrigin.Blacklisted
        )
        log.debug('Blacklisted resources added to space:', blacklistedResourceIds)
      }
      if (llmFetchedResourceIds && llmFetchedResourceIds.length > 0) {
        await oasis.addResourcesToSpace(
          createdSpace.id,
          llmFetchedResourceIds,
          SpaceEntryOrigin.LlmQuery
        )
        log.debug('LLM fetched resources added to space:', llmFetchedResourceIds)
      }

      await loadSpaceContents(createdSpace.id)
      showSettingsModal.set(false)
      toasts.success('Created New Context!')

      dispatch('select-space', createdSpace.id)
    } catch (error) {
      log.error('Error updating space:', error)
      toasts.error('Failed to update context: ' + (error as Error).message)
    }

    dispatch('updated-space', createdSpace?.id)
  }

  const handleAbortSpaceCreation = async (e: CustomEvent<string>) => {
    const spaceId = e.detail
    const wasDeleted = await handleDeleteSpace(false, true)

    if (!wasDeleted) {
      log.debug('Space creation aborted:', spaceId)
    }
  }

  const handleChatWithSpace = () => {
    if (!$space) return

    dispatch('open-space-and-chat', { spaceId: $space.id, text: $searchValue })
    dispatch('close')
    searchValue.set('')
  }

  const handleOpenPageMiniBrowser = async (e: CustomEvent<string>) => {
    const url = e.detail
    log.debug('Open page mini browser', url)

    if (handleEventsOutside) {
      dispatch('open-page-in-mini-browser', url)
    } else {
      scopedMiniBrowser.openWebpage(url, { from: OpenInMiniBrowserEventFrom.PinnedTab })
    }
  }
  const handleViewSettingsChanges = async (e: CustomEvent<ViewChangeEvent>) => {
    const { viewType, viewDensity } = e.detail

    if (!$space) return

    const prevViewType = $spaceData?.viewType
    const prevViewDensity = $spaceData?.viewDensity

    await $space.updateData({ viewType, viewDensity })

    if (viewType !== undefined && prevViewType !== viewType) {
      telemetry.trackUpdateSpaceSettings({
        setting: 'view_type',
        change: viewType
      })
    }
    if (viewDensity !== undefined && prevViewDensity !== viewDensity) {
      telemetry.trackUpdateSpaceSettings({
        setting: 'view_density',
        change: viewDensity
      })
    }
  }

  const handleFilterSettingsChanged = (e: CustomEvent<FilterChangeEvent>) => {
    log.debug('Filter type change:', e.detail)
    oasis.selectedFilterTypeId.set(e.detail.filter?.id ?? null)
    loadSpaceContents(spaceId, true)
  }

  const handleSortBySettingsChanged = async (e: CustomEvent<SortByChangeEvent>) => {
    const { sortBy } = e.detail

    if (!$space) return

    const prevSortby = $spaceData?.sortBy

    await $space.updateData({ sortBy: sortBy as SpaceEntrySortBy })
    loadSpaceContents(spaceId, true)

    if (prevSortby !== sortBy) {
      telemetry.trackUpdateSpaceSettings({
        setting: 'sort_by',
        change: sortBy
      })
    }
  }

  const handleOrderSettingsChanged = async (e: CustomEvent<OrderChangeEvent>) => {
    const { order } = e.detail

    if (!$space) return

    const prevOrder = $spaceData?.sortOrder

    // TODO: Typing we dont expose a type for the sort exactly so this is scudffed
    await $space.updateData({ sortOrder: order })
    loadSpaceContents(spaceId, true)

    if (prevOrder !== order) {
      telemetry.trackUpdateSpaceSettings({
        setting: 'sort_order',
        change: order
      })
    }
  }

  const handleReload = async () => {
    await loadSpaceContents(spaceId, true)
  }

  const handlePaste = async (e: ClipboardEvent) => {
    const target = e.target as HTMLElement
    const isFocused = target === document.activeElement

    if (
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.getAttribute('contenteditable') === 'true') &&
      isFocused
    ) {
      log.debug('Ignoring paste event in input field or editable content')
      return
    }

    let toast: Toast | null

    log.debug('Handling paste event')

    try {
      // Check if we have items in our clipboard service first
      const clipboardContent = oasis.clipboardService.getClipboardContent()

      if (clipboardContent) {
        log.debug('clipboard service already has content, skipping paste handling here')
        return
      }
      const mediaItems = (await processPaste(e)).filter((item) => item.type !== 'text')
      if (mediaItems.length === 0) {
        log.debug('No valid media items found in paste event')
        return
      }

      toast = toasts.loading(
        `Importing ${mediaItems.length} item${mediaItems.length > 1 ? 's' : ''}…`
      )

      const resources = await createResourcesFromMediaItems(
        resourceManager,
        mediaItems,
        `Imported at ${new Date().toLocaleString()}`,
        [ResourceTag.paste()]
      )

      await $space?.addResources(
        resources.map((e) => e.id),
        SpaceEntryOrigin.ManuallyAdded
      )
      if ($space?.id) {
        oasis.reloadSpace($space.id)
      }
      toast?.success(`Imported ${mediaItems.length} item${mediaItems.length > 1 ? 's' : ''}!`)
    } catch (e) {
      toasts.error('Could not import item(s)!')
    }
  }

  onDestroy(
    oasis.on('reload-space', (id: string) => {
      if (id !== spaceId) return
      loadSpaceContents(spaceId, true)
    })
  )

  // Extract theme data for this context hacky till i get saround to refactoring the theming shit
  const theme = writable<ThemeData | undefined>(undefined)
  const calcThemeColors = (darkMode: boolean) => {
    desktopManager.getDesktopThemeData(spaceId).then((data) => {
      const themeData: ThemeData = { colors: { base: '', contrast: '' } }
      if (data && data.colorPalette) {
        const colorData =
          colors.calculateColors(data.colorPalette.at(darkMode ? -1 : 0) || [0, 0, 0], darkMode) ??
          undefined
        themeData.colors!.contrast = colorData.contrastColor
        themeData.colors!.base = colorData.color
        themeData.backgroundImage = data.resourceId
      } else {
        themeData.colors!.contrast = darkMode ? 'hsl(212, 92%, 92%)' : 'hsl(212, 92%, 8%)'
        themeData.colors!.base = '#808080'
        themeData.backgroundImage = getBackgroundImageUrlFromId(undefined, darkMode)
      }

      theme.set(themeData)
    })
  }

  $: calcThemeColors($userConfigSettings.app_style === 'dark')

  onDestroy(
    desktopManager.on('changed-desktop-background', () =>
      calcThemeColors($userConfigSettings.app_style === 'dark')
    )
  )
</script>

<svelte:window on:keydown={handleKeyDown} on:paste={handlePaste} />

{#if $spaceData?.folderName !== '.tempspace'}
  <MiniBrowser service={scopedMiniBrowser} {active} on:seekToTimestamp on:highlightWebviewText />

  <!-- TODO: the oasisRenderableItems should only load additional data from backend on scroll -->
  <div
    class="relative-wrapper"
    style:--background-image={getBackgroundImageUrlFromId($theme?.backgroundImage, darkMode)}
    style:--base-color={$theme?.colors?.base}
    style:--contrast-color={$theme?.colors?.contrast}
  >
    <LazyScroll items={oasisRenderableItems} let:renderedItems>
      {#if $space && $spaceData && $theme !== undefined}
        <OasisSpaceNavbar {searchValue} on:search={runSearch} on:chat={handleChatWithSpace}>
          <svelte:fragment slot="left">
            {#key `${$spaceData.icon}-${$spaceData.imageIcon}-${$spaceData.colors}-${$spaceData.emoji}`}
              <DynamicIcon name={$space.getIconString()} />
            {/key}
            <span class="context-name">{$spaceData.folderName}</span>
          </svelte:fragment>
          <svelte:fragment slot="right">
            {#if !$space.isBuiltInSpace}
              <button
                use:tooltip={{
                  position: 'bottom',
                  text:
                    $searchValue.length > 0
                      ? 'Ask Surf AI about the items in this context'
                      : `Ask Surf AI about the items in this context (${isMac() ? '⌘' : 'ctrl'}+↵)`
                }}
                class="chat-with-space pointer-all"
                class:activated={$searchValue.length > 0}
                on:click={handleChatWithSpace}
              >
                <Icon name="face" size="1.6em" />

                <div class="chat-text">Ask Context</div>
              </button>
            {/if}
          </svelte:fragment>
          <svelte:fragment slot="right-dynamic">
            <!-- TODO: fix sorting for spaces -->
            <SpaceFilterViewButtons
              hideFilterSettings={isNotesSpace || isAllContextsSpace}
              hideSortingSettings={true}
              showContextsFilter={$spaceData?.nestingData?.hasChildren || isEverythingSpace}
              filter={$selectedFilterType?.id ?? null}
              viewType={$spaceData?.viewType}
              viewDensity={$spaceData?.viewDensity}
              sortBy={$spaceData?.sortBy ?? 'resource_added_to_space'}
              order={$spaceData?.sortOrder ?? 'desc'}
              on:changedView={handleViewSettingsChanges}
              on:changedFilter={handleFilterSettingsChanged}
              on:changedSortBy={handleSortBySettingsChanged}
              on:changedOrder={handleOrderSettingsChanged}
            />
          </svelte:fragment>
          <svelte:fragment slot="desktop">
            {#if !$space.isBuiltInSpace && $spaceData?.useAsBrowsingContext}
              <DesktopPreview desktopId={$space.id} />
            {/if}
          </svelte:fragment>
        </OasisSpaceNavbar>

        {#if $userConfigSettings.experimental_context_linking && $space && !$space.isBuiltInSpace}
          <ContextLinks space={$space} />
        {/if}

        <ContextHeader
          bind:headline={$spaceData.folderName}
          bind:description={$spaceData.description}
          headlineEditable={!$space.isBuiltInSpace}
          descriptionEditable={!$space.isBuiltInSpace}
          on:changed-headline={({ detail: headline }) =>
            oasis.updateSpaceData($space.id, { folderName: headline })}
          on:changed-description={({ detail: description }) =>
            oasis.updateSpaceData($space.id, { description })}
        >
          <svelte:fragment slot="breadcrumb">
            {#if isSpaceView && oasis.canNavigateBackValue && insideDrawer}
              <button class="back-button" on:click={navigateBack}>
                <Icon name="arrow.left" size="sm" />
              </button>
            {/if}
          </svelte:fragment>

          <svelte:fragment slot="icon">
            <SpaceIcon folder={$space} interactive={!$space.isBuiltInSpace} size="xl" />
          </svelte:fragment>
          <svelte:fragment slot="headline-content">
            {#if !$space.isBuiltInSpace}
              <button
                class="edit-button"
                on:click={() => ($showSettingsModal = !$showSettingsModal)}
                ><Icon name="settings" size="1.6em" /></button
              >
            {/if}

            <OasisSpaceUpdateIndicator
              {space}
              {newlyLoadedResources}
              {loadingSpaceSources}
              {processingSourceItems}
              on:refresh={handleRefreshLiveSpace}
            />
          </svelte:fragment>
          <svelte:fragment slot="header-content">
            {#if $showSettingsModal && !$space.isBuiltInSpace}
              <div
                class="settings-modal-wrapper"
                transition:fly={{ y: 10, duration: 160 }}
                use:clickOutside={() => ($showSettingsModal = false)}
              >
                <OasisSpaceSettings
                  bind:space={$space}
                  on:refresh={handleRefreshLiveSpace}
                  on:clear={handleClearSpace}
                  on:delete={(e) => handleDeleteSpace(e.detail)}
                  on:load={handleLoadSpace}
                  on:delete-auto-saved={handleDeleteAutoSaved}
                />
              </div>
            {/if}
          </svelte:fragment>
        </ContextHeader>

        <ContextTabsBar
          {spaceId}
          on:open-page-in-mini-browser={handleOpenPageMiniBrowser}
          on:handled-drop
          on:select-space
          on:reload={handleReload}
        />
        {#if $selectedFilterType && $selectedFilterType.id !== null}
          <div
            class="active-filter-indicator bg-[#F7F9FB] dark:bg-gray-900"
            transition:fly={{ y: 5, duration: 160 }}
          >
            <div class="filter-badge">
              <Icon name="filter" size="1em" />
              <span>Filtering by: {$selectedFilterType.label}</span>
              <button
                class="clear-filter-btn"
                on:click={() => {
                  oasis.selectedFilterTypeId.set(null)
                  loadSpaceContents(spaceId, true)
                }}
              >
                <Icon name="close" size="0.9em" />
              </button>
            </div>
          </div>
        {/if}

        <DropWrapper
          {spaceId}
          dragOver={false}
          on:Drop={handleDrop}
          on:dragover={(e) => {
            e.preventDefault()
          }}
          on:DragEnter={(e) => {
            log.debug('Drag enter on OasisSpace:', e)
          }}
          acceptsDrag={(drag) => {
            // Always accept space drops, regardless of what's being viewed
            if (drag.item?.data.hasData(DragTypeNames.SURF_SPACE)) {
              const droppedSpace = drag.item.data.getData(DragTypeNames.SURF_SPACE)
              // Don't accept if trying to drop onto itself
              if (droppedSpace && droppedSpace.id === spaceId) {
                return false
              }
              return true
            }

            // For other types, use the standard checks
            if (
              drag.isNative ||
              drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
              drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
              drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
            ) {
              return true
            }
            return false
          }}
          zonePrefix={insideDrawer ? 'drawer-' : undefined}
        >
          {#if renderedItems}
            <OasisResourcesView
              items={renderedItems}
              {searchValue}
              isInSpace={isSpaceView}
              viewType={$spaceData?.viewType}
              viewDensity={$spaceData?.viewDensity}
              fadeIn
              on:click={handleItemClick}
              on:open={handleItemOpen}
              on:open-and-chat={handleItemOpenAndChat}
              on:open-in-sidebar={handleOpenInSidebar}
              on:navigate-context={navigateToSubSpace}
              on:remove={handleResourceRemove}
              on:batch-remove={handleBatchRemove}
              on:batch-open
              on:create-tab-from-space
              on:changedView={handleViewSettingsChanges}
              on:changedFilter={handleFilterSettingsChanged}
              on:changedSortBy={handleSortBySettingsChanged}
              on:changedOrder={handleOrderSettingsChanged}
              on:space-selected={(e) => navigateToSubSpace(e.detail)}
              on:open-space-as-tab={handleOpenSpaceAsTab}
              on:open-space-and-chat={handleOpenSpaceAndChat}
              on:use-as-context={handleUseAsContext}
              on:Drop={handleFolderDrop}
              on:force-reload={handleReload}
              on:pin={handlePin}
              on:unpin={handleUnpin}
            />
            {#if $loadingContents}
              <div class="floating-loading">
                <Icon name="spinner" size="20px" />
              </div>
            {/if}
          {:else}
            <div class="content-wrapper">
              <div class="content">
                <OasisSpaceEmpty />
              </div>
            </div>
          {/if}
        </DropWrapper>
      {/if}
    </LazyScroll>
  </div>
{:else if $space && $spaceData?.folderName === '.tempspace'}
  <CreateNewSpace
    on:update-existing-space={handleUpdateExistingSpace}
    on:abort-space-creation={handleAbortSpaceCreation}
    on:creating-new-space
    on:done-creating-new-space
    space={$space}
  />
{/if}

<style lang="scss">
  .back-button {
    appearance: none;
    border: none;
    background: none;
    padding: 0.5rem;
    max-width: 2.25rem;
    border-radius: 0.5rem;
    color: var(--contrast-color);
    opacity: 0.7;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms ease;

    &:hover {
      opacity: 1;
      background: rgb(from var(--base-color) r g b / 0.4);
      transform: translateX(-2px);
    }

    :global(.dark) & {
      color: #fff;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }
  }

  .edit-button {
    anchor-name: --edit-button;

    appearance: none;
    display: flex;
    align-items: center;
    padding: 0.5em;
    border-radius: 0.75rem;
    border: none;
    font-size: 0.9rem;
    font-weight: 500;
    letter-spacing: 0.02rem;
    transition-property: color, background, opacity;
    transition-duration: 123ms;
    transition-timing-function: ease-out;

    opacity: 0.7;
    color: rgb(from var(--contrast-color) r g b / 1);

    &:hover {
      color: #0369a1;
      background: rgb(232, 238, 241);
      color: var(--contrast-color);
      background: rgb(from var(--base-color) r g b / 0.4);
      opacity: 1;
    }
  }

  :global(nav.context-navbar .chat-with-space),
  :global(nav.context-navbar .context-toggle-button) {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    appearance: none;
    padding: 0.5em;
    border-radius: 0.75rem;
    border: none;
    font-size: 0.9rem;
    font-weight: 500;
    transition-property: color, background, opacity;
    transition-duration: 123ms;
    transition-timing-function: ease-out;

    opacity: 0.7;

    &:hover {
      color: #0369a1;
      background: rgb(232, 238, 241);
      color: var(--contrast-color);
      background: rgb(from var(--base-color) r g b / 0.4);
      opacity: 1;
    }
  }

  :global(nav.context-navbar .context-toggle-button) {
    margin-left: 0.5em;
  }

  .settings-modal-wrapper {
    position: fixed;
    position-anchor: --edit-button;
    top: calc(anchor(end) + 0.75rem);
    left: calc(anchor(start));
    z-index: 10000000000000000;
  }

  .content-wrapper {
    position: relative;
    width: 100%;
    height: -webkit-fill-available;
    display: flex;
    align-items: center;
    justify-content: center;

    .content {
      position: absolute;
      top: 0;
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      opacity: 0.75;
    }

    @apply text-[#7d7448] dark:text-gray-300;
  }

  .floating-loading {
    position: fixed;
    top: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem;
    opacity: 0.75;
  }

  .active-filter-indicator {
    padding: 0.5rem 1rem;
    display: flex;
    justify-content: center;
    z-index: 10;
  }

  .filter-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgb(from var(--base-color) r g b / 0.3);
    color: var(--contrast-color);
    padding: 0.4rem 0.8rem;
    border-radius: 2rem;
    font-size: 0.875rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

    :global(.dark) & {
      background: rgba(255, 255, 255, 0.1);
    }
  }

  .clear-filter-btn {
    appearance: none;
    border: none;
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    padding: 0;
    margin-left: 0.25rem;
    cursor: pointer;
    opacity: 0.7;
    transition: all 150ms ease;
    color: var(--contrast-color);

    &:hover {
      opacity: 1;
      background: rgb(from var(--base-color) r g b / 0.4);
    }
  }
</style>
