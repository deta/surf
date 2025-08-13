<script lang="ts">
  import { writable, type Writable } from 'svelte/store'
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import {
    WebContentsViewEventType,
    WebViewEventSendNames,
    type WebContentsViewEventListener,
    type WebContentsViewEventListenerCallback,
    type WebContentsViewEvents,
    type WebViewSendEvents
  } from '@deta/types'

  import { useLogScope } from '@deta/utils'
  import type { NewWindowRequest } from '@deta/services/src/ipc'
  import { useViewManager, type View, type WebContentsView } from '@deta/services'

  export let view: View

  const viewManager = useViewManager()

  const log = useLogScope('WebContents')
  const dispatch = createEventDispatcher<any>()

  let webContentsWrapper: HTMLDivElement | null = null
  let webContentsView: WebContentsView | null = null

  // why svelte, whyyyy?!
  $: webContentsBackgroundColor =
    webContentsView !== null ? webContentsView?.backgroundColor : writable(null)
  $: webContentsScreenshot = webContentsView !== null ? webContentsView?.screenshot : writable(null)

  /*
    INITIALIZATION
  */

  onMount(async () => {
    if (!webContentsWrapper) {
      log.error('WebContents wrapper element is not defined')
      return
    }

    log.debug('Rendering web contents view', view.id)
    const wcv = await view.render(webContentsWrapper)
    webContentsView = wcv
  })

  onDestroy(() => {
    log.debug('Destroying web contents view', view.id)
    view.destroy()
  })
</script>

<div
  id="webcontentsview-container"
  class="webcontentsview-container quality-{$webContentsScreenshot?.quality || 'none'}"
  bind:this={webContentsWrapper}
  style="--background-image: {$webContentsScreenshot?.image
    ? `url(${$webContentsScreenshot?.image})`
    : $webContentsBackgroundColor
      ? $webContentsBackgroundColor
      : 'white'};"
></div>

<style lang="scss">
  .webcontentsview-container {
    width: 100%;
    height: 100%;
    background: var(--background-image, white);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    filter: blur(0);
    transition: filter 0.2s ease-in-out;
    overflow: hidden;

    &:not(:active) {
      filter: blur(2px);
    }
  }

  :global(.screen-picker-active .webcontentsview-container) {
    filter: none !important;
  }
</style>
