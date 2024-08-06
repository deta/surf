<script lang="ts">
  import { derived, writable } from 'svelte/store'

  import { useLogScope } from '../../utils/log'
  import { useOasis } from '../../service/oasis'
  import { Icon } from '@horizon/icons'
  import Chat from '../Browser/Chat.svelte'
  import SearchInput from './SearchInput.svelte'
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import {
    Resource,
    ResourceManager,
    ResourcePost,
    ResourceTag,
    type ResourceObject,
    type ResourceSearchResultItem
  } from '../../service/resources'
  import { wait } from '../../utils/time'
  import OasisResourcesView from './OasisResourcesView.svelte'
  import {
    ResourceTagsBuiltInKeys,
    ResourceTypes,
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
  import { clickOutside, tooltip } from '../../utils/directives'
  import { fly } from 'svelte/transition'
  import OasisSpaceSettings from './OasisSpaceSettings.svelte'
  import { RSSParser } from '@horizon/web-parser/src/rss/index'
  import { summarizeText } from '../../service/ai'
  import type { ResourceContent } from '@horizon/web-parser'
  import { checkIfYoutubeUrl } from '../../utils/url'
  import OasisResourceModalWrapper from './OasisResourceModalWrapper.svelte'
  import { isModKeyAndKeyPressed } from '../../utils/keyboard'
  import { DragculaDragEvent } from '@horizon/dragcula'
  import type { Tab, TabPage } from '../Browser/types'

  export let spaceId: string
  export let active: boolean = false

  $: isEverythingSpace = spaceId === 'all'

  const log = useLogScope('OasisSpace')
  const oasis = useOasis()

  const dispatch = createEventDispatcher<{
    open: string
    'create-resource-from-oasis': string
    'new-tab': {
      url: string
      active: boolean
    }
    deleted: string
  }>()
  const toasts = useToasts()

  const resourceManager = oasis.resourceManager
  const spaces = oasis.spaces

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

  const REFRESH_SPACE_SOURCES_AFTER = 15 * 60 * 1000 // 15 minutes

  // const selectedSpace = derived([spaces, selectedSpaceId], ([$spaces, $selectedSpaceId]) => {
  //     return $spaces.find(space => space.id === $selectedSpaceId)
  // })

  const spaceContents = writable<SpaceEntry[]>([])
  const everythingContents = writable<ResourceSearchResultItem[]>([])

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
    if (spaceId === 'all') {
      loadEverything()
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

      let items = await oasis.getSpaceContents(id)
      log.debug('Loaded space contents:', items)

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
        log.debug('Skipping sorting, sorted by created_at')
      }

      spaceContents.set(items)

      const spaceData = fetchedSpace.name

      if (!skipSources && spaceData.liveModeEnabled) {
        if ((spaceData.sources ?? []).length > 0) {
          await loadSpaceSources(spaceData.sources!)
        } else if (spaceData.smartFilterQuery) {
          await updateLiveSpaceContentsWithAI(spaceData.smartFilterQuery)
        }
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

  const updateLiveSpaceContentsWithAI = async (query: string) => {
    try {
      loadingSpaceSources.set(true)

      const stringifiedQuery = JSON.stringify(query)
      log.debug('AI prompt:', stringifiedQuery)

      const response = await resourceManager.getResourcesViaPrompt(stringifiedQuery)
      log.debug('AI response:', response)

      const results = response.embedding_search_query
        ? response.embedding_search_results
        : response.sql_query_results
      if (!results) {
        log.debug('No results found')
        toasts.info('No results found')
        return
      }

      log.debug('Adding resources to space', results)

      await oasis.addResourcesToSpace(spaceId, results)

      await loadSpaceContents(spaceId, true)
    } catch (error) {
      log.error('Error updating live space contents with AI:', error)
    } finally {
      loadingSpaceSources.set(false)
    }
  }

  const loadSpaceSources = async (sources: SpaceSource[], forceFetch = false) => {
    try {
      loadingSpaceSources.set(true)

      await Promise.all(
        sources.map(async (source) => {
          try {
            if (
              forceFetch ||
              !source.last_fetched_at ||
              new Date().getTime() - new Date(source.last_fetched_at).getTime() >
                REFRESH_SPACE_SOURCES_AFTER
            ) {
              log.debug('Fetching source:', source)
              return await loadSpaceSource(source)
            } else {
              log.debug('Source already fetched recently, skipping:', source)
              return Promise.resolve()
            }
          } catch (error) {
            log.error('Error loading source:', error)
            toasts.error(`Failed to load source: ${source.url}`)
            return Promise.resolve()
          }
        })
      )

      await loadSpaceContents(spaceId, true)
    } catch (error) {
      log.error('Error loading space sources:', error)
    } finally {
      loadingSpaceSources.set(false)
    }
  }

  const loadSpaceSource = async (source: SpaceSource) => {
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

    const MAX_ITEMS = 25

    if (rssResult.items) {
      const parsed = await Promise.all(
        rssResult.items.slice(0, MAX_ITEMS).map(async (item) => {
          try {
            log.debug('Processing RSS item:', item)

            if (!item.link) {
              log.debug('No link found in RSS item:', item)
              return
            }

            const sourceURL = new URL(source.url)
            const canonicalURL =
              sourceURL.hostname === 'news.ycombinator.com' ? item.comments : item.link

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
                return
              } else {
                log.debug('Resource not in space, adding')
                const resource = await resourceManager.getResource(resourceId)
                if (resource) {
                  spaceContents.update((contents) => {
                    return [
                      ...contents,
                      {
                        id: resource.id,
                        resource_id: resource.id,
                        space_id: $space!.id,
                        manually_added: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      }
                    ]
                  })

                  return resource
                }
              }
            }

            let parsed: {
              resource: ResourceObject
              content?: ResourceContent
            } | null = null

            if (checkIfYoutubeUrl(sourceURL)) {
              log.debug('Youtube video, skipping webview parsing:', item)

              const postData = RSSParser.parseYouTubeRSSItemToPost(item)
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
                  ResourceTag.viewedByUser(false)
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
                  sourceURI: canonicalURL
                },
                [
                  ResourceTag.canonicalURL(canonicalURL),
                  ResourceTag.spaceSource('rss'),
                  ResourceTag.hideInEverything(),
                  ResourceTag.viewedByUser(false)
                ]
              )
            }

            spaceContents.update((contents) => {
              return [
                ...contents,
                {
                  id: parsed.resource.id,
                  resource_id: parsed.resource.id,
                  space_id: $space!.id,
                  manually_added: 0,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }
              ]
            })

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
                const summary = await summarizeText(
                  contentToSummarize,
                  'Summarize the given text into a single paragraph with a maximum of 400 characters. Make sure you are still conveying the main idea of the text while keeping it concise. If possible try to be as close to 400 characters as possible. Do not go over 400 characters in any case.'
                )
                log.debug('summary:', summary)

                await resourceManager.updateResourceMetadata(parsed.resource.id, {
                  userContext: summary
                })
              }
            } catch (error) {
              log.error('Error summarizing content:', error)
            }

            log.debug('Created RSS resource:', parsed.resource)
            return parsed.resource
          } catch (error) {
            log.error('Error processing RSS item:', error)
            return null
          }
        })
      )

      log.debug('Parsed resources:', parsed)

      const resources = parsed.filter((x) => x) as Resource[]
      if (resources.length > 0) {
        await resourceManager.addItemsToSpace(
          spaceId,
          resources.map((r) => r.id)
        )
      }
    }
  }

  const handleRefreshLiveSpace = async () => {
    if (!$space) {
      log.error('No space found')
      return
    }

    if ($space.name.smartFilterQuery) {
      await updateLiveSpaceContentsWithAI($space.name.smartFilterQuery)
    }

    const sources = $space.name.sources
    if (!sources || sources.length === 0) {
      log.debug('No sources found')
      return
    }

    await loadSpaceSources(sources, true)
  }

  const handleChat = async (e: CustomEvent) => {
    const result = e.detail
    chatPrompt.set(result)

    if (!isEverythingSpace) {
      const result = await oasis.getSpaceContents(spaceId)
      console.log('chatting with folder', result)

      resourceIds.set(result.map((r) => r.resource_id))
    } else {
      resourceIds.set([])
    }

    await tick()

    showChat.set(true)
    searchValue.set('')
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
    showSettingsModal.set(true)
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

    const result = await resourceManager.searchResources(value, [
      ResourceManager.SearchTagDeleted(false),
      ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
      ...hashtags.map((x) => ResourceManager.SearchTagHashtag(x))
    ])

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
        ? `Remove reference? The original will still be in Everything.`
        : numberOfReferences > 0
          ? `This resource will be deleted permanently including all of its ${numberOfReferences} references.`
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
        spaceContents.update((contents) => {
          return contents.filter((x) => x.resource_id !== resourceId)
        })
      }
    } catch (error) {
      log.error('Error removing references:', error)
    }

    if (isEverythingSpace || isFromLiveSpace) {
      log.debug('deleting resource from oasis', resourceId)
      await resourceManager.deleteResource(resourceId)
      everythingContents.update((contents) => {
        return contents.filter((x) => x.id !== resourceId)
      })
    }

    log.debug('Resource removed:', resourceId)
    toasts.success('Resource deleted!')
  }

  const handleItemClick = (e: CustomEvent<string>) => {
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

      dispatch('new-tab', { url: url, active: e.shiftKey })
    }
  }

  const handleDrop = async (e: CustomEvent<DragculaDragEvent>) => {
    const drag = e.detail

    if (!(drag instanceof DragculaDragEvent)) {
      log.warn('Detected non-dragcula drag event!', e)
      return
    }

    const toast = toasts.loading(`${drag.effect === 'move' ? 'Moving' : 'Copying'} to space...`)
    e.preventDefault()

    let resourceIds: string[] = []
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

      newResources.forEach((r) => resourceIds.push(r.id))
    } else {
      log.debug('Dropped dragcula', drag.data)

      const existingResources: string[] = []

      const dragData = drag.data as { 'farc/tab': Tab; 'horizon/resource/id': string }
      if (dragData['farc/tab'] !== undefined) {
        if (dragData['horizon/resource/id'] !== undefined) {
          const resourceId = dragData['horizon/resource/id']
          resourceIds.push(resourceId)
          existingResources.push(resourceId)
        } else if (dragData['farc/tab'].type === 'page') {
          const tab = dragData['farc/tab'] as TabPage

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
            newResources.forEach((r) => resourceIds.push(r.id))
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
            }
          })
        )
      }
    }

    if (spaceId !== 'all') {
      await oasis.addResourcesToSpace(spaceId, resourceIds)
      await loadSpaceContents(spaceId)
    } else {
      await loadEverything()
    }

    toast.success(
      `Resources ${drag.isNative ? 'added' : drag.effect === 'move' ? 'moved' : 'copied'}!`
    )
  }

  const handleDragEnter = (e: CustomEvent<DragculaDragEvent>) => {
    const drag = e.detail

    const dragData = drag.data as { 'farc/tab': Tab }
    if (
      (active && e.detail.isNative) ||
      (active && dragData['farc/tab'] !== undefined && dragData['farc/tab'].type !== 'space')
    ) {
      e.preventDefault() // Allow the drag
    }
  }

  const handleCreateResource = async (e: CustomEvent<string>) => {
    dispatch('create-resource-from-oasis', e.detail)
    showNewResourceModal.set(false)

    await wait(5000)
    await loadSpaceContents(spaceId)
  }

  const handleDeleteAutoSaved = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete all auto-saved resources from Oasis?'
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

    await loadSpaceContents($space.id)
  }

  const handleDeleteSpace = async (e: CustomEvent<boolean>) => {
    const shouldDeleteAllResources = e.detail

    const confirmed = window.confirm(
      shouldDeleteAllResources
        ? 'Are you sure you want to delete this space and all of its resources?'
        : 'Are you sure you want to delete this space?'
    )
    if (!confirmed) {
      return
    }

    const toast = toasts.loading('Deleting space…')

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
      toast.success('Space deleted!')
    } catch (error) {
      log.error('Error deleting space:', error)
      toast.error('Error deleting space: ' + (error as Error).message)
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
  }

  const closeResourceDetailsModal = () => {
    showResourceDetails.set(false)
    resourceDetailsModalSelected.set(null)
  }

  const handleOpen = (e: CustomEvent<string>) => {
    openResourceDetailsModal(e.detail)
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if $isResourceDetailsModalOpen && $resourceDetailsModalSelected}
  <OasisResourceModalWrapper
    resourceId={$resourceDetailsModalSelected}
    {active}
    on:close={() => closeResourceDetailsModal()}
    on:new-tab
  />
{/if}

