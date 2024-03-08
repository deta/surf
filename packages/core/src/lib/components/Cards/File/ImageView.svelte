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
    padding: 12px;
    pointer-events: none;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    user-select: none;
    border-radius: 2px;
    box-shadow: 0px 0px 1px 0px rgba(255, 255, 255, 0.09) inset;
  }
</style>
