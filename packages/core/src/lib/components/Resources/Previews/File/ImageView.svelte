<script lang="ts">
  import { onDestroy } from 'svelte'

  export let blob: Blob
  export let border = true
  export let fit: 'contain' | 'cover' = 'cover'

  const url = URL.createObjectURL(blob)

  onDestroy(() => {
    URL.revokeObjectURL(url)
  })
</script>

<div class="wrapper" class:border>
  <img src={url} alt="" style="object-fit: {fit}" on:load />
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

    &.border {
      padding: 0.5rem;
    }
  }

  img {
    width: 100%;
    height: 100%;
    user-select: none;
    border-radius: 9px;
  }
</style>
