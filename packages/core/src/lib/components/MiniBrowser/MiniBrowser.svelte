<script lang="ts">
  import { useLogScope } from '@deta/utils/io'
  import {
    MINI_BROWSER_SERVICE_CONTEXT_KEY,
    MiniBrowser
  } from '@horizon/core/src/lib/service/miniBrowser'
  import MiniBrowserModal from './MiniBrowserModal.svelte'
  import BrowserTab from '../Browser/BrowserTab.svelte'
  import { createEventDispatcher } from 'svelte'

  export let service: MiniBrowser
  export let active: boolean = true

  const log = useLogScope('MiniBrowser')
  const dispatch = createEventDispatcher<{
    close: boolean
  }>()

  const { isOpen, selected } = service

  let browserTab: BrowserTab

  $: if (browserTab && $selected) {
    $selected.browserTab = browserTab
  }

  const handleClose = (e: CustomEvent<boolean>) => {
    const completeley = e.detail
    log.debug('handling close', completeley)

    service.close()
    dispatch('close', completeley)
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
        selection={$selected.selection}
        parentID={service.parentID}
        {active}
        on:close={handleClose}
        on:open-mini-browser={handleOpenMiniBrowserFromWebview}
        on:highlightWebviewText
        on:seekToTimestamp
      />
    {/key}
  {/if}
</div>
