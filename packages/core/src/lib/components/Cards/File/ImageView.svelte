<script lang="ts">
  import { onDestroy } from 'svelte'

  export let blob: Blob

  const url = URL.createObjectURL(blob)

  onDestroy(() => {
    URL.revokeObjectURL(url)
  })
</script>

<div class="wrapper">
  <img src={url} alt="" />
</div>

<style>
  .wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    user-select: none;
  }
</style>
