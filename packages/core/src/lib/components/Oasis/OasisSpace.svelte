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
  import { derived, get, writable } from 'svelte/store'

  import {
    useLogScope,
    parseTextIntoISOString,
    clickOutside,
    tooltip,
    checkIfYoutubeUrl,
    isModKeyAndKeyPressed,
    truncate,
    parseStringIntoUrl,
    isMac
  } from '@horizon/utils'
  import { DEFAULT_SPACE_ID, OasisSpace, useOasis } from '../../service/oasis'
  import { Icon } from '@horizon/icons'
  import SearchInput from './SearchInput.svelte'
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
  import { fly, slide } from 'svelte/transition'
  import OasisSpaceSettings from './Scaffolding/OasisSpaceSettings.svelte'
  import { RSSParser, type RSSItem } from '@horizon/web-parser/src/rss/index'
  import type { ResourceContent } from '@horizon/web-parser'
  import { DragculaDragEvent } from '@horizon/dragcula'
  import type { ChatWithSpaceEvent } from '../../types/browser.types'
  import type { BrowserTabNewTabEvent } from '../Browser/BrowserTab.svelte'
  import {
    ContextViewDensities,
    ContextViewTypes,
    CreateTabEventTrigger,
    DeleteSpaceEventTrigger,
    EventContext,
    OpenInMiniBrowserEventFrom,
    RefreshSpaceEventTrigger,
    SaveToOasisEventTrigger,
    SearchOasisEventTrigger,
    SummarizeEventContentSource,
    type ContextViewDensity,
    type ContextViewType
  } from '@horizon/types'
  import PQueue from 'p-queue'
  import { useConfig } from '../../service/config'
  import { sanitizeHTML } from '@horizon/web-parser/src/utils'
  import { useTabsManager } from '../../service/tabs'

  import CreateNewSpace, { type CreateNewSpaceEvents } from './CreateNewSpace.svelte'
  import OasisSpaceUpdateIndicator from './OasisSpaceUpdateIndicator.svelte'
  import MiniBrowser from '../MiniBrowser/MiniBrowser.svelte'
  import { useMiniBrowserService } from '@horizon/core/src/lib/service/miniBrowser'
  import FilterSelector, { type FilterItem } from './FilterSelector.svelte'
  import ContextTabsBar from './ContextTabsBar.svelte'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { openDialog } from '../Core/Dialog/Dialog.svelte'
  import { isGeneratedResource } from '@horizon/core/src/lib/utils/resourcePreview'
  import OasisSpaceViewSettingsPopover, {
    type ViewChangeEvent
  } from './Scaffolding/OasisSpaceViewSettingsPopover.svelte'

  export let spaceId: string
  export let active: boolean = false
  export let hideBar = false
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

  const resourceManager = oasis.resourceManager
  const selectedFilterTypeId = oasis.selectedFilterTypeId
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

      const sortBy = $space?.dataValue.sortBy ?? 'updated_at'
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

  const handleSearch = async (e: CustomEvent<string>) => {
    let value = e.detail

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
    await resourceManager.deleteSpaceEntries(resources.map((x) => x.id))

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

  const handleReload = async () => {
    await loadSpaceContents(spaceId, true)
  }

  onDestroy(
    oasis.on('reload-space', (id: string) => {
      if (id !== spaceId) return
      loadSpaceContents(spaceId, true)
    })
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
  <div class="relative wrapper bg-sky-100/50 dark:bg-gray-900">
    {#if !isEverythingSpace && $spaceData?.folderName !== '.tempspace'}
      <div
        class="drawer-bar transition-transform duration-300 ease-in-out"
        class:translate-y-24={hideBar && active}
      >
        {#if $spaceData?.folderName !== '.tempspace'}
          <div
            class="drawer-chat-search bg-[rgba(255,255,255)] dark:bg-gray-800 text-gray-900 dark:text-gray-100 from-sky-100/70 dark:from-gray-900/90 border-gray-200 dark:border-gray-700 border-[1px] to-transparent via-bg-sky-100/10 dark:via-gray-900/10 backdrop-blur-xl backdrop-saturate-50"
          >
            <div
              class="relative left-1 top-1/2 transform -translate-y-1/2 z-10 place-items-center flex items-center gap-3"
            >
              <div
                class="settings-wrapper flex items-center gap-2"
                use:clickOutside={handleCloseSettingsModal}
              >
                <button
                  class="settings-toggle flex flex-col items-start hover:bg-sky-200 dark:hover:bg-gray-800 rounded-md h-full gap-[0.33rem]"
                  on:click={handleOpenSettingsModal}
                >
                  {#if $spaceData?.folderName}
                    <div
                      class="folder-name flex gap-2 items-center justify-center text-xl text-sky-800 dark:text-gray-100"
                    >
                      <Icon
                        name="chevron.down"
                        size="20px"
                        class="transition-all duration-200 {$showSettingsModal === true
                          ? 'rotate-180'
                          : ''}"
                      />
                      <span class="font-medium leading-[1] text-left">{$spaceData?.folderName}</span
                      >
                    </div>
                    <!-- {#if $space.name.smartFilterQuery}
                      <span
                        class="relative text-sm left-3 pointer-events-none flex items-center justify-center mb-[0.1rem] place-self-start px-0.5"
                      >
                        <span class="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-1.5"></span>
                        <span class="text-blue-500 leading-[1]"> Smart Space</span>
                      </span>
                    {/if} -->
                  {/if}
                </button>

                <div class="w-[2px] h-full min-h-6 bg-sky-800/25 dark:bg-gray-800/25 ml-3"></div>

                <OasisSpaceUpdateIndicator
                  {space}
                  {newlyLoadedResources}
                  {loadingSpaceSources}
                  {processingSourceItems}
                  on:refresh={handleRefreshLiveSpace}
                />

                {#if $showSettingsModal}
                  <div class="modal-wrapper" transition:fly={{ y: 10, duration: 160 }}>
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
              </div>
            </div>
            <div class="search-input-wrapper">
              <SearchInput
                bind:value={$searchValue}
                on:search={handleSearch}
                on:chat={handleChatWithSpace}
                placeholder="Search this Context"
              />

              <div class="chat-with-space-wrapper">
                <button
                  use:tooltip={{
                    text:
                      $searchValue.length > 0
                        ? 'Create new chat with this context'
                        : `Create new chat with this context (${isMac() ? '⌘' : 'ctrl'}+↵)`
                  }}
                  class="chat-with-space"
                  class:activated={$searchValue.length > 0}
                  on:click={handleChatWithSpace}
                >
                  <Icon name="chat" size="20px" />

                  {#if $searchValue.length > 0}
                    <div transition:slide={{ axis: 'x' }} class="chat-text">
                      Ask Context
                      <span class="shortcut">{isMac() ? '⌘' : 'ctrl'}+↵</span>
                    </div>
                  {/if}
                </button>
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <OasisSpaceViewSettingsPopover
                on:change={handleViewSettingsChanges}
                viewType={$spaceData?.viewType}
                viewDensity={$spaceData?.viewDensity}
              />
              <FilterSelector selected={selectedFilterTypeId} on:change={handleFilterTypeChange} />
            </div>

            <div class="drawer-chat active">
              <button class="close-button" on:click={handleCloseChat}>
                <Icon name="close" size="15px" />
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <ContextTabsBar
      {spaceId}
      on:open-page-in-mini-browser={handleOpenPageMiniBrowser}
      on:handled-drop
      on:select-space
      on:reload={handleReload}
    />

    {#if $spaceResourceIds.length > 0 && !isEverythingSpace}
      <OasisResourcesView
        resources={spaceResourceIds}
        {searchValue}
        isInSpace={!isEverythingSpace}
        viewType={$spaceData?.viewType}
        viewDensity={$spaceData?.viewDensity}
        on:click={handleItemClick}
        on:open={handleOpen}
        on:open-and-chat
        on:remove={handleResourceRemove}
        on:load={handleLoadResource}
        on:batch-remove={handleResourceRemove}
        on:set-resource-as-space-icon={handleUseResourceAsSpaceIcon}
        on:batch-open
        on:create-tab-from-space
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
        on:click={handleItemClick}
        on:open={handleOpen}
        on:open-and-chat
        on:remove={handleResourceRemove}
        on:space-selected={handleSpaceSelected}
        on:set-resource-as-space-icon={handleUseResourceAsSpaceIcon}
        on:batch-remove
        on:batch-open
        on:open-space-as-tab
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
  </div>
</DropWrapper>

<style lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-radius: 12px;
  }

  button {
    padding: 0.5rem;
  }

  .search-input-wrapper {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 32rem;
    justify-self: center;
    gap: 1rem;
    display: flex;
    align-items: center;
    view-transition-name: search-transition;
  }

  .modal-wrapper {
    position: fixed;
    bottom: 4rem;
    left: 0;
    z-index: 100;
  }

  .drawer-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1;
    margin: 0.5rem;
    .drawer-chat-search {
      position: relative;
      border-radius: 12px;

      display: grid;
      grid-template-columns: 18vw 1fr 18vw;
      width: 100%;
      column-gap: 1rem;
      padding: 0.5rem 1rem;
      transition: all 240ms ease-out;

      @media (max-width: 1300px) {
        grid-template-columns: fit-content(100%) 1fr fit-content(100%);
      }

      .drawer-chat {
        position: relative;
        z-index: 10;
        top: 0;

        .close-button {
          position: relative;
          display: none;
          top: -1rem;
          right: -3.5rem;
          justify-content: center;
          align-items: center;
          width: 2rem;
          height: 2rem;
          flex-shrink: 0;
          border-radius: 50%;
          border: 0.5px solid rgba(0, 0, 0, 0.15);
          transition: 60ms ease-out;
          background: white;
          z-index: 100;
          &:hover {
            outline: 3px solid rgba(0, 0, 0, 0.15);
          }
        }
      }
    }
  }

  /*.search-debug {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    padding-bottom: 1.5rem;
    padding-top: 0.25rem;
    background: rgba(255, 255, 255, 0.33);

    input {
      background: none;
      padding: 0.5rem;
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, 0.15);
      font-size: 1rem;
      font-weight: 500;
      letter-spacing: 0.02rem;
      width: 75px;
      text-align: center;
    }
  }*/

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

  .settings-wrapper {
    position: relative;
    display: flex;
    align-items: center;

    .settings-toggle {
      display: flex;
      justify-content: center;
      align-items: center;
      color: #7d7448;
      padding: 0;
      opacity: 0.7;
      &:hover {
        opacity: 1;
        background: transparent;
      }
    }
  }

  .chat-with-space-wrapper {
    @media (min-width: 1300px) {
      max-width: 40px;
      width: 100%;
      overflow: visible;
    }
  }

  .chat-with-space {
    flex-shrink: 0;
    appearance: none;
    display: flex;
    align-items: center;
    padding: 0.65rem;
    border-radius: 0.75rem;
    border: none;
    font-size: 0.9rem;
    font-weight: 500;
    letter-spacing: 0.02rem;
    transition: all 0.2s ease-in-out;

    // Light theme
    color: #0b689ad6;

    &:hover {
      color: #0369a1;
      background: rgb(232, 238, 241);
    }

    &.activated {
      background: rgba(255, 255, 255, 0.75);

      &:hover {
        background: rgba(255, 255, 255, 1);
      }
    }

    // Dark theme
    :global(.dark) & {
      color: #7dd3ffd6;

      &:hover {
        color: #7dd3fc;
        @apply bg-sky-700/20;
      }

      &.activated {
        @apply bg-sky-700/20;

        &:hover {
          @apply bg-sky-700/40;
        }
      }
    }

    .chat-text {
      margin-left: 0.5rem;
      text-wrap: nowrap;
    }

    .shortcut {
      margin-left: 0.25rem;
      padding: 0.25rem;
      border-radius: 6px;
      font-size: 0.75rem;
      background: #d4dbe4c0;

      :global(.dark) & {
        background: #1e293b;
      }
    }
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
