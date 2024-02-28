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
  import type { ResourceManager } from '../../service/resources'
  import { onMount } from 'svelte'
  import type { SFFSResourceTag } from '../../types'

  export const drawer = provideDrawer()

  export let horizon: Horizon
  export let resourceManager: ResourceManager

  const log = useLogScope('DrawerWrapper')

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'link', label: 'Links' },
    { key: 'text', label: 'Notes' },
    { key: 'file', label: 'Files' }
  ]

  drawer.selectedTab.set('all')

  const searchQuery = writable<SearchQuery>({ value: '', tab: 'all' })

  const result = derived([searchQuery], ([searchQuery]) => {
    // TODO: use the right tags
    const tags = [{ name: 'tab', value: searchQuery.tab }] as SFFSResourceTag[]

    const result = resourceManager.searchResources(searchQuery.value, tags)

    return result
  })

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

    parsed.map((item) => {
      log.debug('processed item', item)

      if (item.type === 'text') {
        resourceManager.createResourceNote(item.data)
      } else if (item.type === 'url') {
        resourceManager.createResourceBookmark({ url: item.data.href })
      } else if (item.type === 'file') {
        resourceManager.createResourceOther(item.data)
      }
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

  onMount(async () => {
    const resources = await resourceManager.readResources()
    log.debug('Resources', resources)
  })
</script>

<DrawerProvider {drawer} on:search={handleSearch}>
  <DrawerNavigation {tabs} />
  <DrawerSearch />
  <DrawerContentWrapper on:drop={handleDrop}>
    {#await $result}
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
    {/await}
  </DrawerContentWrapper>
</DrawerProvider>

<style lang="scss">
</style>
