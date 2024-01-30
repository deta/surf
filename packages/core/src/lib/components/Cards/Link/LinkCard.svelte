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

      const hostname = url.hostname.split('.')[0]
      title = hostname[0].toUpperCase() + hostname.slice(1)
      subtitle = `${url.hostname}${url.pathname}`
    } catch (e) {
      log.error(e)
    }
  })
</script>

<a href={$card.data.url} class="link-card">
  <div class="details">
    <div class="title">{title}</div>
    <div class="subtitle">{subtitle}</div>
  </div>

  <div class="actions">
    <button>↗</button>
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

  .actions {
    flex-shrink: 0;
    width: min-content;

    button {
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      border: none;
      outline: none;
      background: transparent;
      color: inherit;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
    }
  }
</style>
