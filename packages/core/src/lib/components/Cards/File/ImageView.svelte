<script lang="ts">
  import { getContext, onDestroy } from 'svelte'

  export let blob: Blob

  const inOasis = getContext('horizon') === undefined

  const url = URL.createObjectURL(blob)

  onDestroy(() => {
    URL.revokeObjectURL(url)
  })
</script>

<div class="wrapper" class:inOasis>
  <img src={url} alt="" />
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
    pointer-events: none;

    &.inOasis {
      padding: 12px;
    }
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    user-select: none;
    border-radius: 3px;
  }
</style>
