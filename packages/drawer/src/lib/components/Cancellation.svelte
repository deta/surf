<script lang="ts">
  import { getContext, createEventDispatcher } from 'svelte'

  const viewState: any = getContext('drawer.viewState')
  const dispatch = createEventDispatcher<CardEvents>()

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
