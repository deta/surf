<script lang="ts">
  import { Icon } from '@deta/icons'
  import { MaskedScroll, SearchInput } from '@deta/ui'
  import type { Snippet } from 'svelte'

  import type { SearchableItem } from './searchable.types'

  type SearchableListProps<T extends SearchableItem> = {
    value?: string
    items: T[]
    searchPlaceholder?: string
    itemRenderer: Snippet<[T]>
    emptyState?: Snippet
    autofocus?: boolean
  }

  let {
    value = $bindable(''),
    items,
    itemRenderer,
    emptyState,
    searchPlaceholder = 'Search...',
    autofocus = false
  }: SearchableListProps<any> = $props()

  let input: SearchInput

  export const focus = () => {
    input?.focus()
  }

  const filterFunction = (item: SearchableItem, searchValue: string) => {
    return (
      item.label.toLowerCase().includes(searchValue.toLowerCase()) ||
      item.id.toLowerCase().includes(searchValue.toLowerCase())
    )
  }

  let filteredItems = $derived(
    value ? items.filter((item) => filterFunction(item, value)) : items
  )
</script>

<div class="searchable-list">
  <div class="search-container">
    <SearchInput bind:this={input} collapsed={false} bind:value={value} {autofocus} placeholder={searchPlaceholder} fullWidth animated={false}/>
  </div>

  <div class="list-container">
    <MaskedScroll grow>
      {#if filteredItems.length > 0}
        {#each filteredItems as item (item.id)}
          {@render itemRenderer(item)}
        {/each}
      {:else if value}
        <div class="empty-state">
          {#if emptyState}
            {@render emptyState()}
          {:else}
            <div class="default-empty">
              <Icon name="search" size="1.5rem" />
              <div>No results found for "{value}"</div>
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
    overflow: hidden;
    flex: 1;
  }

  .search-container {
    padding: 0.5rem 0.4rem 0.625rem 0.4rem;
    flex-shrink: 0;
  }

  .list-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    padding: 2rem 1rem;
    text-align: center;
    color: light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.5));

    .default-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
    }
  }
</style>
