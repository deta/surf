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
  import { processDrop } from '../../service/mediaImporter'

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
          let currentEntry = horizon.historyEntriesManager.getEntry(
            data.historyStackIds[data.currentHistoryIndex]
          )
          const url = currentEntry?.url ?? data.initialLocation
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
            data: data.content || ''
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
          return url ? url.toLowerCase().includes(searchQuery.value.toLowerCase()) : false
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

  const handleDrop = async (e: CustomEvent<DragEvent>) => {
    const event = e.detail

    log.debug('Dropped', event)

    const parsed = await processDrop(event)

    log.debug('Parsed', parsed)

    const board = horizon.board
    if (!board) {
      log.error('No board found')
      return
    }

    const SAFE_AREA_PADDING = 64
    const state = get(board.state)
    const viewport = get(state.viewPort)
    const viewoffset = get(state.viewOffset)
    const width = 300
    const height = 300

    const basePosition = {
      x: viewoffset.x + viewport.w / 2 - width / 2,
      y: viewoffset.y + viewport.h / 2 - height / 2 - 25,
      width: width,
      height: height
    }

    parsed.map((item, idx) => {
      log.debug('processed item', item)

      if (item.type === 'text') {
        horizon.addCardText(item.data, basePosition)
      } else if (item.type === 'url') {
        horizon.addCardLink(item.data.href, basePosition)
      } else if (item.type === 'file') {
        if (item.data.type.startsWith('image')) {
          horizon.addCardFile(item.data, basePosition)
        } else {
          log.warn('unhandled file type', item.data.type)
        }
      }
    })
  }

  const handleItemDragStart = async (e: DragEvent, resource: MockResource) => {
    log.debug('Item drag start', e, resource)

    if (!e.dataTransfer) {
      log.error('No dataTransfer found')
      return
    }

    if (resource.type === 'text') {
      e.dataTransfer.setData('text/tiptap', JSON.stringify(resource.data))
    } else if (resource.type === 'link') {
      e.dataTransfer.setData('text/plain', resource.data ?? '')
    } else if (resource.type === 'file') {
      const fileData = resource.data as CardFile['data']
      const resourceId = fileData.resourceId

      e.dataTransfer.setData('space/resource', resourceId)
    } else {
      log.warn('Unhandled resource type', resource.type)
    }
  }
</script>

<DrawerProvider {drawer} on:search={handleSearch}>
  <DrawerNavigation {tabs} />
  <DrawerSearch />
  <DrawerContentWrapper on:drop={handleDrop}>
    {#if $result.length === 0}
      <DrawerContenEmpty />
    {:else}
      <DrawerContentMasonry
        items={$result}
        idKey="id"
        animate={false}
        maxColWidth={650}
        minColWidth={300}
        gap={15}
        let:item={resource}
      >
        <DrawerContentItem on:dragstart={(e) => handleItemDragStart(e, resource)}>
          <ResourcePreview on:click={handleResourceClick} {resource} {horizon} />
        </DrawerContentItem>
      </DrawerContentMasonry>
    {/if}
  </DrawerContentWrapper>
</DrawerProvider>

<style lang="scss">
</style>
