<script lang="ts">
  import { Icon } from '@deta/icons'
  import SearchInput from '../NavigationBar/SearchInput.svelte'
  import { MaskedScroll } from '@deta/ui'
  import type { Snippet } from 'svelte'

  type SearchableItem = {
    id: string
    [key: string]: any
  }

  type SearchableListProps<T extends SearchableItem> = {
    items: T[]
    searchPlaceholder?: string
    filterFunction?: (item: T, searchValue: string) => boolean
    itemRenderer: Snippet<[T]>
    emptyState?: Snippet
    autofocus?: boolean
  }

  let {
    items,
    filterFunction = (item, searchValue) =>
      JSON.stringify(item).toLowerCase().includes(searchValue.toLowerCase()),
    itemRenderer,
    emptyState,
    autofocus = false
  }: SearchableListProps<any> = $props()

  let searchValue = $state('')

  let filteredItems = $derived(
    searchValue ? items.filter((item) => filterFunction(item, searchValue)) : items
  )

  function handleSearchInput(value: string) {
    searchValue = value
  }
</script>

<div class="searchable-list">
  <div class="search-container">
    <SearchInput collapsed={false} onsearchinput={handleSearchInput} {autofocus} fullWidth />
  </div>

  <div class="list-container">
    <MaskedScroll>
      {#if filteredItems.length > 0}
        {#each filteredItems as item (item.id)}
          {@render itemRenderer(item)}
        {/each}
      {:else if searchValue}
        <div class="empty-state">
          {#if emptyState}
            {@render emptyState()}
          {:else}
            <div class="default-empty">
              <Icon name="search" size="1.5rem" />
              <div>No results found for "{searchValue}"</div>
            </div>
          {/if}
        </div>
      {/if}
    </MaskedScroll>
  </div>
</div>

<style lang="scss">
  .searchable-list {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .search-container {
    padding: 0.5rem 0.4rem 0.625rem 0.4rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
  }

  .list-container {
    flex: 1;
    overflow: hidden;
  }

  .empty-state {
    padding: 2rem 1rem;
    text-align: center;
    color: rgba(0, 0, 0, 0.5);

    .default-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
    }
  }
</style>