<DropWrapper {spaceId} on:Drop={handleDrop} on:DragEnter={handleDragEnter}>
  <div class="wrapper">
    <div class="drawer-bar">
      <div class="drawer-chat-search">
        <div class="create-wrapper">
          <button
            class="create-new-resource"
            on:click={handleOpenNewResourceModal}
            use:tooltip={{
              text: 'Create New Resource',
              position: 'bottom'
            }}
          >
            <Icon name="add" size="28px" />
          </button>

          {#if $showNewResourceModal}
            <div
              class="modal-wrapper"
              transition:fly={{ y: 10, duration: 160 }}
              use:clickOutside={handleCloseNewResourceModal}
            >
              <CreateNewResource on:open-and-create-resource={handleCreateResource} />
            </div>
          {/if}
        </div>

        <div class="search-input-wrapper">
          <SearchInput bind:value={$searchValue} on:chat={handleChat} on:search={handleSearch} />
        </div>

        <div class="settings-wrapper">
          <button
            class="settings-toggle"
            on:click={handleOpenSettingsModal}
            use:tooltip={{ text: 'Open Settings', position: 'bottom' }}
          >
            <Icon name="settings" size="25px" />
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
                on:delete={handleDeleteSpace}
                on:load={handleLoadSpace}
                on:delete-auto-saved={handleDeleteAutoSaved}
              />
            </div>
          {/if}
        </div>

        {#if $space && $space.name.liveModeEnabled}
          <button
            class="live-mode"
            disabled={$loadingSpaceSources}
            on:click={handleRefreshLiveSpace}
            use:tooltip={{ text: 'Click to refresh', position: 'bottom' }}
          >
            {#if $loadingSpaceSources}
              <Icon name="spinner" />
              Refreshing…
            {:else}
              <Icon name="news" />
              Live Space
            {/if}
          </button>
        {/if}

        <div class="drawer-chat active">
          <button class="close-button" on:click={handleCloseChat}>
            <Icon name="close" size="15px" />
          </button>
        </div>
      </div>
      <!-- <ProgressiveBlur /> -->
    </div>

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

    {#if $spaceResourceIds.length > 0}
      <OasisResourcesView
        resourceIds={spaceResourceIds}
        selected={$selectedItem}
        showResourceSource={isSearching}
        on:click={handleItemClick}
        on:open={handleOpen}
        on:remove={handleResourceRemove}
        on:load={handleLoadResource}
        on:new-tab
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
        searchResults={$searchResults}
        on:click={handleItemClick}
        on:open={handleOpen}
        on:remove={handleResourceRemove}
        on:new-tab
      />

      {#if $loadingContents}
        <div class="floating-loading">
          <Icon name="spinner" size="20px" />
        </div>
      {/if}
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
  -
</DropWrapper>

<!-- </div> -->

<style lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    overflow: hidden;
    border-radius: 12px;
  }

  .tabs {
    display: flex;
    gap: 1rem;
  }

  button {
    padding: 0.5rem;
    border: none;
    background: none;
    cursor: pointer;
  }

  button:hover {
    background: #f0f0f0;
  }

  .search-input-wrapper {
    position: relative;
    z-index: 10;
    width: 100%;
    height: 3.3rem;
    max-width: 32rem;
    view-transition-name: search-transition;
    &.active {
      height: auto;
      width: 100%;
    }
  }

  .modal-wrapper {
    position: absolute;
    top: 4rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
  }

  .drawer-bar {
    position: relative;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    border-top: 0.5px solid rgba(0, 0, 0, 0.15);

    .drawer-chat-search {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      gap: 16px;
      padding: 1rem 1rem 1rem 1rem;
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
    overflow-y: scroll;
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
    background: #ff4eed;
    border: none;
    color: white;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.02rem;

    &:hover {
      background: #fb3ee9;
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
