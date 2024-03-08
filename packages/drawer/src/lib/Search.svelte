<script lang="ts">
  import { getContext } from 'svelte'

  import { Icon } from '@horizon/icons'

  import SearchInput from './components/SearchInput.svelte'

  const viewState: any = getContext('drawer.viewState')
</script>

<div class="search-input-wrapper" class:active={$viewState == 'search'}>
  <SearchInput />
</div>

<style lang="scss">
  .search-input-wrapper {
    position: relative;
    z-index: 10;
    width: 4rem;
    height: 3.3rem;
    view-transition-name: search-transition;
    &.active {
      height: auto;
      width: 100%;
    }
  }
</style>
