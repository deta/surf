<script lang="ts">
  import { onMount } from 'svelte'
  import type { Writable } from 'svelte/store'

  import type { CardLink } from '../../../types/index'
  import { useLogScope } from '../../../utils/log'

  export let card: Writable<CardLink>

  const log = useLogScope('LinkCard')

  let title = ''
  let subtitle = ''
  let error = ''

  onMount(() => {
    try {
      const url = new URL($card.data.url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title = hostname[0].toUpperCase() + hostname.slice(1)
      subtitle = `${url.hostname}${url.pathname}`
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    }
  })
</script>

<a href={$card.data.url} target="_blank" class="link-card">
  <div class="details">
    {#if error}
      <div class="title">{error}</div>
      <div class="subtitle">{$card.data.url}</div>
    {:else}
      <div class="title">{title}</div>
      <div class="subtitle">{subtitle}</div>
    {/if}
  </div>
</a>

<style lang="scss">
  .link-card {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    color: inherit;
    text-decoration: none;
    user-select: none;
    -webkit-user-drag: none;
  }

  .details {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-grow: 1;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 500;
    flex-shrink: 0;
    flex-grow: 1;
  }

  .subtitle {
    font-size: 1rem;
    font-weight: 300;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
