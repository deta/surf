<script lang="ts">
  import { setContext, tick } from 'svelte'
  import { get, writable } from 'svelte/store'
  import { WebParser, type WebMetadata, type DetectedWebApp } from '@horizon/web-parser'
  import { fly } from 'svelte/transition'

  import {
    DrawerProvider,
    DrawerSearch,
    DrawerCancel,
    DrawerChat,
    DrawerNavigation,
    DrawerContentWrapper,
    provideDrawer,
    DrawerContentItem,
    DrawerContentMasonry,
    DrawerContenEmpty,
    DrawerDetailsProximity,
    ResourceOverlay,
    AlreadyDroppedTooltip,
    type SearchQuery
  } from '@horizon/drawer'

  import type { ResourceDocument, ResourceLink } from '../../service/resources'
  import { Icon } from '@horizon/icons'

  import type { Horizon } from '../../service/horizon'
  import ResourcePreview from '../Resources/ResourcePreview.svelte'
  import { useLogScope } from '../../utils/log'
  import {
    MEDIA_TYPES,
    processDrop,
    type MediaParserResult,
    processFile
  } from '../../service/mediaImporter'
  import { onMount } from 'svelte'
  import {
    ResourceTag,
    ResourceManager,
    type ResourceObject,
    ResourceJSON,
    ResourceNote,
    type ResourceSearchResultItem,
    getPrimaryResourceType
  } from '../../service/resources'

  import { folderManager } from '../../service/folderManager'

  import {
    ResourceTypes,
    type ResourceData,
    type SFFSResourceTag,
    type SFFSResourceMetadata,
    type SFFSSearchParameters
  } from '../../types'

  import { parseStringIntoUrl } from '../../utils/url'

  import type { ParsedMetadata } from '../../utils/parseMetadata'
  import { hasClassOrParentWithClass } from '@horizon/tela'
  import { useAnimationFrameThrottle, useDebounce, useThrottle } from '../../utils/debounce'
  import ResourceLoading from '../Resources/ResourceLoading.svelte'
  import { generateID } from '../../utils/id'
  import { getEditorContentText } from '@horizon/editor'
  import DrawerDetailsWrapper from '../Drawer/DrawerDetailsWrapper.svelte'
  import { TelemetryEventTypes } from '@horizon/types'
  import type { Tab } from '@horizon/drawer/src/lib/Tabs.svelte'
  import MiniBrowser from '@horizon/core/src/lib/components/Browser/MiniBrowser.svelte'

  export const drawer = provideDrawer()

  export let horizon: Horizon
  export let resourceManager: ResourceManager

  const cards = horizon.cards
  const resourcesInMemory = resourceManager.resources

  const isDrawerShown = drawer.show

  const log = useLogScope('DrawerWrapper')

  const tabs = [
    { key: 'all', label: 'All', icon: 'square.rotated' },
    { key: 'horizon', label: 'On this Horizon', icon: 'rectangle' },
    { key: 'images', label: 'Images', icon: 'image' },
    { key: 'documents', label: 'Documents', icon: 'document' },
    { key: 'posts', label: 'Posts', icon: 'link' },
    { key: 'links', label: 'Links', icon: 'link' },
    { key: 'articles', label: 'Articles', icon: 'link' },
    { key: 'archived', label: 'Archived', icon: 'archive' }
  ] as Tab[]

  const viewState = drawer.viewState

  const showDropZone = writable(false)
  const isDraggingDrawerItem = writable(false)

  const selectedResource = writable<ResourceObject | undefined>(undefined)

  drawer.selectedTab.set('all')

  const searchQuery = writable<SearchQuery>({ value: '', tab: 'all' })

  const droppedInputElements = writable<MediaParserResult[]>([])

  const isSaving = writable(false)
  const alreadyDropped = writable(false)
  const showMiniBrowser = writable(false)

  $: if ($viewState === 'default') {
    $droppedInputElements = []
    handleDropZoneClickOutside()
  }

  $: if (!$isDrawerShown) {
    viewState.set('default')
    searchQuery.set({ value: '', tab: 'all' })
    drawer.selectedTab.set('all')
    blockOpenTracking = false
    blockDetailsTracking = false
  }

  let blockOpenTracking = false
  $: if ($isDrawerShown && !blockOpenTracking) {
    blockOpenTracking = true
    horizon.telemetry.trackEvent(TelemetryEventTypes.OasisOpen, {})
  }

  let blockDetailsTracking = false
  $: if ($isDrawerShown && $viewState === 'details' && !blockDetailsTracking) {
    blockDetailsTracking = true
    horizon.telemetry.trackEvent(
      TelemetryEventTypes.OasisOpenResourceDetails,
      $selectedResource
        ? {
            kind: getPrimaryResourceType($selectedResource?.type),
            type: $selectedResource?.type
          }
        : {}
    )
  } else if ($isDrawerShown && $viewState !== 'details') {
    blockDetailsTracking = false
  }

  let refreshContentLayout: () => Promise<void>

  let searchResult: ResourceSearchResultItem[] = []
  let detectedInput = false
  let parsedInput: {
    url: string
    linkMetadata: WebMetadata
    appInfo: DetectedWebApp | null
  } | null = null

  const showSearchDebug = writable(false)
  const semanticDistanceThreshold = writable(1.0)
  const proximityDistanceThreshold = writable(500)
  const semanticSearchEnabled = writable(true)

  const debouncedRefreshContentLayout = useAnimationFrameThrottle(() => {
    if (refreshContentLayout) {
      return refreshContentLayout()
    }
  }, 250)

  const runSearch = async (query: string, tab: string | null) => {
    log.debug('Searching for', query, 'in', tab)

    const tags = [] as SFFSResourceTag[]

    // EXAMPLE: searching by resource type (exact match)
    // tags.push(
    //     ResourceManager.SearchTagResourceType(ResourceTypes.LINK)
    // )

    // EXAMPLE: searching by resource type prefix
    // tags.push(
    //     ResourceManager.SearchTagResourceType(ResourceTypes.POST, true)
    // )

    // EXAMPLE: search by hostname (using suffix)
    // tags.push(
    //     ResourceManager.SearchTagHostname('deta.space')
    // )

    if (tab === 'archived') {
      tags.push(ResourceManager.SearchTagDeleted()) // TODO: implement recovering of deleted resources
    } else if (tab === 'horizon') {
      tags.push(ResourceManager.SearchTagHorizon(horizon.id))
    } else if (tab === 'images') {
      tags.push(ResourceManager.SearchTagResourceType('image', true))
    } else if (tab === 'documents') {
      tags.push(ResourceManager.SearchTagResourceType(ResourceTypes.DOCUMENT, true))
    } else if (tab === 'posts') {
      tags.push(ResourceManager.SearchTagResourceType(ResourceTypes.POST, true))
    } else if (tab === 'links') {
      tags.push(ResourceManager.SearchTagResourceType(ResourceTypes.LINK))
    } else if (tab === 'articles') {
      tags.push(ResourceManager.SearchTagResourceType(ResourceTypes.ARTICLE))
    }

    const parsedParameters = {
      semanticEnabled: $semanticSearchEnabled,
      semanticDistanceThreshold: $semanticDistanceThreshold,
      proximityDistanceThreshold: $proximityDistanceThreshold
    } as SFFSSearchParameters

    if (tab !== 'archived') {
      // we have to explicitly search for non-deleted resources
      tags.push(ResourceManager.SearchTagDeleted(false))
    }

    const result = await resourceManager.searchResources(query, tags, parsedParameters)
    if (query === '') {
      result.reverse()
    }

    log.debug('Search result', result)

    // this is needed so local results needed for the processing state are not removed when new results are added
    const previousLocalResults = searchResult.filter((r) => r.engine === 'local')
    searchResult = [...previousLocalResults, ...result]

    await tick()

    if (refreshContentLayout) {
      refreshContentLayout()
    }

    // HACK: sometimes the layout is not updated, so we force it
    setTimeout(() => {
      if (refreshContentLayout) {
        refreshContentLayout()
      }
    }, 100)

    if (query !== '' || tab !== 'all') {
      horizon.telemetry.trackEvent(TelemetryEventTypes.OasisSearch, {
        tab: tab ?? 'all'
      })
    }
  }

  const runDebouncedSearch = useDebounce(runSearch, 500)

  const handleSearch = (e: CustomEvent<SearchQuery>) => {
    const query = e.detail

    const url = parseStringIntoUrl(query.value)
    if (url) {
      detectedInput = true
      parseMetadata(url.href)
    } else {
      detectedInput = false
    }

    log.debug('Searching for', query.value, 'in', query.tab)
    searchQuery.set(query)
  }

  export const parseMetadata = async (url: string) => {
    const webParser = new WebParser(url)

    const appInfo = await webParser.getPageInfo()
    log.debug('AppInfo', appInfo)

    const metadata = await webParser.getSimpleMetadata()
    log.debug('Metadata', metadata)

    parsedInput = {
      url: url,
      appInfo: appInfo,
      linkMetadata: metadata
    }
  }

  const abortSearch = () => {
    runSearch('', get(drawer.selectedTab))
  }

  const openResourceDetail = (resource: ResourceObject) => {
    document.startViewTransition(() => {
      $selectedResource = resource
      viewState.set('details')
    })
  }

  const handleResourceDetailClick = async (resource: ResourceObject) => {
    if (
      resource.type === ResourceTypes.LINK ||
      resource.type === ResourceTypes.ARTICLE ||
      resource.type.startsWith(ResourceTypes.POST)
    ) {
      const data = await (resource as ResourceLink).getParsedData()
      window.open(data.url, '_blank')
      drawer.close()
    } else {
      openResourceDetail(resource)
    }
  }

  const handleResourceClick = async (resource: ResourceObject) => {
    $selectedResource = resource
  }

  drawer.onOpenItem(async (resourceId: string) => {
    const resource = await resourceManager.getResource(resourceId)
    if (!resource) {
      log.error('Resource not found', resourceId)
      return
    }

    openResourceDetail(resource)
  })

  const handleResourceRemove = async (e: CustomEvent<string>) => {
    const resourceId = e.detail

    const confirm = window.confirm(`Are you sure you want to delete this resource?`)
    if (confirm) {
      const resource = await resourceManager.deleteResource(resourceId)
      log.debug('Resource deleted', resource)
    }

    return
  }

  const handleChat = async (payload: any) => {
    try {
      log.debug(
        `Creation of ${payload.detail.$parsedURLs.length} items triggered from chat input`,
        payload.detail
      )

      const userGeneratedText = payload.detail.$inputText

      const links = payload.detail.$parsedURLs as ParsedMetadata[]
      const mediaItems = $droppedInputElements
      const textMediaItems = $droppedInputElements.filter((item) => item.type === 'text')

      isSaving.set(true)

      // Create a text card if there is nothing but text
      if (links.length === 0 && (mediaItems.length === 0 || textMediaItems.length > 0)) {
        const metadata = textMediaItems.length > 0 ? textMediaItems[0].metadata : {}
        await resourceManager.createResourceNote(userGeneratedText, metadata, [
          // TODO: Add another resource tag
          ResourceTag.paste()
        ])
      }

      if (links) {
        for (const link of links) {
          createResourceFromParsedURL(link, userGeneratedText)
        }
      }

      if (mediaItems) {
        createResourcesFromMediaItems(mediaItems, userGeneratedText)
      }
    } catch (err) {
      log.debug('Error creating resources from chat input', err)
    } finally {
      isSaving.set(false)
    }

    document.startViewTransition(async () => {
      viewState.set('default')
    })

    showDropZone.set(false)
  }

  let receivedDrop = false
  const handleDropForwarded = async (e: any) => {
    const event = e.detail
    log.debug('Dropped', event)

    const parsed = await processDrop(event)
    console.log('RECIEVEPARSEDDATA', parsed)

    const containsResource = parsed.some((item) => item.type === 'resource')
    alreadyDropped.set(containsResource)

    // Filter out all items where the type is 'resource'
    const filteredParsed = parsed.filter((item) => item.type !== 'resource')

    receivedDrop = true
    droppedInputElements.update((items) => {
      filteredParsed.forEach((parsedItem) => {
        items.push(parsedItem)
      })
      return items
    })

    setTimeout(() => {
      alreadyDropped.set(false)
    }, 4000)
    log.debug('DROPPED ITEM', $droppedInputElements)
  }

  const handleFileUpload = async (e: any) => {
    const files = e.detail
    let parsed: MediaParserResult[] = []
    for (const file of files) {
      parsed.push(await processFile(file))
    }

    droppedInputElements.update((items) => {
      parsed.forEach((parsedItem) => {
        items.push(parsedItem)
      })
      return items
    })
    log.debug('UPLOADED FILES', parsed)
  }

  const handleDrop = async (e: CustomEvent<DragEvent>) => {
    const event = e.detail
    log.debug('Dropped', event)

    const isOwnDrop = event.dataTransfer?.types.includes(MEDIA_TYPES.RESOURCE)
    if (isOwnDrop) {
      log.debug('Own drop detected, ignoring...')
      log.debug(event.dataTransfer?.files)
      return
    }

    const parsed = await processDrop(event)
    log.debug('Parsed', parsed)

    createResourcesFromMediaItems(parsed, '')
  }

  const createResourcesFromMediaItems = async (
    parsed: MediaParserResult[],
    userGeneratedText: string
  ) => {
    await Promise.all(
      parsed.map(async (item) => {
        log.debug('processed item', item)
        log.debug('usercontext', userGeneratedText)
        item.metadata.userContext = userGeneratedText

        let resource
        if (item.type === 'text') {
          resource = await resourceManager.createResourceNote(item.data, item.metadata, [
            ResourceTag.dragLocal()
          ])
        } else if (item.type === 'url') {
          resource = await extractAndCreateWebResource(item.data.href, item.metadata, [
            ResourceTag.dragBrowser() // we assume URLs were dragged from the browser
          ])
        } else if (item.type === 'file') {
          resource = await resourceManager.createResourceOther(item.data, item.metadata, [
            ResourceTag.dragLocal()
          ])
        }

        log.debug('Created resource', resource)
      })
    )

    runSearch($searchQuery.value, $searchQuery.tab)
  }

  const createResourceFromParsedURL = async (item: ParsedMetadata, userGeneratedText: string) => {
    const id = generateID()

    try {
      const metadata = {
        name: item.linkMetadata.title || new URL(item.url).hostname,
        alt: item.linkMetadata.description,
        sourceURI: '',
        userContext: userGeneratedText
      }

      // TODO: this is a hack to add the resource to the search result without waiting for the resource to be created, we should find a better way to do this
      searchResult = [
        {
          id: id,
          resource: {
            id: item.url,
            type: ResourceTypes.LINK,
            metadata: metadata,
            rawData: null,
            path: item.url,
            updatedAt: new Date().toISOString()
          } as any,
          engine: 'local',
          cardIds: []
        },
        ...searchResult
      ]

      refreshContentLayout()

      const resource = await extractAndCreateWebResource(item.url, metadata, [ResourceTag.paste()])

      log.debug('Created resource', resource)
    } catch (err) {
      log.error('Error creating resource from parsed URL', err)
    } finally {
      // remove the resource from the search result as it has been created
      searchResult = searchResult.filter((r) => r.id !== id)
    }
  }

  const extractAndCreateWebResource = async (
    url: string,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) => {
    log.debug('Extracting resource from', url)

    const webParser = new WebParser(url)

    // Extract a resource from the web page using a webview, this should happen only when saving the resource
    const extractedResource = await webParser.extractResourceUsingWebview(document)
    log.debug('extractedResource', extractedResource)

    if (!extractedResource) {
      log.debug('No resource extracted, saving as link')

      return resourceManager.createResourceLink({ url: url }, metadata, tags)
    }

    return resourceManager.createResourceOther(
      new Blob([JSON.stringify(extractedResource.data)], { type: extractedResource.type }),
      metadata,
      tags
    )
  }

  const handleItemDragStart = (e: DragEvent, resource: ResourceObject) => {
    log.debug('Item drag start', e, resource.id)
    isDraggingDrawerItem.set(false)

    if (
      e.target instanceof Element &&
      (e.target.classList.contains('drawer-item') || e.target.closest('.drawer-item'))
    ) {
      console.log('DRAGGING DRAWER ELEMENT')
      isDraggingDrawerItem.set(true)
    }

    if (!e.dataTransfer) {
      log.error('No dataTransfer found')
      return
    }

    // this will be used by the MediaImporter to import the resource and create a card
    e.dataTransfer.setData(MEDIA_TYPES.RESOURCE, resource.id)

    horizon.telemetry.trackEvent(TelemetryEventTypes.OasisDrag, {
      kind: getPrimaryResourceType(resource.type),
      type: resource.type
    })

    log.debug('Resource type', resource.type)
    if (
      resource.type.startsWith(ResourceTypes.LINK) ||
      resource.type.startsWith(ResourceTypes.POST) ||
      resource.type.startsWith(ResourceTypes.CHAT_MESSAGE) ||
      resource.type.startsWith(ResourceTypes.ARTICLE)
    ) {
      const data = (resource as ResourceJSON<ResourceData>).parsedData
      log.debug('parsed resource data')

      // We cannot read the data here as the drag start event is synchronous
      if (!data) {
        log.warn('No parsed data found, cannot add primitive data to dataTransfer')
        return
      }

      if ((data as any).url) {
        e.dataTransfer.setData('text/uri-list', (data as any).url)
      } else {
        e.dataTransfer.setData('text/plain', JSON.stringify(data))
      }
    } else if (resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE) {
      const data = get((resource as ResourceNote).parsedData)
      log.debug('parsed resource data', data)

      // We cannot read the data here as the drag start event is synchronous
      if (!data) {
        log.warn('No parsed data found, cannot add primitive data to dataTransfer')
        return
      }

      const textContent = getEditorContentText(data)
      e.dataTransfer.setData('text/plain', textContent)
      e.dataTransfer.setData('text/html', data)
    } else if (resource.type.startsWith(ResourceTypes.DOCUMENT)) {
      const document = (resource as ResourceDocument).parsedData
      log.debug('parsed resource data')

      // We cannot read the data here as the drag start event is synchronous
      if (!document) {
        log.warn('No parsed data found, cannot add primitive data to dataTransfer')
        return
      }

      e.dataTransfer.setData('text/plain', document.content_plain)
      e.dataTransfer.setData('text/html', document.content_html)
    } else if (resource.type.startsWith('image/')) {
      const filePath = resource.path
      log.debug('file path', filePath)

      e.preventDefault()
      window.api.startDrag(resource.id, filePath, resource.type)
      // const blob = resource.rawData
      // if (!blob) {
      //   log.error('No data found')
      //   return
      // }

      // log.debug('Creating URL out of resource', blob)

      // const reader = new FileReader();
      // reader.readAsDataURL(blob);
      // reader.onloadend = () => {
      //   const base64data = reader.result;
      //   const base64 = base64data.split(',')[1]
      //   const url = `data:${blob.type};base64,${base64}`
      //   log.debug('Created URL', url)
      //   e.dataTransfer.setData('text/uri-list', url)
      // }
    } else {
      const blob = resource.rawData
      if (!blob) {
        log.error('No data found')
        return
      }

      log.debug('Creating file out of resource', blob)

      // convert to file
      const file = new File([blob], resource?.metadata?.name ?? 'unknown', {
        type: blob.type,
        lastModified: new Date(resource.updatedAt).getTime()
      })

      log.debug('Created file', file)

      // TODO: this is not usable by most other applications. Needs further investigation
      const createdItem = e.dataTransfer.items.add(file)
      log.debug('Added file to dataTransfer', createdItem)
    }

    e.dataTransfer.setData(MEDIA_TYPES.RESOURCE, resource.id)
  }

  const handleDetailsBack = () => {
    document.startViewTransition(async () => {
      viewState.set('default')
      searchQuery.set({ value: '', tab: 'all' })
      drawer.selectedTab.set('all')
      // if($searchQuery.value !== '') {
      //   viewState.set('search')
      // } else {
      //   viewState.set('default')
      // }
    })
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'j') {
      $showSearchDebug = !$showSearchDebug

      viewState.set('search')
    }

    if (e.key === ' ') {
      e.preventDefault()
      $showMiniBrowser = !$showMiniBrowser
    }
  }

  let dragCount = 0
  const handleWindowDragEnter = (e: DragEvent) => {
    if ($viewState === 'details' || $isDraggingDrawerItem) {
      return
    }
    log.debug('drag enter', e)

    const target = e.target as HTMLElement
    log.debug('drag enter target', target)

    viewState.set('chatInput')

    const isDropZone = hasClassOrParentWithClass(target, 'drawer-root')
    log.debug('isDropZone', isDropZone)

    if (isDropZone) {
      return
    }

    dragCount++

    if (dragCount > 0) {
      showDropZone.set(true)
    }

    isDraggingDrawerItem.set(false)
  }

  const handleWindowDragEnd = (e: DragEvent) => {
    log.debug('drag end', e)

    if (!receivedDrop) {
      showDropZone.set(false)
      isDraggingDrawerItem.set(false)
    }

    dragCount = 0
    receivedDrop = false
    isDraggingDrawerItem.set(false)
  }

  const handleDropZoneClickOutside = () => {
    log.debug('click outside')
    showDropZone.set(false)
    receivedDrop = false
    viewState.set('default')
    $droppedInputElements = []
  }

  const handleNearbyResultClick = (e: CustomEvent<ResourceSearchResultItem>) => {
    log.debug('Nearby resource clicked', e.detail)
    const result = e.detail
    const resource = result.resource
    if (!resource) {
      log.error('No resource found', result)
      return
    }

    log.debug('opening resource details', resource)
    // viewState.set('default')

    // TODO: fix
    document.startViewTransition(async () => {
      $selectedResource = resource
      viewState.set('details')
    })
  }

  const handleResourceLoad = (e: CustomEvent<string>) => {
    debouncedRefreshContentLayout()
  }

  let initialLoad = true
  onMount(() => {
    const unsubscribeQuery = searchQuery.subscribe(({ value, tab }) => {
      if (initialLoad) return
      runSearch(value, tab)
    })

    const unsubscribeCards = cards.subscribe((cards) => {
      if (initialLoad || !$isDrawerShown) return
      log.debug('Cards changed', cards)
      runDebouncedSearch($searchQuery.value, $searchQuery.tab)
    })

    const unsubscribeResources = resourcesInMemory.subscribe((resources) => {
      if (initialLoad) return
      log.debug('Resources changed', resources)
      runDebouncedSearch($searchQuery.value, $searchQuery.tab)
    })

    const unsubscribeSemanticDistanceThreshold = semanticDistanceThreshold.subscribe((value) => {
      runSearch($searchQuery.value, $searchQuery.tab)
    })

    const unsubscribeProximityDistanceThreshold = proximityDistanceThreshold.subscribe((value) => {
      runSearch($searchQuery.value, $searchQuery.tab)
    })

    const unsubscribeSemanticSearchEnabled = semanticSearchEnabled.subscribe((value) => {
      runSearch($searchQuery.value, $searchQuery.tab)
    })

    runSearch('', null)

    setTimeout(() => {
      log.debug('Initial load done')
      initialLoad = false
    }, 3000)

    return () => {
      if (unsubscribeQuery) {
        unsubscribeQuery()
      }

      if (unsubscribeCards) {
        unsubscribeCards()
      }

      if (unsubscribeResources) {
        unsubscribeResources()
      }

      if (unsubscribeSemanticDistanceThreshold) {
        unsubscribeSemanticDistanceThreshold()
      }

      if (unsubscribeProximityDistanceThreshold) {
        unsubscribeProximityDistanceThreshold()
      }

      if (unsubscribeSemanticSearchEnabled) {
        unsubscribeSemanticSearchEnabled()
      }
    }
  })
