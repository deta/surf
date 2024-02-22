<script lang="ts">
  import { derived, get, writable } from 'svelte/store'

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
  import type {
    CardBrowser,
    CardFile,
    CardLink,
    CardText,
    MockResource,
    SFFSResource
  } from '../../types/index'
  import ResourcePreview from '../Resources/ResourcePreview.svelte'
  import { useLogScope } from '../../utils/log'

  export const drawer = provideDrawer()
  export let horizon: Horizon

  const log = useLogScope('DrawerWrapper')

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'link', label: 'Links' },
    { key: 'text', label: 'Notes' },
    { key: 'file', label: 'Files' }
  ]

  drawer.selectedTab.set('all')

  const cards = horizon.cards

  const searchQuery = writable<SearchQuery>({ value: '', tab: 'all' })

  const result = derived([cards, searchQuery], ([cards, searchQuery]) => {
    const filterd = cards
      .map(get)
      .map((card) => {
        if (card.type === 'browser') {
          const data = (card as CardBrowser).data
          const url = data.historyStackIds[data.currentHistoryIndex] ?? data.initialLocation
          return {
            id: card.id,
            cards: [
              {
                ...card,
                type: 'link',
                data: {
                  url
                }
              }
            ],
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
            type: 'link',
            data: url
          } as MockResource
        } else if (card.type === 'link') {
          const data = (card as CardLink).data
          const url = data.url
          return {
            id: card.id,
            cards: [card],
            type: 'link',
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
            data: url
          } as MockResource
        } else if (card.type === 'text') {
          const data = (card as CardText).data
          return {
            id: card.id,
            cards: [card],
            type: 'text',
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
            data: data.content
          } as MockResource
        } else if (card.type === 'file') {
          const data = (card as CardFile).data
          return {
            id: card.id,
            cards: [card],
            type: 'file',
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
            data: {
              name: data.name,
              mimetype: data.mimetype,
              resourceId: data.resourceId
            }
          } as MockResource
        } else {
          return {
            id: card.id,
            cards: [card],
            type: 'unknown',
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
            data: null
          } as MockResource
        }
      })
      .filter((resource) => !(resource.type === 'link' && !resource.data))
      .filter((resource) => searchQuery.tab === 'all' || resource.type === searchQuery.tab)
      .filter((resource) => {
        if (searchQuery.value === '') return true

        log.debug('Checking resource', resource.id, resource.type, resource.data)
        if (resource.type === 'text') {
          const data = resource.data as any
          const text = JSON.stringify(data.content)
          return text ? text.toLowerCase().includes(searchQuery.value.toLowerCase()) : false
        } else if (resource.type === 'link') {
          const url = resource.data as any
          return url ? url.includes(searchQuery.value.toLowerCase()) : false
        } else if (resource.type === 'file') {
          const data = resource.data as any
          if (data.name) {
            return data.name.toLowerCase().includes(searchQuery.value.toLowerCase())
          } else {
            return data.mimetype.toLowerCase().includes(searchQuery.value.toLowerCase())
          }
        } else {
          return true
        }
      })

    log.debug('Filtered:', filterd)

    return filterd
  })

  const handleSearch = (e: CustomEvent<SearchQuery>) => {
    const query = e.detail
    log.debug('Searching for', query.value, 'in', query.tab)

    searchQuery.set(query)
  }

  const handleResourceClick = (e: CustomEvent<MockResource>) => {
    const resource = e.detail

    log.debug('Resource clicked', resource)

    const card = resource.cards[0]
    if (card) {
      horizon.scrollToCard(card.id)
    }
  }
</script>

<DrawerProvider {drawer} on:search={handleSearch}>
  <DrawerNavigation {tabs} />
  <DrawerSearch />
  <DrawerContentWrapper>
    {#if $result.length === 0}
      <DrawerContenEmpty />
    {:else}
      <DrawerContentMasonry
        items={$result}
        idKey="id"
        animate={false}
        maxColWidth={520}
        let:item={resource}
      >
        <DrawerContentItem>
          <ResourcePreview on:click={handleResourceClick} {resource} {horizon} />
        </DrawerContentItem>
      </DrawerContentMasonry>
    {/if}
  </DrawerContentWrapper>
</DrawerProvider>

<style lang="scss">
</style>
