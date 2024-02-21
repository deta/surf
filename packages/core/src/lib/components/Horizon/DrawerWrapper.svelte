<script lang="ts">
  import {
    DrawerProvider,
    DrawerSearch,
    DrawerNavigation,
    DrawerContent,
    type SearchQuery,
    provideDrawer,
    DrawerContentItem
  } from '@horizon/drawer'
  import type { Horizon } from '../../service/horizon'
  import { get, writable } from 'svelte/store'
  import type { CardBrowser, CardFile, CardText } from '../../types'
  import CardContent from '../Cards/CardContent.svelte'

  export const drawer = provideDrawer()
  export let horizon: Horizon

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'browser', label: 'Links' },
    { key: 'text', label: 'Notes' },
    { key: 'file', label: 'Files' }
  ]

  drawer.selectedTab.set('all')

  const cards = horizon.cards

  const result = writable($cards)

  const handleSearch = (e: CustomEvent<SearchQuery>) => {
    const query = e.detail
    console.log('Searching for', query.value, 'in', query.tab)

    const filtered = $cards
      .filter((c) => query.tab === 'all' || get(c).type === query.tab)
      .filter((c) => {
        const card = get(c)
        console.log('Checking card', card.id, card.type, card.data)
        if (card.type === 'text') {
          const data = (card as CardText).data
          const text = JSON.stringify(data.content)
          console.log('Checking text', text, 'for', query.value)
          const match = text.toLowerCase().includes(query.value.toLowerCase())
          console.log('Match:', match)
          return match
        } else if (card.type === 'browser') {
          const data = (card as CardBrowser).data
          const url = data.historyStack[data.currentHistoryIndex] ?? data.initialLocation
          return url.includes(query.value.toLowerCase())
        } else if (card.type === 'file') {
          const data = (card as CardFile).data
          if (data.name) {
            return data.name.toLowerCase().includes(query.value.toLowerCase())
          } else {
            return data.mimetype.toLowerCase().includes(query.value.toLowerCase())
          }
        } else {
          return true
        }
      })

    console.log('Filtered:', filtered.map(get))

    result.set(filtered)
  }
</script>

<DrawerProvider {drawer} on:search={handleSearch}>
  <DrawerNavigation {tabs} />
  <DrawerSearch />
  <DrawerContent>
    {#if $result.length === 0}
      <div>No results found</div>
    {:else}
      {#each $result as card (get(card).id)}
        <DrawerContentItem>
          <CardContent positionable={card} {horizon} />
        </DrawerContentItem>
      {/each}
    {/if}
  </DrawerContent>
</DrawerProvider>

<style>
</style>
