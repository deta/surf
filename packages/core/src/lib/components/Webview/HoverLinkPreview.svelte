<script lang="ts">
  import { fly } from 'svelte/transition'
  import { truncateURL } from '@deta/utils'

  export let show: boolean
  export let url: string

  let timeout: ReturnType<typeof setTimeout>
  let actualShow = false
  let cachedUrl = ''

  $: shortenedUrl = truncateURL(url || cachedUrl)

  const showAfterDelay = () => {
    cachedUrl = url

    if (timeout) clearTimeout(timeout)

    timeout = setTimeout(() => {
      actualShow = true
    }, 700)
  }

  const hideAfterDelay = () => {
    if (timeout) clearTimeout(timeout)

    if (actualShow) {
      timeout = setTimeout(() => {
        actualShow = false
        cachedUrl = ''
      }, 300)
    }
  }

  $: if (show) {
    showAfterDelay()
  } else {
    hideAfterDelay()
  }
</script>

{#if actualShow}
  <main in:fly={{ y: 20, duration: 50 }} out:fly={{ y: 20, duration: 200 }} class="link-preview">
    <div class="url">
      {shortenedUrl}
    </div>
  </main>
{/if}

<style>
  .link-preview {
    position: absolute;
    z-index: 1000;
    bottom: 1rem;
    left: 1rem;
    padding: 0.5rem 1rem;
    background-color: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(16px);
    border-radius: calc(8px + 0.25rem);
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.1);
  }

  .url {
    font-size: 0.9rem;
    color: #151515;
  }
</style>
