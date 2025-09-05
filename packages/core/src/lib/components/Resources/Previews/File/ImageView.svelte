<script lang="ts">
  export let resourceId: string
  export let border = false
  export let fit: 'contain' | 'cover' = 'cover'

  $: src = `surf://resource/${resourceId}?raw`
</script>

<div class="wrapper" class:border>
  <img {src} alt="" style="object-fit: {fit}" on:load />
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
