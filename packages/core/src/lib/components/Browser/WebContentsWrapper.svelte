<script lang="ts">
  import type {
    WebContentsViewEvents,
    WebContentsViewEventType,
    WebContentsViewEventTyped
  } from '@horizon/types'
  import WebContents from './WebContents.svelte'

  const handleDidFinishLoad = (
    e: CustomEvent<WebContentsViewEvents[WebContentsViewEventType.DID_FINISH_LOAD]>
  ) => {
    const event = e.detail
    console.log('WebContents finished loading', event)
  }
</script>

<WebContents on:did-finish-load={handleDidFinishLoad} />