</script>

<svelte:window on:keydown={handleKeyDown} />

<svelte:body
  on:dragenter={handleWindowDragEnter}
  on:dragend={handleWindowDragEnd}
  on:drop={handleWindowDragEnd}
/>

{#if $showMiniBrowser && $selectedResource}
  <MiniBrowser resource={selectedResource} />
{/if}

{#if false}
  <div class="drop-zone">
    {#if $alreadyDropped && $viewState === 'chatInput'}
      <div
        class="already-dropped-wrapper"
        in:fly={{ y: 30, duration: 120 }}
        out:fly={{ y: 30, duration: 320 }}
      >
        <AlreadyDroppedTooltip />
      </div>
    {/if}
    <DrawerChat
      on:chatSend={handleChat}
      on:dropForwarded={handleDropForwarded}
      on:dropFileUpload={handleFileUpload}
      forceOpen={true}
      {droppedInputElements}
    />

    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="drop-zone-close" on:click={handleDropZoneClickOutside}>
      <Icon name="close" size="15px" />
    </div>
  </div>
{/if}

<DrawerProvider {drawer} on:search={handleSearch}>
  <DrawerContentWrapper
    on:drop={handleDrop}
    acceptDrop={$viewState !== 'details' && !$isDraggingDrawerItem}
  >
    {#if $selectedResource}
      {#if $viewState === 'details'}
        <!-- The key block is needed so the details components get properly updated when the selected resource changes -->
        <div
          class="drawer-details-transition"
          in:fly={{ x: 600, duration: 540 }}
          out:fly={{ x: 600, duration: 320 }}
        >
          {#key $selectedResource.id}
            <DrawerDetailsWrapper
              on:dragstart={(e) => handleItemDragStart(e, $selectedResource)}
              resource={$selectedResource}
              {horizon}
            >
              <ResourceOverlay caption="Click to open in new tab">
                <ResourcePreview
                  slot="content"
                  on:click={() => handleResourceDetailClick($selectedResource)}
                  on:remove={handleResourceRemove}
                  on:load={handleResourceLoad}
                  resource={$selectedResource}
                />
              </ResourceOverlay>

              <div class="proximity-view" slot="proximity-view" let:result={nearbyResults}>
                {#if nearbyResults.length > 0}
                  <DrawerDetailsProximity
                    {nearbyResults}
                    on:click={handleNearbyResultClick}
                    on:dragstart={(e) => handleItemDragStart(e.detail.event, e.detail.resource)}
                  />
                {/if}
              </div>
            </DrawerDetailsWrapper>
          {/key}
        </div>
      {/if}
    {/if}
    {#if $viewState !== 'details'}
      <div
        class="drawer-content-transition"
        in:fly={{ x: -600, duration: 540 }}
        out:fly={{ x: -600, duration: 320 }}
      >
        {#if searchResult.length === 0}
          <DrawerContenEmpty />
        {:else}
          <DrawerContentMasonry
            items={searchResult}
            gridGap="2rem"
            colWidth="minmax(Min(330px, 100%), 1fr)"
            bind:refreshLayout={refreshContentLayout}
          >
            {#each searchResult.slice(0, 50) as item (item.id)}
              {#if item.engine === 'local'}
                <div>
                  <ResourceLoading title={item.resource.metadata?.name} />
                </div>
              {:else}
                <DrawerContentItem on:dragstart={(e) => handleItemDragStart(e, item.resource)}>
                  <ResourcePreview
                    on:click={() => {
                      handleResourceClick(item.resource)
                    }}
                    on:remove={handleResourceRemove}
                    on:load={handleResourceLoad}
                    resource={item.resource}
                    isSelected={$selectedResource && $selectedResource.id === item.resource.id}
                  />
                </DrawerContentItem>
              {/if}
            {/each}
          </DrawerContentMasonry>
        {/if}
      </div>
    {/if}
    <!-- {#await $result}
      <p>Loading…</p>
    {:then resources}
      {#if resources.length === 0}
        <DrawerContenEmpty />
      {:else}
        <DrawerContentMasonry
          items={resources}
          idKey="id"
          animate={false}
          maxColWidth={650}
          minColWidth={300}
          gap={15}
          let:item={resource}
        >
          <DrawerContentItem on:dragstart={(e) => handleItemDragStart(e, resource.id)}>
            <ResourcePreview on:click={handleResourceClick} {resource} />
          </DrawerContentItem>
        </DrawerContentMasonry>
      {/if}
    {/await} -->
  </DrawerContentWrapper>

  <div class="drawer-top">
    <div class="drawer-controls">
      <!-- <button on:click={() => drawer.close()}>
        <Icon name="sidebar.right" size="22px" />
      </button> -->
      {#if $viewState === 'details'}
        <button on:click={handleDetailsBack}>
          <Icon name="chevron.left" size="22px" />
        </button>
      {/if}
    </div>
  </div>

  <div class="drawer-bottom">
    <div class="tabs-transition">
      <!-- {#if $viewState !== 'details'}
        <DrawerNavigation {tabs} />
      {/if} -->
    </div>
    <!-- {#if $isSaving}
      <Saving />
    {/if} -->
    {#if $viewState !== 'details'}
      <div class="drawer-chat-search">
        {#if $viewState !== 'chatInput'}
          <DrawerSearch />
        {/if}
        {#if $viewState !== 'search'}
          {#if $alreadyDropped && $viewState === 'chatInput'}
            <div
              class="already-dropped-wrapper"
              in:fly={{ y: 30, duration: 120 }}
              out:fly={{ y: 30, duration: 320 }}
            >
              <AlreadyDroppedTooltip />
            </div>
          {/if}
          <DrawerChat
            on:chatSend={handleChat}
            on:dropForwarded={handleDropForwarded}
            on:dropFileUpload={handleFileUpload}
            forceOpen={false}
            {droppedInputElements}
          />
        {/if}
      </div>

      {#if $viewState == 'search' || $viewState == 'chatInput'}
        <DrawerCancel on:search-abort={abortSearch} />
        {#if $showSearchDebug}
          <div class="search-debug">
            <label>
              Semantic Enabled
              <input bind:checked={$semanticSearchEnabled} type="checkbox" />
            </label>

            <label>
              Semantic Threshold
              <input bind:value={$semanticDistanceThreshold} type="number" step="0.15" />
            </label>

            <label>
              Proximity Threshold
              <input
                bind:value={$proximityDistanceThreshold}
                type="number"
                step="10000"
                style="width: 100px;"
              />
            </label>
          </div>
        {/if}
      {/if}
      <!-- <ProgressiveBlur /> -->
    {/if}
  </div>
</DrawerProvider>

<style lang="scss">
  .drawer-details-transition,
  .drawer-content-transition {
    padding: 4rem 2rem 16rem 2rem;
    position: absolute;
    top: 0;
    width: 100%;
    height: 100%;
    overflow-y: scroll;
    overflow-x: hidden;
  }

  .link-info {
    padding: 10px;
    background: rgba(255, 255, 255, 0.33);
    margin: 10px 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    img {
      border-radius: 4px;
    }

    .title {
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.02rem;
    }

    .subtitle {
      font-size: 0.9rem;
      color: var(--color-text-muted);
    }

    .type {
      font-size: 0.9rem;
      color: var(--color-text-muted);
      margin-left: auto;
    }
  }

  .drawer-top {
    position: absolute;
    top: 0;
    padding: 1rem 1rem 0.5rem 1rem;
    display: flex;
    align-items: center;
    justify-content: start;
    gap: 0.5rem;
    z-index: 1000;
  }

  .drawer-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-right: 0.5rem;

    button {
      appearance: none;
      background: none;
      border: none;
      cursor: cursor;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
      transition: color 0.2s ease;
      border-radius: 9px;

      &:hover {
        color: var(--color-text);
        background: rgba(0, 0, 0, 0.15);
      }
    }
  }

  .drawer-bottom {
    position: relative;
    top: 0;
    left: 0;
    right: 0;
    backdrop-filter: blur(3px);
    z-index: 1000;
    border-top: 0.5px solid rgba(0, 0, 0, 0.15);
    &:after {
      background: linear-gradient(
        to bottom,
        rgba(255, 255, 255, 0.5) 0%,
        rgba(255, 255, 255, 255) 60%
      ) !important;
      filter: opacity(1);
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
    }

    .drawer-chat-search {
      position: relative;
      top: 0;
      display: flex;
      align-items: center;
      width: 100%;
      gap: 16px;
      padding: 1rem 1rem 1rem 1rem;
      transition: all 240ms ease-out;

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

  .drop-zone {
    position: fixed;
    bottom: 0.5rem;
    left: 0.5rem;
    z-index: 1000;
    width: 305px;

    :global(.chat-container) {
      margin-top: 0 !important;
    }

    &:hover {
      .drop-zone-close {
        display: flex;
      }
    }
  }

  .already-dropped-wrapper {
    position: absolute;
    top: 0;
    width: 100%;
  }

  .drop-zone-close {
    position: absolute;
    top: -0.75rem;
    left: -0.5rem;
    z-index: 1000;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    border: 1px solid rgba(0, 0, 0, 0.12);
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0.15rem;
  }

  .proximity-view {
    width: 100%;
  }
</style>
