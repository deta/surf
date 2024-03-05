<script lang="ts">
  import { derived, writable } from 'svelte/store'
  import { WebParser, type WebMetadata, type DetectedWebApp } from '@horizon/web-parser'

  import {
    DrawerProvider,
    DrawerSearch,
    DrawerNavigation,
    DrawerContentWrapper,
    provideDrawer,
    DrawerContentItem,
    DrawerContentMasonry,
    DrawerContenEmpty,
    type SearchQuery
  } from '@horizon/drawer'

  import type { Horizon } from '../../service/horizon'
  import ResourcePreview from '../Resources/ResourcePreview.svelte'
  import { useLogScope } from '../../utils/log'
  import { MEDIA_TYPES, processDrop } from '../../service/mediaImporter'
  import { ResourceTag, type ResourceManager, type ResourceObject } from '../../service/resources'
  import { onMount } from 'svelte'
  import { ResourceTypes, type SFFSResourceTag } from '../../types'
  import { parseStringIntoUrl } from '../../utils/url'

  export const drawer = provideDrawer()

  export let horizon: Horizon
  export let resourceManager: ResourceManager

  const cards = horizon.cards
  const resourcesInMemory = resourceManager.resources

  const log = useLogScope('DrawerWrapper')

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'link', label: 'Links' },
    { key: 'text', label: 'Notes' },
    { key: 'file', label: 'Files' }
  ]

  drawer.selectedTab.set('all')

  const searchQuery = writable<SearchQuery>({ value: '', tab: 'all' })

  let resources: ResourceObject[] = []
  let detectedInput = false
  let parsedInput: {
    url: string
    linkMetadata: WebMetadata
    appInfo: DetectedWebApp | null
  } | null = null

  const runSearch = async (query: string, tab: string | null) => {
    log.debug('Searching for', query, 'in', tab)

    const tags = [
      {
        name: 'deleted',
        value: 'false'
      }
    ] as SFFSResourceTag[]

    if (tab === 'link') {
      tags.push({
        name: 'type',
        value: ResourceTypes.LINK
      })
    }

    const result = await resourceManager.searchResources(query, tags)

    log.debug('Search result', result)
    resources = result
  }

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

  const parseMetadata = async (url: string) => {
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

  const handleEnter = async () => {
    if (!detectedInput || !parsedInput) {
      return
    }

    const webParser = new WebParser(parsedInput.url)

    if (!parsedInput.appInfo || !parsedInput.appInfo.resourceType) {
      log.error('No appInfo found')
      return
    }

    // Extract a resource from the web page using a webview, this should happen only when saving the resource
    const rawResourceData = await webParser.extractResourceUsingWebview(document)
    log.debug('ResourceData', rawResourceData)

    const resource = await resourceManager.createResourceOther(
      new Blob([JSON.stringify(rawResourceData)], { type: parsedInput.appInfo.resourceType }),
      {
        name: parsedInput.linkMetadata.title,
        alt: parsedInput.linkMetadata.description,
        sourceURI: ''
      }
    )

    log.debug('Created resource', resource)

    drawer.searchValue.set('')
    searchQuery.set({ value: '', tab: 'all' })
  }

  const handleResourceClick = async (e: CustomEvent<string>) => {
    const resourceId = e.detail

    log.debug('Resource clicked', resourceId)
    const resource = await resourceManager.getResource(resourceId)
    if (!resource) {
      log.error('Resource not found', resourceId)
      return
    }

    // TODO: Decide what to do on resource click, e.g. create card or open resource in modal or something else
  }

  const handleDrop = async (e: CustomEvent<DragEvent>) => {
    const event = e.detail
    log.debug('Dropped', event)

    const parsed = await processDrop(event)
    log.debug('Parsed', parsed)

    await Promise.all(
      parsed.map(async (item) => {
        log.debug('processed item', item)

        let resource
        if (item.type === 'text') {
          resource = await resourceManager.createResourceNote(item.data, item.metadata, [
            ResourceTag.dragLocal()
          ])
        } else if (item.type === 'url') {
          resource = await resourceManager.createResourceLink(
            { url: item.data.href },
            item.metadata,
            [ResourceTag.dragLocal()]
          )
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

  const handleItemDragStart = async (e: DragEvent, resourceId: string) => {
    log.debug('Item drag start', e, resourceId)

    if (!e.dataTransfer) {
      log.error('No dataTransfer found')
      return
    }

    // this will be used by the MediaImporter to import the resource and create a card
    e.dataTransfer.setData(MEDIA_TYPES.RESOURCE, resourceId)
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
    }
  })
</script>

<DrawerProvider {drawer} on:search={handleSearch}>
  <DrawerNavigation {tabs} />
  <DrawerSearch on:enter={handleEnter} />
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
</style>
