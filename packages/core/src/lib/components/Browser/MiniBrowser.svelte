<script lang="ts">
  import BrowserTab from '@horizon/core/src/lib/components/Browser/BrowserTab.svelte'
  import type { HistoryEntriesManager } from '@horizon/core/src/lib/service/history'
  import WebviewWrapper from '../Cards/Browser/WebviewWrapper.svelte'
  import { writable } from 'svelte/store'
  import { type ResourceObject } from '../../service/resources'
  import type { Writable } from 'svelte/store'

  export let resource: Writable<ResourceObject | undefined>

  let webview: WebviewWrapper
  const initialUrl = writable('https://example.com')

  $: historyEntriesManager = {
    getEntry: (id) => ({ id, url: $resource?.metadata?.sourceURI || 'https://example.com' })
  }

  $: tab = {
    initialLocation: $resource?.metadata?.sourceURI || 'https://example.com',
    historyStackIds: [],
    currentHistoryIndex: 0,
    icon: '',
    title: ''
  }
</script>

<div class="mini-browser-wrapper">
  <div id="mini-browser" class="mini-browser">
    <div class="resource-details">
      <slot />
    </div>
    <BrowserTab {tab} {historyEntriesManager} bind:webview />
    <div class="resource-details">
      <!-- placeholder for notes later -->
    </div>
  </div>
</div>

<style lang="scss">
  .mini-browser {
    position: absolute;
    display: flex;
    gap: 2rem;
    width: 80vw;
    height: 95vh;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 100000;
  }

  .resource-details {
    position: relative;
    width: 40rem;
    border-radius: 12px;
    background: white;
  }

  .mini-browser-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    z-index: 10000000;
    border-radius: 12px;
  }
</style>
