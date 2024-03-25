<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { useDrawer } from '../drawer'

  const { viewState } = useDrawer()
  const dispatch = createEventDispatcher<{ 'search-abort': void }>()

  const cancel = () => {
    document.startViewTransition(async () => {
      viewState.set('default')
    })

    if ($viewState === 'search') {
      dispatch('search-abort')
    }
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
<div class="cancel" on:click={cancel}>Cancel</div>

<style lang="scss">
  .cancel {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    z-index: 10;
    padding: 0.5rem 0 1.5rem 0;
    color: #848484;
    cursor: default;
    user-select: none;
  }
</style>
