<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  import { Icon } from '@horizon/icons'

  import { useDebounce } from './utils/debounce'
  import { useDrawer } from './drawer'

  const drawer = useDrawer()
  const { searchValue } = drawer

  const dispatch = createEventDispatcher<{ enter: void }>()

  const search = () => {
    console.log('searchValue changed, triggering search')
    drawer.search({ value: $searchValue })
  }

  const debouncedSearch = useDebounce(search, 300)

  const handleKeyDown = (event: KeyboardEvent) => {
    // check if key is searchable (alphanumeric, backspace, delete, etc.)
    if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
      debouncedSearch()
    } else if (event.key === 'Enter') {
      dispatch('enter')
    }
  }
</script>

<div class="drawer-search">
  <div class="icon">
    <Icon name="search" size="25px" />
  </div>

  <input
    bind:value={$searchValue}
    on:keydown={handleKeyDown}
    type="text"
    placeholder="Search for Cards, Apps and Websites…"
  />

  <div class="icon">
    <Icon name="info" size="25px" />
  </div>
</div>

<style lang="scss">
  .drawer-search {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;

    input {
      flex: 1;
      appearance: none;
      background: none;
      border: none;
      outline: none;
      color: var(--color-text);
      font-size: 1rem;

      &::placeholder {
        color: var(--color-text-muted);
      }
    }

    .icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
    }
  }
</style>
