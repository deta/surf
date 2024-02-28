<script lang="ts">
  import { derived, writable } from 'svelte/store'

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
  import type {
    Resource,
    ResourceBookmark,
    ResourceManager,
    ResourceNote
  } from '../../service/resources'
  import { onMount } from 'svelte'
  import type { SFFSResourceTag } from '../../types'

  export const drawer = provideDrawer()

  export let horizon: Horizon
  export let resourceManager: ResourceManager

  const cards = horizon.cards

  const log = useLogScope('DrawerWrapper')

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'link', label: 'Links' },
    { key: 'text', label: 'Notes' },
    { key: 'file', label: 'Files' }
  ]

  drawer.selectedTab.set('all')

  const searchQuery = writable<SearchQuery>({ value: '', tab: 'all' })

  let resources: (Resource | ResourceBookmark | ResourceNote)[] = []

  const runSearch = async (query: string, tab: string | null) => {
    log.debug('Searching for', query, 'in', tab)

    const tags = [] as SFFSResourceTag[]

    const result = await resourceManager.searchResources(query, tags)

    log.debug('Search result', result)
    resources = result
  }

  const handleSearch = (e: CustomEvent<SearchQuery>) => {
    const query = e.detail
    log.debug('Searching for', query.value, 'in', query.tab)

    searchQuery.set(query)
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

    parsed.map(async (item) => {
      log.debug('processed item', item)

      let resource
      if (item.type === 'text') {
        resource = await resourceManager.createResourceNote(item.data)
      } else if (item.type === 'url') {
        resource = await resourceManager.createResourceBookmark({ url: item.data.href })
      } else if (item.type === 'file') {
        resource = await resourceManager.createResourceOther(item.data)
      }

      log.debug('Created resource', resource)
    })
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

    return () => {
      if (unsubscribeQuery) {
        unsubscribeQuery()
      }

      if (unsubscribeCards) {
        unsubscribeCards()
      }
    }
  })
</script>

<DrawerProvider {drawer} on:search={handleSearch}>
  <DrawerNavigation {tabs} />
  <DrawerSearch />
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
</style>
