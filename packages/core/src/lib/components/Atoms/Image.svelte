<script lang="ts">
  import { Icon, type Icons } from '@horizon/icons'

  export let src: string
  export let alt: string
  export let error = false
  export let fallbackIcon: Icons = 'file'

  const handleError = (_e: Event) => {
    error = true
  }
</script>

{#if !error}
  <img {src} {alt} {...$$restProps} on:error={handleError} />
{:else}
  <div class="image-error">
    <Icon name={fallbackIcon} size="100%" />
  </div>
{/if}

<style>
  img {
    width: 100%;
    height: 100%;
  }
</style>
