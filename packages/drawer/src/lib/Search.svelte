<script lang="ts">
  import SearchInput from './components/SearchInput.svelte'
  import { useDrawer } from './drawer'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()
  const { viewState } = useDrawer()

  const forwardRequest = (e: CustomEvent) => {
    dispatch('aichat', e.detail)
  }
</script>

<div class="search-input-wrapper">
  <SearchInput on:airequest={forwardRequest} />
</div>

<style lang="scss">
  .search-input-wrapper {
    position: relative;
    z-index: 10;
    width: 100%;
    height: 3.3rem;
    max-width: 32rem;
    view-transition-name: search-transition;
    &.active {
      height: auto;
      width: 100%;
    }
  }
</style>
