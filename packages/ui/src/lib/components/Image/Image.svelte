<script lang="ts">
  import { Icon, type Icons } from '@deta/icons'

  export let src: string
  export let alt: string
  export let error = false
  export let fallbackIcon: Icons = 'file'
  export let emptyOnError = false
  export let decoding: 'auto' | 'async' | 'sync' = 'auto'
  export let loading: 'eager' | 'lazy' = 'eager'

  const handleError = (_e: Event) => {
    error = true
  }
</script>

{#if !error}
  <img {src} {alt} {...$$restProps} on:error={handleError} draggable="false" {loading} {decoding} />
{:else if !emptyOnError}
  <div class="image-error">
    <Icon name={fallbackIcon} size="100%" fill="var(--contrast-color)" />
  </div>
{/if}

<style>
  img {
    width: 100%;
    height: 100%;
    display: block;
    user-select: none;
    border-radius: 2px;
    border: 1px solid oklch(93.1% 0 0);
  }
</style>
