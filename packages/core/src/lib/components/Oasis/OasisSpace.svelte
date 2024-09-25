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
  import { derived, writable } from 'svelte/store'

  import {
    useLogScope,
    parseTextIntoISOString,
    wait,
    clickOutside,
    tooltip,
    checkIfYoutubeUrl,
    isModKeyAndKeyPressed,
    truncate,
    parseStringIntoUrl
  } from '@horizon/utils'
  import { useOasis } from '../../service/oasis'
  import { Icon } from '@horizon/icons'
  import Chat from '../Chat/Chat.svelte'
  import SearchInput from './SearchInput.svelte'
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import {
    Resource,
    ResourceJSON,
    ResourceManager,
    ResourcePost,
    ResourceTag,
    type ResourceObject,
    type ResourceSearchResultItem
  } from '../../service/resources'
  import OasisResourcesView from './OasisResourcesView.svelte'
  import {
    DragTypeNames,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    SpaceEntryOrigin,
    type DragTypes,
    type ResourceDataLink,
    type ResourceDataPost,
    type Space,
    type SpaceEntry,
    type SpaceSource
  } from '../../types'
  import DropWrapper from './DropWrapper.svelte'
  import CreateNewResource from './CreateNewResource.svelte'

  import {
    MEDIA_TYPES,
    createResourcesFromMediaItems,
    extractAndCreateWebResource,
    processDrop,
    type MediaParserResult,
    type MediaParserResultURL,
    type MediaParserResultUnknown
  } from '../../service/mediaImporter'

  import { useToasts } from '../../service/toast'
  import OasisResourcesViewSearchResult from './OasisResourcesViewSearchResult.svelte'
  import { fly } from 'svelte/transition'
  import OasisSpaceSettings from './OasisSpaceSettings.svelte'
  import { RSSParser, type RSSItem } from '@horizon/web-parser/src/rss/index'
  import { summarizeText } from '../../service/ai'
  import type { ResourceContent } from '@horizon/web-parser'
  import OasisResourceModalWrapper from './OasisResourceModalWrapper.svelte'
  import { DragculaDragEvent } from '@horizon/dragcula'
  import type { Tab, TabPage } from '../../types/browser.types'
  import type { HistoryEntriesManager } from '../../service/history'
  import type { BrowserTabNewTabEvent } from '../Browser/BrowserTab.svelte'
  import {
    AddResourceToSpaceEventTrigger,
    CreateTabEventTrigger,
    DeleteSpaceEventTrigger,
    OpenResourceEventFrom,
    RefreshSpaceEventTrigger,
    SaveToOasisEventTrigger,
    SearchOasisEventTrigger
  } from '@horizon/types'
  import PQueue from 'p-queue'
  import { useConfig } from '../../service/config'
  import { sanitizeHTML } from '@horizon/web-parser/src/utils'
  import { useTabsManager } from '../../service/tabs'

  import CreateNewSpace from './CreateNewSpace.svelte'
  import { selectedFolder } from '../../stores/oasis'

  export let spaceId: string
  export let active: boolean = false
  export let historyEntriesManager: HistoryEntriesManager
  export let showBackBtn = false
  export let hideBar = false
  export let hideResourcePreview = false
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
  }>()
  const toasts = useToasts()
  const tabsManager = useTabsManager()

  const resourceManager = oasis.resourceManager
  const spaces = oasis.spaces
  const telemetry = resourceManager.telemetry
  const userConfigSettings = config.settings

  const searchValue = writable('')
  const showChat = writable(false)
  const resourceIds = writable<string[]>([])
  const chatPrompt = writable('')
  const searchResults = writable<string[]>([])
  const selectedItem = writable<string | null>(null)
  const showNewResourceModal = writable(false)
  const showSettingsModal = writable(false)
  const loadingContents = writable(false)
  const loadingSpaceSources = writable(false)
  const space = writable<Space | null>(null)
  const showResourceDetails = writable(false)
  const resourceDetailsModalSelected = writable<string | null>(null)
  // const selectedFilter = writable<'all' | 'saved_by_user'>('all')

  const canGoBack = writable(false)

  const REFRESH_SPACE_SOURCES_AFTER = 15 * 60 * 1000 // 15 minutes

  // const selectedSpace = derived([spaces, selectedSpaceId], ([$spaces, $selectedSpaceId]) => {
  //     return $spaces.find(space => space.id === $selectedSpaceId)
  // })
  //

  const spaceContents = writable<SpaceEntry[]>([])
  const everythingContents = writable<ResourceSearchResultItem[]>([])
  const newlyLoadedResources = writable<string[]>([])
  const processingSourceItems = writable<string[]>([])

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

  const isResourceDetailsModalOpen = derived(
    [showResourceDetails, resourceDetailsModalSelected],
    ([$showResourceDetails, $resourceDetailsModalSelected]) => {
      return $showResourceDetails && !!$resourceDetailsModalSelected
    }
  )

  // $: if (spaceId === 'all') {
  //   loadEverything()
  // } else {
  //   loadSpaceContents(spaceId)
  // }

  $: if (active) {
    log.debug('Active, loading space contents...')
    if (spaceId === 'all') {
      loadEverything()
      telemetry.trackOpenOasis()
    } else {
      loadSpaceContents(spaceId)
    }
  }

  $: isSearching = $searchValue !== ''

  const loadSpaceContents = async (id: string, skipSources = false) => {
    try {
      loadingContents.set(true)
      everythingContents.set([])

      const fetchedSpace = await oasis.getSpace(id)
      if (!fetchedSpace) {
        log.error('Space not found')
        toasts.error('Space not found')
        return
      }

      log.debug('Fetched space:', fetchedSpace)
      space.set(fetchedSpace)

      // TODO(@felix): instead of having one list, entries should be split into
      // three lists, based on their `manually_added` attribute
      let items = await oasis.getSpaceContents(id)
      log.debug('Loaded space contents:', items)

      items = items.filter((item) => item.manually_added !== SpaceEntryOrigin.Blacklisted)

      searchValue.set('')
      searchResults.set([])

      spaceContents.set([])

      await tick()

      if ($space?.name.sortBy === 'source_published_at') {
        log.debug('Sorting by source_published_at, fetching resource data')
        const fullResources = (
          await Promise.all(items.map((x) => resourceManager.getResource(x.resource_id)))
        ).filter((x) => x !== null)

        log.debug('Sorting full resources:', fullResources)
        // Use the source_published_at tag for sorting
        const sorted = fullResources
          .map((resource) => {
            const publishedAt = resource.tags?.find(
              (x) => x.name === ResourceTagsBuiltInKeys.SOURCE_PUBLISHED_AT
            )?.value
            return {
              id: resource.id,
              publishedAt: publishedAt ? new Date(publishedAt) : new Date(resource.createdAt)
            }
          })
          .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())

        log.debug('Sorted resources:', sorted)

        // sort the space entries based on the sorted resources
        items = sorted
          .map((x) => items.find((y) => y.resource_id === x.id))
          .filter((x) => x !== undefined) as SpaceEntry[]
      } else {
        log.debug('sorting by resource created_at')
        const fullResources = (
          await Promise.all(items.map((x) => resourceManager.getResource(x.resource_id)))
        ).filter((x) => x !== null)

        log.debug('Sorting full resources:', fullResources)
        // Use the create_at field for sorting
        const sorted = fullResources
          .map((resource) => {
            return {
              id: resource.id,
              createdAt: new Date(resource.createdAt)
            }
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        log.debug('Sorted resources:', sorted)

        // sort the space entries based on the sorted resources
        items = sorted
          .map((x) => items.find((y) => y.resource_id === x.id))
          .filter((x) => x !== undefined) as SpaceEntry[]
      }

      spaceContents.set(items)

      if (skipSources) {
        return
      }

      const spaceData = fetchedSpace.name

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

      const response = await resourceManager.getResourcesViaPrompt(query, {
        sql_query: sql_query || undefined,
        embedding_query: embedding_query || undefined
      })
      log.debug('AI response:', response)

      if ($space?.name.sql_query !== response.sql_query) {
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

      const newResults = resourceIds.filter(
        (x) => $spaceContents.findIndex((y) => y.resource_id === x) === -1
      )

      log.debug('Adding resources to space', newResults)

      newlyLoadedResources.update((resources) => [...resources, ...newResults])

      await oasis.addResourcesToSpace(spaceId, resourceIds, SpaceEntryOrigin.LlmQuery)

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

      s.name.sources = (s.name.sources ?? []).map((x) => (x.id === source.id ? source : x))
      return s
    })

    await oasis.updateSpaceData($space!.id, {
      sources: ($space?.name.sources ?? []).map((x) => (x.id === source.id ? source : x))
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
          let summary = await summarizeText(
            contentToSummarize,
            'Summarize the given text into a single paragraph with a maximum of 400 characters. Make sure you are still conveying the main idea of the text while keeping it concise. If possible try to be as close to 400 characters as possible. Do not go over 400 characters in any case.'
          )

          log.debug('summary:', summary)

          if (summary) {
            log.debug('updating resource metadata with summary:', summary)
            await resourceManager.updateResourceMetadata(parsed.resource.id, {
              userContext: summary
            })

            // HACK: this is needed for the preview to update with the summary
            // const contents = $spaceContents
            // spaceContents.set([])

            // await tick()

            // spaceContents.set(contents)
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
    if ($space.name.smartFilterQuery) {
      const fetchedResources = await updateLiveSpaceContentsWithAI(
        $space.name.smartFilterQuery,
        $space.name.sql_query,
        $space.name.embedding_query
      )
      if (fetchedResources) {
        addedResources = fetchedResources.length
      }
    }

    const sources = $space.name.sources
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
      usedSmartQuery: !!$space.name.smartFilterQuery,
      fetchedSources: !!sources,
      addedResources: addedResources > 0
    })
  }

  const fetchNewlyAddedResourcePrevies = async (num = 3) => {
    if ($newlyLoadedResources.length === 0) {
      return []
    }

    const resourceIds = $newlyLoadedResources.slice(0, num)
    log.debug('Fetching previews for newly added resources:', resourceIds)

    const fetched = await Promise.all(
      resourceIds.map(async (id) => {
        const resource = await resourceManager.getResource(id)
        if (!resource) {
          log.error('Resource not found')
          return null
        }

        const url =
          resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ||
          resource.metadata?.sourceURI
        if (!url) {
          log.error('Resource URL not found')
          return null
        }

        return {
          id: resource.id,
          url: url
        }
      })
    )

    const items = fetched.filter((x) => x !== null)
    log.debug('Fetched items:', items)

    const uniqueHosts = Array.from(new Set(items.map((x) => new URL(x.url).hostname)))

    // only return one item per host
    return items.filter((x) => {
      const host = new URL(x.url).hostname
      if (uniqueHosts.includes(host)) {
        uniqueHosts.splice(uniqueHosts.indexOf(host), 1)
        return true
      }

      return false
    })
  }

  const handleChat = async (e: CustomEvent) => {
    const result = e.detail
    chatPrompt.set(result)

    if (!isEverythingSpace) {
      const result = await oasis.getSpaceContents(spaceId)
      resourceIds.set(result.map((r) => r.resource_id))
    } else {
      resourceIds.set([])
    }

    await tick()

    showChat.set(true)
    searchValue.set('')

    await telemetry.trackChatWithSpace()
  }

  const handleCloseChat = () => {
    showChat.set(false)
    searchValue.set('')
    chatPrompt.set('')
    resourceIds.set([])
  }

  const handleOpenNewResourceModal = () => {
    showNewResourceModal.set(true)
  }

  const handleCloseNewResourceModal = () => {
    showNewResourceModal.set(false)
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
        semanticEnabled: $userConfigSettings.use_semantic_search
      }
    )

    log.debug('searching all', result)

    searchResults.set(result.map((r) => r.resource.id))
  }

  const handleResourceRemove = async (e: CustomEvent<string>) => {
    const resourceId = e.detail
    log.debug('removing resource', resourceId)

    const resource = await resourceManager.getResource(resourceId)
    if (!resource) {
      log.error('Resource not found')
      return
    }

    const references = await resourceManager.getAllReferences(resourceId, $spaces)
    const isFromLiveSpace = !!resource.tags?.find(
      (x) => x.name === ResourceTagsBuiltInKeys.SPACE_SOURCE
    )

    let numberOfReferences = 0
    if (isEverythingSpace) {
      numberOfReferences = references.length
    }

    const confirm = window.confirm(
      !isEverythingSpace && !isFromLiveSpace
        ? `Remove from '${$space?.name.folderName}'? \nIt will still be in 'All my Stuff'.`
        : numberOfReferences > 0
          ? `This resource will be removed from ${numberOfReferences} space${numberOfReferences > 1 ? 's' : ''} and deleted permanently.`
          : `This resource will be deleted permanently.`
    )

    if (!confirm) {
      return
    }

    try {
      if (isEverythingSpace) {
        log.debug('removing resource references', references)
        for (const reference of references) {
          log.debug('deleting reference', reference)
          await resourceManager.deleteSpaceEntries([reference.entryId])
        }
      } else {
        log.debug('removing resource entry from space...', resource)

        const reference = references.find(
          (x) => x.folderId === spaceId && x.resourceId === resource.id
        )
        if (!reference) {
          log.error('Reference not found')
          toasts.error('Reference not found')
          return
        }

        await resourceManager.deleteSpaceEntries([reference.entryId])

        await resourceManager.addItemsToSpace(
          reference.folderId,
          [reference.resourceId],
          SpaceEntryOrigin.Blacklisted
        )

        // HACK: this is needed for the preview to update with the summary
        const contents = $spaceContents.filter((x) => x.resource_id !== resourceId)
        spaceContents.set([])
        await tick()
        spaceContents.set(contents)
      }
    } catch (error) {
      log.error('Error removing references:', error)
    }

    if (isEverythingSpace || isFromLiveSpace) {
      log.debug('deleting resource from oasis', resourceId)
      await resourceManager.deleteResource(resourceId)

      // HACK: this is needed for the preview to update with the summary
      const contents = $everythingContents.filter((x) => x.id !== resourceId)
      everythingContents.set([])
      await tick()
      everythingContents.set(contents)

      await telemetry.trackDeleteResource(resource.type, false)
    } else {
      await telemetry.trackDeleteResource(resource.type, true)
    }

    log.debug('Resource removed:', resourceId)
    toasts.success(`Resource ${isEverythingSpace || isFromLiveSpace ? 'deleted' : 'removed'}!`)
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
      !$isResourceDetailsModalOpen &&
      !$showSettingsModal
    ) {
      e.preventDefault()
      openResourceDetailsModal($selectedItem)
    } else if (isModKeyAndKeyPressed(e, 'Enter') && $selectedItem && !$isResourceDetailsModalOpen) {
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

  const handleDrop = async (drag: DragculaDragEvent<DragTypes>) => {
    //const toast = toasts.loading(`${drag.effect === 'move' ? 'Moving' : 'Copying'} to space...`)
    const toast = toasts.loading(`Copying to space...`)

    // FIX: (dragcula): FIFIIF

    log.debug('dropping onto sidebar', drag, ' | ', drag.from?.id, ' >> ', drag.to?.id, ' | ')

    if (drag.isNative) {
      const parsed = await processDrop(drag.event!)
      log.debug('Parsed', parsed)

      const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '')
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
      
    }*/

    drag.continue()
    toast.success(`Resources copied'!`)
    return
    /*if (
      ['sidebar-pinned-tabs', 'sidebar-unpinned-tabs', 'sidebar-magic-tabs'].includes(
        drag.from?.id || ''
      ) &&
      !drag.metaKey
    ) {
      drag.item!.dragEffect = 'copy' // Make sure tabs are always copy from sidebar
    }*/

    let resourceIds: string[] = []
    try {
      if (drag.isNative) {
        const event = new DragEvent('drop', { dataTransfer: drag.data })
        log.debug('Dropped native', event)

        const isOwnDrop = event.dataTransfer?.types.includes(MEDIA_TYPES.RESOURCE)
        if (isOwnDrop) {
          log.debug('Own drop detected, ignoring...')
          log.debug(event.dataTransfer?.files)
          return
        }

        const parsed = await processDrop(event)
        log.debug('Parsed', parsed)

        const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '')
        log.debug('Resources', newResources)

        for (const r of newResources) {
          resourceIds.push(r.id)
          telemetry.trackSaveToOasis(r.type, SaveToOasisEventTrigger.Drop, true)
        }
      } else {
        log.debug('Dropped dragcula', drag.data)

        const existingResources: string[] = []

        const dragData = drag.data as { 'surf/tab': Tab; 'horizon/resource/id': string }
        if (dragData['surf/tab'] !== undefined) {
          if (dragData['horizon/resource/id'] !== undefined) {
            const resourceId = dragData['horizon/resource/id']
            resourceIds.push(resourceId)
            existingResources.push(resourceId)
          } else if (dragData['surf/tab'].type === 'page') {
            const tab = dragData['surf/tab'] as TabPage

            if (tab.resourceBookmark) {
              log.debug('Detected resource from dragged tab', tab.resourceBookmark)
              resourceIds.push(tab.resourceBookmark)
              existingResources.push(tab.resourceBookmark)
            } else {
              log.debug('Detected page from dragged tab', tab)
              const newResources = await createResourcesFromMediaItems(
                resourceManager,
                [
                  {
                    type: 'url',
                    data: new URL(tab.currentLocation || tab.initialLocation),
                    metadata: {}
                  }
                ],
                ''
              )
              log.debug('Resources', newResources)

              for (const r of newResources) {
                resourceIds.push(r.id)
                telemetry.trackSaveToOasis(r.type, SaveToOasisEventTrigger.Drop, true)
              }
            }
          }
        }

        if (existingResources.length > 0) {
          await Promise.all(
            existingResources.map(async (resourceId) => {
              const resource = await resourceManager.getResource(resourceId)
              if (!resource) {
                log.error('Resource not found')
                return
              }

              log.debug('Detected resource from dragged tab', resource)

              const isSilent =
                resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT) !==
                undefined
              if (isSilent) {
                // remove silent tag if it exists sicne the user is explicitly adding it
                log.debug('Removing silent tag from resource', resourceId)
                await resourceManager.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.SILENT)
                telemetry.trackSaveToOasis(resource.type, SaveToOasisEventTrigger.Drop, true)
              }
            })
          )
        }
      }

      if (spaceId !== 'all') {
        await oasis.addResourcesToSpace(spaceId, resourceIds, SpaceEntryOrigin.ManuallyAdded)
        await loadSpaceContents(spaceId, true)

        resourceIds.forEach((id) => {
          resourceManager.getResource(id).then((resource) => {
            if (resource) {
              telemetry.trackAddResourceToSpace(resource.type, AddResourceToSpaceEventTrigger.Drop)
            }
          })
        })
      } else {
        await loadEverything()
      }
    } catch (error) {
      log.error('Error dropping:', error)
      toast.error('Error dropping: ' + (error as Error).message)
      drag.abort()
      return
    }
    drag.continue()

    toast.success(
      `Resources ${drag.isNative ? 'added' : drag.effect === 'move' ? 'moved' : 'copied'}!`
    )
  }

  const handleCreateResource = async (e: CustomEvent<string>) => {
    dispatch('create-resource-from-oasis', e.detail)
    showNewResourceModal.set(false)

    await wait(5000)
    await loadSpaceContents(spaceId, true)
  }

  const handleDeleteAutoSaved = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete all auto-saved resources from Your Stuff?'
    )
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

    await Promise.all(resources.map((x) => resourceManager.deleteResource(x)))

    toast.success('Auto-saved resources deleted!')

    await loadEverything()
  }

  const handleClearSpace = async () => {
    if (!$space) {
      log.error('No space found')
      return
    }

    const confirmed = window.confirm(
      'Are you sure you want to clear all resources from this space?'
    )
    if (!confirmed) {
      return
    }

    showSettingsModal.set(false)

    const resources = await oasis.getSpaceContents($space.id)
    await resourceManager.deleteSpaceEntries(resources.map((x) => x.id))

    toasts.success('Space cleared!')

    await loadSpaceContents($space.id, true)
  }

  export const handleDeleteSpace = async (
    shouldDeleteAllResources: boolean = false,
    abortSpaceCreation: boolean = false
  ) => {
    const confirmed = window.confirm(
      abortSpaceCreation
        ? 'Are you sure you want to abort the creation of this space?'
        : shouldDeleteAllResources
          ? 'Are you sure you want to delete this space and all of its resources?'
          : 'Are you sure you want to delete this space?'
    )

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
        await Promise.all(resources.map((x) => resourceManager.deleteResource(x.resource_id)))
      }

      log.debug('Deleting space', spaceId)
      await oasis.deleteSpace(spaceId)

      oasis.selectedSpace.set('all')
      dispatch('deleted', spaceId)

      if (!abortSpaceCreation) {
        toast?.success('Space deleted!')
      }

      await telemetry.trackDeleteSpace(DeleteSpaceEventTrigger.SpaceSettings)

      return true
    } catch (error) {
      log.error('Error deleting space:', error)
      if (!abortSpaceCreation) {
        toast?.error(
          'Error deleting space: ' + (typeof error === 'string' ? error : (error as Error).message)
        )
      }
    }
  }

  const handleLoadResource = (e: CustomEvent<Resource>) => {
    const resource = e.detail
    log.debug('Load resource:', resource)

    if ($space?.name.hideViewed) {
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
    resourceDetailsModalSelected.set(resourceId)
    showResourceDetails.set(true)

    resourceManager.getResource(resourceId, { includeAnnotations: false }).then((resource) => {
      if (resource) {
        telemetry.trackOpenResource(
          resource.type,
          isEverythingSpace
            ? OpenResourceEventFrom.Oasis
            : $space?.name.liveModeEnabled
              ? OpenResourceEventFrom.SpaceLive
              : OpenResourceEventFrom.Space
        )
      }
    })
  }

  const closeResourceDetailsModal = () => {
    showResourceDetails.set(false)
    resourceDetailsModalSelected.set(null)
  }

  const handleOpen = (e: CustomEvent<string>) => {
    if (handleEventsOutside) {
      dispatch('open', e.detail)
    } else {
      openResourceDetailsModal(e.detail)
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

  const handleGoBack = () => {
    dispatch('go-back')
  }

  const handleUpdateExistingSpace = async (e: CustomEvent) => {
    const {
      space,
      name,
      processNaturalLanguage,
      userPrompt,
      blacklistedResourceIds,
      llmFetchedResourceIds
    } = e.detail
    if (!space) {
      log.error('No space found')
      return
    }

    let createdSpace: Space | null = null

    try {
      await oasis.deleteSpace(space.id)

      createdSpace = await oasis.createSpace({
        ...space.name,
        folderName: name,
        smartFilterQuery: processNaturalLanguage ? userPrompt : undefined
      })

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
      toasts.success('Space updated successfully!')

      dispatch('select-space', createdSpace.id)
    } catch (error) {
      log.error('Error updating space:', error)
      toasts.error('Failed to update space: ' + (error as Error).message)
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
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if !hideResourcePreview && $isResourceDetailsModalOpen && $resourceDetailsModalSelected}
  <OasisResourceModalWrapper
    resourceId={$resourceDetailsModalSelected}
    {active}
    on:close={() => closeResourceDetailsModal()}
  />
{/if}

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
  <div class="relative wrapper bg-sky-100/50">
    {#if !isEverythingSpace && $space?.name.folderName !== '.tempspace'}
      <div
        class="drawer-bar transition-transform duration-300 ease-in-out"
        class:translate-y-24={hideBar && active}
      >
        {#if showBackBtn}
          <div
            class="absolute left-6 top-1/2 transform -translate-y-1/2 z-10 flex place-items-center"
          >
            <!-- <button
            on:click={handleGoBack}
            class="z-10 flex items-center justify-center space-x-2 transition-transform cursor-pointer hover:bg-sky-200 px-4 py-2 rounded-lg duration-200 focus-visible:shadow-focus-ring-button active:scale-95"
          >
            <Icon name="arrow.left" size="20px" />
          </button> -->

            <div class="settings-wrapper flex">
              <button
                class="settings-toggle flex flex-col items-start hover:bg-sky-200 rounded-md h-full gap-[0.33rem]"
                on:click={handleOpenSettingsModal}
              >
                {#if $space?.name.folderName}
                  <div
                    class="folder-name flex gap-2 items-center justify-center text-xl text-sky-800 pl-3 pr-2"
                  >
                    <span class="font-medium leading-[1]">{$space.name.folderName}</span>
                    <Icon name="chevron.down" size="20px" />
                  </div>
                  {#if $space.name.smartFilterQuery}
                    <span
                      class="relative text-sm left-3 pointer-events-none flex items-center justify-center mb-[0.1rem] place-self-start px-0.5"
                    >
                      <span class="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-1.5"></span>
                      <span class="text-blue-500 leading-[1]"> Smart Space</span>
                    </span>
                  {/if}
                {/if}
              </button>

              {#if $showSettingsModal}
                <div
                  class="modal-wrapper"
                  transition:fly={{ y: 10, duration: 160 }}
                  use:clickOutside={handleCloseSettingsModal}
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
            </div>

            <!-- <button on:click={() => navigator.clipboard.writeText(JSON.stringify($space))}>
            Copy Space Data
          </button> -->
          </div>
        {/if}
        {#if $space?.name.folderName !== '.tempspace'}
          <div
            class="drawer-chat-search bg-gradient-to-t from-sky-100/70 to-transparent via-bg-sky-100/10 bg-sky-100/70 backdrop-blur-xl backdrop-saturate-50"
          >
            <div class="search-input-wrapper">
              <SearchInput bind:value={$searchValue} on:search={handleSearch} />
            </div>

            {#if $space && ($space.name.liveModeEnabled || ($space.name.sources ?? []).length > 0 || $space.name.smartFilterQuery)}
              {#key '' + $space.name.liveModeEnabled + ($newlyLoadedResources.length > 0)}
                <button
                  class="live-mode"
                  class:live-enabled={$space.name.liveModeEnabled &&
                    $newlyLoadedResources.length === 0 &&
                    !$loadingSpaceSources}
                  disabled={$loadingSpaceSources}
                  on:click={handleRefreshLiveSpace}
                  use:tooltip={{
                    text:
                      $newlyLoadedResources.length > 0
                        ? 'New content has been added to the space. Click to refresh.'
                        : $space.name.liveModeEnabled
                          ? ($space.name.sources ?? []).length > 0
                            ? 'The sources will automatically be loaded when you open the space. Click to manually refresh.'
                            : 'New resources that match the smart query will automatically be added. Click to manually refresh.'
                          : ($space.name.sources ?? []).length > 0
                            ? 'Click to load the latest content from the connected sources'
                            : 'Click to load the latest content based on the smart query',
                    position: 'top'
                  }}
                >
                  {#if $loadingSpaceSources}
                    <Icon name="spinner" />
                    {#if $newlyLoadedResources.length > 0}
                      <span
                        >Processing items (<span class="tabular-nums"
                          >{$newlyLoadedResources.length} / {$processingSourceItems.length}</span
                        >)</span
                      >
                    {:else if ($space.name.sources ?? []).length > 0}
                      Loading source{($space.name.sources ?? []).length > 1 ? 's' : ''}…
                    {:else}
                      Refreshing…
                    {/if}
                  {:else if $newlyLoadedResources.length > 0}
                    {#await fetchNewlyAddedResourcePrevies()}
                      <Icon name="reload" />
                      Update Space with {$newlyLoadedResources.length} items
                    {:then previews}
                      <!-- <Icon name="reload" /> -->
                      <div class="flex items-center -space-x-3">
                        {#each previews as preview (preview.id)}
                          <img
                            class="w-6 h-6 rounded-lg overflow-hidden bg-white border-2 border-white/75 box-content"
                            src={`https://www.google.com/s2/favicons?domain=${preview.url}&sz=48`}
                            alt={`favicon`}
                          />
                        {/each}
                      </div>

                      {#if $newlyLoadedResources.length > previews.length}
                        <span>+{$newlyLoadedResources.length - previews.length} new items</span>
                      {:else}
                        <span
                          >{$newlyLoadedResources.length} new item{$newlyLoadedResources.length > 1
                            ? 's'
                            : ''}</span
                        >
                      {/if}
                    {/await}
                  {:else if $space.name.liveModeEnabled}
                    <Icon name="news" />
                    Auto Refresh
                  {:else if ($space.name.sources ?? []).length > 0}
                    <Icon name="reload" />
                    Refresh Sources
                  {:else}
                    <Icon name="reload" />
                    Smart Refresh
                  {/if}
                </button>
              {/key}
            {/if}

            <div class="drawer-chat active">
              <button class="close-button" on:click={handleCloseChat}>
                <Icon name="close" size="15px" />
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if $showChat}
      <div class="chat-wrapper">
        <button class="close-button" on:click={handleCloseChat}>
          <Icon name="close" size="15px" />
        </button>

        <Chat
          tab={{
            type: 'chat',
            query: $chatPrompt
          }}
          {resourceManager}
          resourceIds={!isEverythingSpace ? $resourceIds : []}
          on:navigate={(e) => {}}
          on:updateTab={(e) => {}}
        />
      </div>
    {/if}

    {#if $spaceResourceIds.length > 0 && !isEverythingSpace}
      <OasisResourcesView
        resourceIds={spaceResourceIds}
        selected={$selectedItem}
        isInSpace={!isEverythingSpace}
        on:click={handleItemClick}
        on:open={handleOpen}
        on:remove={handleResourceRemove}
        on:load={handleLoadResource}
        on:create-tab-from-space
        {searchValue}
      />

      {#if $loadingContents}
        <div class="floating-loading">
          <Icon name="spinner" size="20px" />
        </div>
      {/if}
    {:else if isEverythingSpace && $everythingContents.length > 0}
      <OasisResourcesViewSearchResult
        resources={everythingContents}
        selected={$selectedItem}
        scrollTop={0}
        on:click={handleItemClick}
        on:open={handleOpen}
        on:remove={handleResourceRemove}
        on:space-selected={handleSpaceSelected}
        on:open-space-as-tab
        isEverythingSpace={false}
        {searchValue}
      />

      {#if $loadingContents}
        <div class="floating-loading">
          <Icon name="spinner" size="20px" />
        </div>
      {/if}
    {:else if $space?.name.folderName === '.tempspace'}
      <CreateNewSpace
        on:update-existing-space={handleUpdateExistingSpace}
        on:abort-space-creation={handleAbortSpaceCreation}
        on:creating-new-space
        on:done-creating-new-space
        {space}
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
          <Icon name="leave" size="22px" />
          <p>Oops! It seems like this Space is feeling a bit empty.</p>
        </div>
      </div>
    {/if}
  </div>
</DropWrapper>

<!-- </div> -->

<style lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    border-radius: 12px;
  }

  .tabs {
    display: flex;
    gap: 1rem;
  }

  button {
    padding: 0.5rem;
    cursor: pointer;
  }

  .search-input-wrapper {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 32rem;
    view-transition-name: search-transition;
    &.active {
      height: auto;
      width: 100%;
    }
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
    z-index: 1000;
    margin: 0.5rem;

    .drawer-chat-search {
      position: relative;
      border: 0.5px solid rgba(0, 0, 0, 0.15);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      gap: 16px;
      padding: 0.5rem 1rem;
      transition: all 240ms ease-out;
      .drawer-chat {
        position: relative;
        z-index: 10;
        top: 0;

        .chat-input-wrapper {
          position: fixed;
          top: 0;
          left: 0;
        }

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

      .create-wrapper {
        position: relative;

        .create-new-resource {
          display: flex;
          justify-content: center;
          align-items: center;
          color: #7d7448;
          opacity: 0.7;
          &:hover {
            opacity: 1;
            background: transparent;
          }
        }
      }

      .search-transition {
        position: relative;
      }
    }
  }

  .new-content-btn {
    position: absolute;
    left: 50%;
    top: 6rem;
    transform: translateX(-50%);
    z-index: 100000;
    appearance: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 12px;
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0px 0px 0px 1px rgba(0, 0, 0, 0.2);
    color: #6d6d79;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.02rem;
  }

  .search-debug {
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
  }

  .chat-wrapper {
    position: absolute;
    top: 1rem;
    left: 50%;
    right: 50%;
    z-index: 100000;
    width: 100%;
    height: 100%;
    max-width: 50vw;
    max-height: 70vh;
    border-radius: 16px;
    transform: translateX(-50%);
    background: white;
    box-shadow:
      0px 0px 0px 1px rgba(0, 0, 0, 0.2),
      0px 16.479px 41.197px 0px rgba(0, 0, 0, 0.46);

    .close-button {
      position: fixed;
      top: 0.5rem;
      left: 0.5rem;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
      border-radius: 50%;
      border: 0.5px solid rgba(0, 0, 0, 0.15);
      transition: 60ms ease-out;
      background: white;
      z-index: 10000;
      &.rotated {
        transform: rotate(-45deg);
      }
      &:hover {
        outline: 3px solid rgba(0, 0, 0, 0.15);
      }
    }
  }

  .content-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #7d7448;

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
  }

  .settings-wrapper {
    position: relative;

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

  .live-mode {
    appearance: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 8px;
    background: #ffffffc0;
    border: none;
    color: #6d6d79;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.02rem;

    &.live-enabled {
      background: #ff4eed;
      color: white;

      &:hover {
        background: #fb3ee9;
      }
    }

    &:hover {
      background: #ffffff;
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
