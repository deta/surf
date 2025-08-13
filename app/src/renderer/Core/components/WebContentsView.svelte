<script lang="ts">
  import { writable, type Writable } from 'svelte/store'
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import {
    WebContentsViewEventType,
    WebViewEventSendNames,
    type Fn,
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

  const webContentsBackgroundColor = writable<string | null>(null)
  const webContentsScreenshot = writable(null)

  let webContentsWrapper: HTMLDivElement | null = null
  let webContentsView: WebContentsView | null = null
  let unsubs: Fn[] = []

  onMount(async () => {
    if (!webContentsWrapper) {
      log.error('WebContents wrapper element is not defined')
      return
    }

    log.debug('Mounting web contents view', view.id)
    const wcv = await view.mount(webContentsWrapper)
    webContentsView = wcv

    unsubs.push(
      wcv.screenshot.subscribe((screenshot) => {
        webContentsScreenshot.set(screenshot)
      })
    )

    unsubs.push(
      wcv.backgroundColor.subscribe((color) => {
        webContentsBackgroundColor.set(color)
      })
    )
  })

  onDestroy(() => {
    log.debug('Destroying web contents view', view.id)
    view.destroy()

    unsubs.forEach((unsub) => unsub())
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
