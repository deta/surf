<script lang="ts">
  import { onMount } from 'svelte'
  import type { Writable } from 'svelte/store'

  import type { CardLink } from '../../../types'
  import { useLogScope } from '../../../utils/log'

  export let card: Writable<CardLink>

  const log = useLogScope('LinkCard')

  let title = ''
  let subtitle = ''

  onMount(() => {
    try {
      const url = new URL($card.data.url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title = hostname[0].toUpperCase() + hostname.slice(1)
      subtitle = `${url.hostname}${url.pathname}`
    } catch (e) {
      log.error(e)
    }
  })
</script>

<a href={$card.data.url} target="_blank" class="link-card">
  <div class="details">
    <div class="title">{title}</div>
    <div class="subtitle">{subtitle}</div>
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
    flex-direction: column;
    justify-content: center;
    gap: 0.5rem;
    flex-grow: 1;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 500;
  }

  .subtitle {
    font-size: 1rem;
    font-weight: 300;
  }
</style>
