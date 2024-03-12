<script lang="ts">
  import { derived, writable } from 'svelte/store'
  import { setContext, tick } from 'svelte'
  import { WebParser, type WebMetadata, type DetectedWebApp } from '@horizon/web-parser'

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
    DrawerDetailsWrapper,
    DrawerDetailsProximity,
    type SearchQuery
  } from '@horizon/drawer'

  import type { Resource, ResourceDocument } from '../../service/resources'
  import { Icon } from '@horizon/icons'

  import type { Horizon } from '../../service/horizon'
  import ResourcePreview from '../Resources/ResourcePreview.svelte'
  import { useLogScope } from '../../utils/log'
  import {
    MEDIA_TYPES,
    processDrop,
    type MediaParserResult,
    processFile,
    processText
  } from '../../service/mediaImporter'
  import { onMount } from 'svelte'
  import {
    ResourceTag,
    ResourceManager,
    type ResourceObject,
    ResourceJSON,
    ResourceNote,
    type ResourceSearchResultItem
  } from '../../service/resources'
  import {
    ResourceTypes,
    type ResourceData,
    type SFFSResourceTag,
    type SFFSResourceMetadata,
    type SFFSSearchParameters
  } from '../../types'

  import { parseStringIntoUrl, stringToURLList } from '../../utils/url'

  import ProgressiveBlur from '@horizon/drawer/src/lib/fx/ProgressiveBlur.svelte'
  import { parse } from 'date-fns'
  import Link from '../Atoms/Link.svelte'
  import type { ParsedMetadata } from '../../utils/parseMetadata'
  import { getEditorContentText } from '@horizon/editor'

  export const drawer = provideDrawer()

  export let horizon: Horizon
  export let resourceManager: ResourceManager

  const cards = horizon.cards
  const resourcesInMemory = resourceManager.resources

  const log = useLogScope('DrawerWrapper')

  const tabs = [
    { key: 'all', label: 'All', icon: 'square.rotated' },
    { key: 'horizon', label: 'On this Horizon', icon: 'rectangle' },
    { key: 'dropped', label: 'Dropped', icon: 'bookmark' },
    { key: 'downloaded', label: 'Downloaded', icon: 'download' },
    { key: 'archived', label: 'Archived', icon: 'archive' }
  ]

  const VIEW_STATES = {
    CHAT_INPUT: 'chatInput',
    SEARCH: 'search',
    DEFAULT: 'default',
    DETAILS: 'details'
  }

  const viewState = writable(VIEW_STATES.DEFAULT)

  const selectedResource = writable<ResourceObject | undefined>(undefined)

  // Setting the context
  setContext('drawer.viewState', viewState)

  drawer.selectedTab.set('all')

  const searchQuery = writable<SearchQuery>({ value: '', tab: 'all' })

  const droppedInputElements = writable<MediaParserResult[]>([])

  $: if ($viewState === 'default') {
    $droppedInputElements = []
  }

  let searchResult: ResourceSearchResultItem[] = []
  let detectedInput = false
  let parsedInput: {
    url: string
    linkMetadata: WebMetadata
    appInfo: DetectedWebApp | null
  } | null = null

  const showSearchDebug = writable(false)
  const semanticDistanceThreshold = writable(2.0)
  const proximityDistanceThreshold = writable(100000)
  const semanticSearchEnabled = writable(true)

  const runSearch = async (query: string, tab: string | null) => {
    log.debug('Searching for', query, 'in', tab)

    const tags = [
      ResourceManager.SearchTagDeleted(false) // we have to explicitly search for non-deleted resources
    ] as SFFSResourceTag[]

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

    if (tab === 'dropped') {
      tags.push(
        ResourceManager.SearchTagSavedWithAction('drag', true) // searches both 'drag/browser' and 'drag/local'
      )
    } else if (tab === 'downloaded') {
      tags.push(ResourceManager.SearchTagSavedWithAction('download'))
    } else if (tab === 'archived') {
      tags.push(ResourceManager.SearchTagDeleted())
    } else if (tab === 'horizon') {
      tags.push(ResourceManager.SearchTagHorizon(horizon.id))
    }

    const parsedParameters = {
      semanticEnabled: $semanticSearchEnabled,
      semanticDistanceThreshold: $semanticDistanceThreshold,
      proximityDistanceThreshold: $proximityDistanceThreshold
    } as SFFSSearchParameters

    const result = await resourceManager.searchResources(query, tags, parsedParameters)
    if (query === '') {
      result.reverse()
    }

    log.debug('Search result', result)
    searchResult = result
  }

  const handleSearch = (e: CustomEvent<SearchQuery>) => {
    console.log('search gets handled bastard')
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
    runSearch('', drawer.selectedTab)
  }

  const handleResourceClick = async (e: CustomEvent<string>) => {
    const resourceId = e.detail

    log.debug('Resource clicked', resourceId)
    const resource = await resourceManager.getResource(resourceId)
    if (!resource) {
      log.error('Resource not found', resourceId)
      return
    }

    // Sets selected resource
    document.startViewTransition(async () => {
      $selectedResource = resource
      viewState.set('details')
    })
  }

  const handleResourceRemove = async (e: CustomEvent<string>) => {
    const resourceId = e.detail

    const confirm = window.confirm(`Are you sure you want to delete this resource?`)
    if (confirm) {
      const resource = await resourceManager.deleteResource(resourceId)
    }

    return
  }

  const handleChat = async (payload: any) => {
    log.debug(
      `Creation of ${payload.detail.$parsedURLs.length} items triggered from chat input`,
      payload.detail
    )

    const userGeneratedText = payload.detail.$inputText

    const links = payload.detail.$parsedURLs as ParsedMetadata[]
    const mediaItems = $droppedInputElements

    if (links) {
      for (const link of links) {
        createResourceFromParsedURL(link, userGeneratedText)
      }
    }

    if (mediaItems) {
      createResourcesFromMediaItems(mediaItems, userGeneratedText)
    }

    document.startViewTransition(async () => {
      viewState.set('default')
    })

    if (links.length == 0 && mediaItems.length == 0) {
      const item = await processText(userGeneratedText)
      createResourcesFromMediaItems(item, '')
    }
  }

  const handleDropForwarded = async (e: any) => {
    const event = e.detail
    log.debug('Dropped', event)

    const parsed = await processDrop(event)
    log.debug('Parsed', parsed)

    droppedInputElements.set(parsed)
  }

  const handleFileUpload = async (e: any) => {
    const files = e.detail
    let parsed = []
    for (const file of files) {
      parsed.push(await processFile(file))
    }
    $droppedInputElements = parsed
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
    const metadata = {
      name: item.linkMetadata.title,
      alt: item.linkMetadata.description,
      sourceURI: '',
      userContext: userGeneratedText
    }

    const resource = await extractAndCreateWebResource(item.url, metadata, [ResourceTag.paste()])

    log.debug('Created resource', resource)
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

    if (!e.dataTransfer) {
      log.error('No dataTransfer found')
      return
    }

    // this will be used by the MediaImporter to import the resource and create a card
    e.dataTransfer.setData(MEDIA_TYPES.RESOURCE, resource.id)

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
      log.debug('parsed resource data')

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
    })
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'j') {
      $showSearchDebug = !$showSearchDebug

      viewState.set('search')
    }
  }

  onMount(() => {
    const unsubscribeQuery = searchQuery.subscribe(({ value, tab }) => {
      runSearch(value, tab)
    })

    const unsubscribeCards = cards.subscribe((cards) => {
      log.debug('Cards changed', cards)
      runSearch($searchQuery.value, $searchQuery.tab)
    })

    const unsubscribeResources = resourcesInMemory.subscribe((resources) => {
      log.debug('Resources changed', resources)
      runSearch($searchQuery.value, $searchQuery.tab)
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

<DrawerProvider {drawer} on:search={handleSearch}>
  {#if detectedInput}
    <!-- TODO: move to component, this is more of an example -->
    <div class="link-info">
      {#if parsedInput?.linkMetadata && parsedInput.linkMetadata.title}
        <img src={parsedInput.linkMetadata.image} alt="" width="35px" height="35px" />
        <div class="details">
          <div class="title">{parsedInput.linkMetadata.title}</div>
          <div class="subtitle">{parsedInput.linkMetadata.description}</div>
        </div>
        <div class="type">Link Detected</div>
      {:else}
        <div class="details">
          <div class="title">Link Detected</div>
          <div class="subtitle">{$searchQuery.value}</div>
        </div>
      {/if}
    </div>
  {/if}
  <DrawerContentWrapper on:drop={handleDrop}>
    {#if $selectedResource}
      {#if $viewState === 'details'}
        <DrawerDetailsWrapper
          on:dragstart={(e) => handleItemDragStart(e, $selectedResource)}
          resource={$selectedResource}
          {resourceManager}
        >
          <ResourcePreview
            on:click={handleResourceClick}
            on:remove={handleResourceRemove}
            resource={$selectedResource}
          />

          <div slot="proximity-view" let:result={nearbyResults}>
            <DrawerDetailsProximity {nearbyResults} />
          </div>
        </DrawerDetailsWrapper>
      {/if}
    {/if}
    {#if $viewState !== 'details'}
      {#if searchResult.length === 0}
        <DrawerContenEmpty />
      {:else}
        <DrawerContentMasonry
          items={searchResult}
          idKey="id"
          animate={false}
          maxColWidth={650}
          minColWidth={250}
          gap={15}
          let:item
        >
          <DrawerContentItem on:dragstart={(e) => handleItemDragStart(e, item.resource)}>
            <ResourcePreview
              on:click={handleResourceClick}
              on:remove={handleResourceRemove}
              resource={item.resource}
            />
          </DrawerContentItem>
        </DrawerContentMasonry>
      {/if}
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
      <button on:click={() => drawer.close()}>
        <Icon name="sidebar.right" size="22px" />
      </button>
      {#if $viewState === 'details'}
        <button on:click={handleDetailsBack}>
          <Icon name="chevron.left" size="22px" />
        </button>
      {/if}
    </div>
  </div>

  <div class="drawer-bottom">
    <div class="tabs-transition">
      <DrawerNavigation {tabs} />
    </div>
    {#if $viewState !== 'details'}
      <div class="drawer-chat-search">
        {#if $viewState !== 'chatInput'}
          <DrawerSearch />
        {/if}
        {#if $viewState !== 'search'}
          <DrawerChat
            on:chatSend={handleChat}
            on:dropForwarded={handleDropForwarded}
            on:dropFileUpload={handleFileUpload}
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
      border-radius: 3px;

      &:hover {
        color: var(--color-text);
        background: rgba(0, 0, 0, 0.15);
      }
    }
  }

  .drawer-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    backdrop-filter: blur(3px);
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
      display: flex;
      align-items: center;
      width: 100%;
      gap: 16px;
      padding: 1rem;
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
</style>
