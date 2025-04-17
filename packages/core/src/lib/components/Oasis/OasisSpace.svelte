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
  import { derived, get, writable, type Readable } from 'svelte/store'
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
    isMac
  } from '@horizon/utils'
  import { DEFAULT_SPACE_ID, OasisSpace, useOasis } from '../../service/oasis'
  import { DynamicIcon, Icon } from '@horizon/icons'
  import { createEventDispatcher, onDestroy, tick } from 'svelte'
  import {
    Resource,
    ResourceManager,
    ResourcePost,
    ResourceTag,
    type ResourceObject,
    type ResourceSearchResultItem
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
    processDrop
  } from '../../service/mediaImporter'

  import { useToasts } from '../../service/toast'
  import { RSSParser, type RSSItem } from '@horizon/web-parser/src/rss/index'
  import type { ResourceContent } from '@horizon/web-parser'
  import { DragculaDragEvent } from '@horizon/dragcula'
  import type { ChatWithSpaceEvent } from '../../types/browser.types'
  import type { BrowserTabNewTabEvent } from '../Browser/BrowserTab.svelte'
  import {
    CreateTabEventTrigger,
    DeleteSpaceEventTrigger,
    EventContext,
    OpenInMiniBrowserEventFrom,
    RefreshSpaceEventTrigger,
    SaveToOasisEventTrigger,
    SearchOasisEventTrigger,
    SummarizeEventContentSource
  } from '@horizon/types'
  import PQueue from 'p-queue'
  import { useConfig } from '../../service/config'
  import { sanitizeHTML } from '@horizon/web-parser/src/utils'
  import { useTabsManager } from '../../service/tabs'

  import CreateNewSpace, { type CreateNewSpaceEvents } from './CreateNewSpace.svelte'
  import MiniBrowser from '../MiniBrowser/MiniBrowser.svelte'
  import { useMiniBrowserService } from '@horizon/core/src/lib/service/miniBrowser'
  import { type FilterItem } from './FilterSelector.svelte'
  import ContextTabsBar from './ContextTabsBar.svelte'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { openDialog } from '../Core/Dialog/Dialog.svelte'
  import { isGeneratedResource } from '@horizon/core/src/lib/utils/resourcePreview'
  import ContextLinks from './Scaffolding/ContextLinks.svelte'
  import LazyScroll, { type LazyItem } from '../Utils/LazyScroll.svelte'
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

  export let spaceId: string
  export let active: boolean = false
  export let handleEventsOutside: boolean = false
  export let insideDrawer: boolean = false

  $: isEverythingSpace = spaceId === 'all'

  const log = useLogScope('OasisSpace')
  const oasis = useOasis()
  const config = useConfig()

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
  const showChat = writable(false)
  const resourceIds = writable<string[]>([])
  const chatPrompt = writable('')
  const searchResults = writable<string[]>([])
  const selectedItem = writable<string | null>(null)
  const showSettingsModal = writable(false)
  const loadingContents = writable(false)
  const loadingSpaceSources = writable(false)
  const space = writable<OasisSpace | null>(null)
  // const selectedFilter = writable<'all' | 'saved_by_user'>('all')

  const canGoBack = writable(false)

  const REFRESH_SPACE_SOURCES_AFTER = 15 * 60 * 1000 // 15 minutes

  const spaceContents = writable<SpaceEntry[]>([])
  const everythingContents = writable<ResourceSearchResultItem[]>([])
  const newlyLoadedResources = writable<string[]>([])
  const processingSourceItems = writable<string[]>([])

  $: spaceData = $space?.data
  $: darkMode = $userConfigSettings.app_style === 'dark'

  const spaceResourceIds = derived(
    [searchValue, spaceContents, searchResults],
    ([searchValue, spaceContents, searchResults]) => {
      const ids = spaceContents.map((x) => x.resource_id)

      if (searchValue) {
        if (isEverythingSpace) {
          return searchResults
        } else {
          return ids.filter((x) => searchResults.includes(x))
        }
      }

      return ids
    }
  )

  const renderContents = derived<[Readable<string[]>], LazyItem[]>(
    [spaceResourceIds],
    ([spaceResourceIds]) => {
      return (spaceResourceIds ?? []).map((id) => {
        return { id, data: null }
      })
    }
  )

  $: if (active) {
    log.debug('Active, loading space contents...')
    if (spaceId === 'all') {
      loadEverything()
      telemetry.trackOpenOasis()
    } else {
      loadSpaceContents(spaceId)
    }
  }

  const loadSpaceContents = async (id: string, skipSources = false) => {
    try {
      loadingContents.set(true)
      everythingContents.set([])

      const startTime = performance.now()

      const fetchedSpace = await oasis.getSpace(id)
      if (!fetchedSpace) {
        log.error('Space not found')
        toasts.error('Context not found')
        return
      }

      log.debug('Fetched space:', fetchedSpace)
      space.set(fetchedSpace)

      const sortBy = $space?.dataValue.sortBy ?? 'resource_updated'
      const order = $space?.dataValue.sortOrder ?? 'desc'

      log.debug('Loading space contents:', id, sortBy, order)
      let items = await oasis.getSpaceContents(id, { order: order, sort_by: sortBy })
      log.debug('Loaded space contents:', items)

      items = items.filter((item) => item.manually_added !== SpaceEntryOrigin.Blacklisted)

      searchValue.set('')
      searchResults.set([])

      spaceContents.set([])

      await tick()

      if ($selectedFilterType !== null) {
        const filteredItems = await Promise.all(
          items.map(async (item) => {
            let type = item.resource_type
            let resource

            // Fetch resource if type is missing or if we're filtering for surflets
            if (!type || $selectedFilterType.id === 'surflets') {
              log.debug('Fetching resource:', item.resource_id)
              resource = await resourceManager.getResource(item.resource_id)
              if (!resource) {
                return false
              }

              type = resource.type
            }

            if (!type) {
              return false
            }

            if ($selectedFilterType.id === 'media') {
              return type.startsWith('image/') ||
                type.startsWith('video/') ||
                type.startsWith('audio/')
                ? item
                : false
            } else if ($selectedFilterType.id === 'notes') {
              return type === ResourceTypes.DOCUMENT_SPACE_NOTE ? item : false
            } else if ($selectedFilterType.id === 'files') {
              return !type.startsWith('application/vnd.space.') &&
                !type.startsWith('image/') &&
                !type.startsWith('video/') &&
                !type.startsWith('audio/')
                ? item
                : false
            } else if ($selectedFilterType.id === 'links') {
              return type.startsWith('application/vnd.space.') ? item : false
            } else if ($selectedFilterType.id === 'surflets') {
              return resource && isGeneratedResource(resource) ? item : false
            } else {
              return item
            }
          })
        )

        // Filter out false values from the Promise.all results
        items = filteredItems.filter((item) => item !== false)

        log.debug('Filtered items:', items)
      }

      spaceContents.set(items)

      const endTime = performance.now()
      log.debug('Loaded space contents in', (endTime - startTime).toFixed(2), 'ms')

      if (skipSources) {
        return
      }

      const spaceData = fetchedSpace.dataValue

      let addedResources = 0
      let fetchedSources = false
      let usedSmartQuery = false
      if (spaceData.liveModeEnabled) {
        if ((spaceData.sources ?? []).length > 0) {
          fetchedSources = true
          const fetchedResources = await loadSpaceSources(spaceData.sources!)
          if (fetchedResources) {
            addedResources = fetchedResources.length
          }
        }

        if (spaceData.smartFilterQuery) {
          usedSmartQuery = true
          const fetchedResources = await updateLiveSpaceContentsWithAI(
            spaceData.smartFilterQuery,
            spaceData.sql_query,
            spaceData.embedding_query
          )
          if (fetchedResources) {
            addedResources += fetchedResources.length
          }
        }
      }

      if ($newlyLoadedResources.length > 0 && $spaceContents.length === 0) {
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
      log.error('Error loading space contents:', error)
    } finally {
      loadingContents.set(false)
    }
  }

  const loadEverything = async () => {
    try {
      if ($loadingContents) {
        log.debug('Already loading everything')
        return
      }

      loadingContents.set(true)
      spaceContents.set([])

      const resources = await resourceManager.listResourcesByTags(
        [
          ResourceManager.SearchTagDeleted(false),
          ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne'),
          ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT)
        ],
        { includeAnnotations: true }
      )

      const items = resources
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(
          (resource) =>
            ({
              id: resource.id,
              resource: resource,
              annotations: resource.annotations,
              engine: 'local'
            }) as ResourceSearchResultItem
        )

      log.debug('Loaded everything:', items)

      searchValue.set('')
      searchResults.set([])
      everythingContents.set(items)
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

      // const stringifiedQuery = JSON.stringify(query)
      // const stringifiedSqlQuery = JSON.stringify(sql_query === '' ? undefined : sql_query)
      // const stringifiedEmbeddingQuery = JSON.stringify(
      //   embedding_query === '' ? undefined : sql_query
      // )
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
        const entry = fullSpaceContents.find((y) => y.resource_id === x)
        if (!entry) return true

        return entry.manually_added !== SpaceEntryOrigin.Blacklisted
      })

      log.debug('Adding resources to space', newResults)

      newlyLoadedResources.update((resources) => [...resources, ...newResults])

      await oasis.addResourcesToSpace(spaceId, newResults, SpaceEntryOrigin.LlmQuery)

      // await loadSpaceContents(spaceId, true)

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

      // await loadSpaceContents(spaceId, true)

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

      // add dummy item to space while processing
      // const data = {
      //   url: canonicalURL,
      //   title: item.title,
      //   date_published: item.pubDate,
      //   provider: sourceURL.hostname
      // } as ResourceDataLink

      // const dummyResource = await resourceManager.createDummyResource(
      //   ResourceTypes.LINK,
      //   new Blob([JSON.stringify(data)], { type: 'application/json' })
      // )

      // log.debug('Created fake resource:', dummyResource)

      // spaceContents.update((contents) => {
      //   return [
      //     ...contents,
      //     {
      //       id: dummyResource.id,
      //       resource_id: dummyResource.id,
      //       space_id: $space!.id,
      //       manually_added: 0,
      //       created_at: new Date().toISOString(),
      //       updated_at: new Date().toISOString()
      //     }
      //   ]
      // })

      const existingResourceIds = await resourceManager.listResourceIDsByTags([
        ResourceManager.SearchTagDeleted(false),
        ResourceManager.SearchTagCanonicalURL(canonicalURL),
        ResourceManager.SearchTagSpaceSource('rss')
      ])

      log.debug('Existing resources:', existingResourceIds)

      if (existingResourceIds.length > 0) {
        const resourceId = existingResourceIds[0]
        log.debug('Resource already exists', resourceId)

        // check if resource is in space
        const resourceInSpace = $spaceContents.find((x) => x.resource_id === resourceId)
        if (resourceInSpace) {
          log.debug('Resource already in space, skipping')
          return null
        } else {
          log.debug('Resource not in space, adding')
          const resource = await resourceManager.getResource(resourceId)
          if (resource) {
            newlyLoadedResources.update((resources) => [...resources, resource.id])
            // spaceContents.update((contents) => {
            //   return [
            //     // remove dummy item
            //     ...contents.filter((x) => x.resource_id !== dummyResource.id),
            //     {
            //       id: resource.id,
            //       resource_id: resource.id,
            //       space_id: $space!.id,
            //       manually_added: 0,
            //       created_at: new Date().toISOString(),
            //       updated_at: new Date().toISOString()
            //     }
            //   ]
            // })

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

      // spaceContents.update((contents) => [
      //   // remove dummy item
      //   ...contents.filter((x) => x.resource_id !== dummyResource.id),
      //   {
      //     id: parsed.resource.id,
      //     resource_id: parsed.resource.id,
      //     space_id: $space!.id,
      //     manually_added: 0,
      //     created_at: new Date().toISOString(),
      //     updated_at: new Date().toISOString()
      //   }
      // ])

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

  const handleCloseChat = () => {
    showChat.set(false)
    searchValue.set('')
    chatPrompt.set('')
    resourceIds.set([])
  }

  const handleOpenSettingsModal = () => {
    if ($showSettingsModal === true) {
      showSettingsModal.set(false)
    } else {
      showSettingsModal.set(true)
    }
  }

  const handleCloseSettingsModal = () => {
    showSettingsModal.set(false)
  }

  const runSearch = useDebounce(async () => {
    try {
      loadingContents.set(true)

      let value = $searchValue

      if (!value) {
        searchResults.set([])
        return
      }

      const hashtagMatch = value.match(/#[a-zA-Z0-9]+/g)
      const hashtags = hashtagMatch ? hashtagMatch.map((x) => x.slice(1)) : []

      // if all words are hashtags, clear the search
      if (hashtags.length === value.split(' ').length) {
        value = ''
      }

      await telemetry.trackSearchOasis(SearchOasisEventTrigger.Oasis, !isEverythingSpace)

      const result = await resourceManager.searchResources(
        value,
        [
          ResourceManager.SearchTagDeleted(false),
          ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT),
          ...hashtags.map((x) => ResourceManager.SearchTagHashtag(x))
        ],
        {
          semanticEnabled: $userConfigSettings.use_semantic_search,
          spaceId: spaceId ? spaceId : undefined
        }
      )

      log.debug('search in space results:', result)

      searchResults.set(result.map((r) => r.resource.id))
    } catch (error) {
      log.error('Error searching:', error)
    } finally {
      loadingContents.set(false)
    }
  }, 350)

  const handleSearch = async (e: CustomEvent<string>) => {
    loadingContents.set(true)
    runSearch()
  }

  const handleResourceRemove = async (
    e: CustomEvent<{ ids: string | string[]; deleteFromStuff: boolean }>
  ) => {
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
      if (isEverythingSpace) {
        const contents = $everythingContents.filter((x) => !ids.includes(x.id))
        everythingContents.set([])
      } else {
        const contents = $spaceContents.filter((x) => !ids.includes(x.resource_id))
        spaceContents.set([])
        await tick()
        spaceContents.set(contents)
      }
    } catch (e) {
      toasts.error(e.toString())
      throw e
    }
  }

  const handleUseResourceAsSpaceIcon = async (e: CustomEvent<string>) => {
    const resourceId = e.detail
    if (!$space) return
    await $space.useResourceAsIcon(resourceId)
    toasts.success('Context icon updated!')
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
      handleCloseChat()
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
    } else if (isModKeyAndKeyPressed(e, 'Enter')) {
      handleChatWithSpace()
    }
  }

  const handleDrop = async (drag: DragculaDragEvent<DragTypes>) => {
    //const toast = toasts.loading(`${drag.effect === 'move' ? 'Moving' : 'Copying'} to space...`)
    const toast = toasts.loading(`Copying to space...`)

    log.debug('dropping onto DropWrapper', drag, ' | ', drag.from?.id, ' >> ', drag.to?.id, ' | ')

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
      ResourceManager.SearchTagSilent(),
      ResourceManager.SearchTagDeleted(false)
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
        await resourceManager.deleteResources(resources.map((x) => x.resource_id))
      }

      log.debug('Deleting space', spaceId)
      await oasis.deleteSpace(spaceId)

      await tabsManager.removeSpaceTabs(spaceId)

      oasis.changeSelectedSpace(DEFAULT_SPACE_ID)
      dispatch('deleted', spaceId)

      if (!abortSpaceCreation) {
        toast?.success('Context deleted!')
      }

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

  const handleLoadResource = (e: CustomEvent<Resource>) => {
    const resource = e.detail
    log.debug('Load resource:', resource)

    if ($space?.dataValue.hideViewed) {
      const viewedByUser =
        resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.VIEWED_BY_USER)?.value ===
        'true'

      if (viewedByUser) {
        log.debug('Resource already viewed by user')

        $spaceContents = $spaceContents.filter((x) => x.resource_id !== resource.id)
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

  const handleOpen = (e: CustomEvent<string>) => {
    const resourceId = e.detail
    if (handleEventsOutside) {
      dispatch('open', resourceId)
    } else {
      openResourceDetailsModal(resourceId)
    }
  }

  const handleSpaceSelected = (e: CustomEvent<{ id: string; canGoBack: boolean }>) => {
    const spaceEvent = e.detail
    log.debug('Space selected:', spaceEvent)

    oasis.getSpaceContents(spaceEvent.id).then((resources) => {
      log.debug('Space contents:', resources)
      $spaceContents = resources
    })

    if (spaceEvent.canGoBack) {
      canGoBack.set(spaceEvent.canGoBack)
    }
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
        smartFilterQuery: processNaturalLanguage ? userPrompt : undefined
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

      $space = createdSpace
      await loadSpaceContents(createdSpace.id)
      showSettingsModal.set(false)
      toasts.success('Context updated successfully!')

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

  const handleFilterTypeChange = (e: CustomEvent<FilterItem | null>) => {
    log.debug('Filter type change:', e.detail)
    loadSpaceContents(spaceId, true)
  }

  const handleOpenPageMiniBrowser = async (e: CustomEvent<string>) => {
    const url = e.detail
    log.debug('Open page mini browser', url)

    if (handleEventsOutside) {
      dispatch('open-page-in-mini-browser', url)
    } else {
      // openResourceDetailsModal(tab.resourceBookmark || tab.chatResourceBookmark)
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

    // TODO: Typing we dont expose a type for the sort exactly so this is scudffed
    await $space.updateData({ sortBy })
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
      const themeData: ThemeData = { colors: {} }
      if (data && data.colorPalette) {
        const colorData =
          colors.calculateColors(data.colorPalette.at(darkMode ? -1 : 0), darkMode) ?? undefined
        themeData.colors.contrast = colorData.contrastColor
        themeData.colors.base = colorData.color
        themeData.backgroundImage = data.resourceId
      } else {
        themeData.colors.contrast = darkMode ? 'hsl(212, 92%, 92%)' : 'hsl(212, 92%, 8%)'
        themeData.colors.base = '#808080'
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

<svelte:window on:keydown={handleKeyDown} />

<MiniBrowser service={scopedMiniBrowser} {active} on:seekToTimestamp on:highlightWebviewText />

<DropWrapper
  {spaceId}
  on:Drop={(e) => handleDrop(e.detail)}
  acceptsDrag={(drag) => {
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
  <div
    class="relative wrapper"
    style:--background-image={getBackgroundImageUrlFromId($theme?.backgroundImage, darkMode)}
    style:--base-color={$theme?.colors?.base}
    style:--contrast-color={$theme?.colors?.contrast}
  >
    {#if $space && $spaceData && $theme !== undefined}
      <LazyScroll items={renderContents} let:renderedItems>
        {#if !isEverythingSpace && $spaceData?.folderName !== '.tempspace'}
          <OasisSpaceNavbar {searchValue} on:search={handleSearch} on:chat={handleChatWithSpace}>
            <svelte:fragment slot="left">
              {#key `${$spaceData.imageIcon}-${$spaceData.colors}-${$spaceData.emoji}`}
                <DynamicIcon name={$space.getIconString()} />
              {/key}
              <span class="context-name">{$spaceData.folderName}</span>
            </svelte:fragment>
            <svelte:fragment slot="right">
              <button
                use:tooltip={{
                  position: 'left',
                  text:
                    $searchValue.length > 0
                      ? 'Create new chat with this context'
                      : `Create new chat with this context (${isMac() ? '⌘' : 'ctrl'}+↵)`
                }}
                class="chat-with-space pointer-all"
                class:activated={$searchValue.length > 0}
                on:click={handleChatWithSpace}
              >
                <Icon name="face" size="1.6em" />

                <div class="chat-text">Ask Context</div>
              </button>
            </svelte:fragment>
            <svelte:fragment slot="right-dynamic">
              <SpaceFilterViewButtons
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
          </OasisSpaceNavbar>

          {#if $userConfigSettings.experimental_context_linking && $space}
            <ContextLinks space={$space} />
          {/if}

          <ContextHeader
            bind:headline={$spaceData.folderName}
            bind:description={$spaceData.description}
            themeData={theme}
            on:changed-headline={({ detail: headline }) =>
              oasis.updateSpaceData($space.id, { folderName: headline })}
            on:changed-description={({ detail: description }) =>
              oasis.updateSpaceData($space.id, { description })}
          >
            <svelte:fragment slot="icon">
              <SpaceIcon folder={$space} size="xl" />
            </svelte:fragment>
            <svelte:fragment slot="headline-content">
              <button
                class="edit-button"
                on:click={() => ($showSettingsModal = !$showSettingsModal)}
                ><Icon name="settings" size="1.6em" /></button
              >

              <OasisSpaceUpdateIndicator
                {space}
                {newlyLoadedResources}
                {loadingSpaceSources}
                {processingSourceItems}
                on:refresh={handleRefreshLiveSpace}
              />
            </svelte:fragment>
            <svelte:fragment slot="header-content">
              {#if $showSettingsModal}
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
            <svelte:fragment slot="meta-section">
              <DesktopPreview desktopId={$space.id} />
            </svelte:fragment>
          </ContextHeader>

          <ContextTabsBar
            {spaceId}
            on:open-page-in-mini-browser={handleOpenPageMiniBrowser}
            on:handled-drop
            on:select-space
            on:reload={handleReload}
          />
        {/if}

        {#if $spaceResourceIds.length > 0 && !isEverythingSpace}
          <OasisResourcesView
            resources={renderedItems}
            {searchValue}
            isInSpace={!isEverythingSpace}
            viewType={$spaceData?.viewType}
            viewDensity={$spaceData?.viewDensity}
            sortBy={$spaceData?.sortBy ?? 'resource_added_to_space'}
            order={$spaceData?.sortOrder ?? 'desc'}
            fadeIn
            on:click={handleItemClick}
            on:open={handleOpen}
            on:open-and-chat
            on:remove={handleResourceRemove}
            on:load={handleLoadResource}
            on:batch-remove={handleResourceRemove}
            on:set-resource-as-space-icon={handleUseResourceAsSpaceIcon}
            on:batch-open
            on:create-tab-from-space
            on:changedView={handleViewSettingsChanges}
            on:changedFilter={handleFilterSettingsChanged}
            on:changedSortBy={handleSortBySettingsChanged}
            on:changedOrder={handleOrderSettingsChanged}
          />

          {#if $loadingContents}
            <div class="floating-loading">
              <Icon name="spinner" size="20px" />
            </div>
          {/if}
        {:else if isEverythingSpace && $everythingContents.length > 0}
          <OasisResourcesView
            resources={everythingContents}
            {searchValue}
            isInSpace={false}
            viewType={$spaceData?.viewType}
            viewDensity={$spaceData?.viewDensity}
            sortBy={$spaceData?.sortBy ?? 'resource_added_to_space'}
            order={$spaceData?.sortOrder ?? 'desc'}
            fadeIn
            on:click={handleItemClick}
            on:open={handleOpen}
            on:open-and-chat
            on:remove={handleResourceRemove}
            on:space-selected={handleSpaceSelected}
            on:set-resource-as-space-icon={handleUseResourceAsSpaceIcon}
            on:batch-remove
            on:batch-open
            on:open-space-as-tab
            on:changedView={handleViewSettingsChanges}
            on:changedFilter={handleFilterSettingsChanged}
            on:changedSortBy={handleSortBySettingsChanged}
            on:changedOrder={handleOrderSettingsChanged}
          />

          {#if $loadingContents}
            <div class="floating-loading">
              <Icon name="spinner" size="20px" />
            </div>
          {/if}
        {:else if $space && $spaceData?.folderName === '.tempspace'}
          <CreateNewSpace
            on:update-existing-space={handleUpdateExistingSpace}
            on:abort-space-creation={handleAbortSpaceCreation}
            on:creating-new-space
            on:done-creating-new-space
            space={$space}
          />
        {:else if $loadingContents}
          <div class="content-wrapper">
            <div class="content">
              <Icon name="spinner" size="22px" />
              <p>Loading…</p>
            </div>
          </div>
        {:else}
          <div class="content-wrapper">
            <div class="content">
              <Icon name="save" size="22px" />
              <p>Oops! It seems like this Context is feeling a bit empty.</p>
            </div>
          </div>
        {/if}
      </LazyScroll>
    {/if}
  </div>
</DropWrapper>

<style lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
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

  .settings-modal-wrapper {
    position: fixed;
    position-anchor: --edit-button;
    top: calc(anchor(end) + 0.75rem);
    left: calc(anchor(start));
    z-index: 10000000000000000;
  }

  .content-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    .content {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      opacity: 0.75;

      p {
        font-size: 1.2rem;
      }
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
</style>
