<script lang="ts">
  import { useLogScope } from '@horizon/utils'
  import {
    MINI_BROWSER_CONTEXT_KEY,
    MINI_BROWSER_SERVICE_CONTEXT_KEY,
    MiniBrowser
  } from '@horizon/core/src/lib/service/miniBrowser'
  import MiniBrowserModal from './MiniBrowserModal.svelte'
  import BrowserTab from '../Browser/BrowserTab.svelte'

  const log = useLogScope('MiniBrowser')

  export let service: MiniBrowser
  export let active: boolean = true

  const { isOpen, selected } = service

  let browserTab: BrowserTab

  $: if (browserTab && $selected) {
    $selected.browserTab = browserTab
  }

  const handleClose = () => {
    log.debug('handling close')
    service.close()
  }

  const handleOpenMiniBrowserFromWebview = (e: CustomEvent<string>) => {
    service.openWebpage(e.detail)
  }

  $: isGlobal = service.key === MINI_BROWSER_SERVICE_CONTEXT_KEY
</script>

<div class="modal">
  {#if $isOpen && $selected}
    {#key $selected.id}
      <MiniBrowserModal
        bind:browserTab
        bind:tab={$selected.data}
        selected={$selected}
        {isGlobal}
        resource={$selected.resource}
        highlightSimilarText={$selected.selection?.text}
        jumpToTimestamp={$selected.selection?.timestamp}
        {active}
        on:close={handleClose}
        on:open-mini-browser={handleOpenMiniBrowserFromWebview}
      />
    {/key}
  {/if}
</div>
