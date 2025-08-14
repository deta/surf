<script lang="ts">
  import { writable } from 'svelte/store'
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { type Fn } from '@deta/types'

  import { useLogScope, wait } from '@deta/utils'
  import { useViewManager, type WebContentsView, type WebContents } from '@deta/services'

  export let active: boolean = true
  export let view: WebContentsView

  const viewManager = useViewManager()

  const log = useLogScope('WebContents')
  const dispatch = createEventDispatcher<any>()

  const webContentsBackgroundColor = writable<string | null>(null)
  const webContentsScreenshot = writable(null)

  let webContentsWrapper: HTMLDivElement | null = null
  let webContentsView: WebContents | null = null
  let unsubs: Fn[] = []

  onMount(async () => {
    if (!webContentsWrapper) {
      log.error('WebContents wrapper element is not defined')
      return
    }

    log.debug('Mounting web contents view', view.id)

    await wait(200)

    const wcv = await view.mount(webContentsWrapper)
    webContentsView = wcv

    unsubs.push(
      view.screenshot.subscribe((screenshot) => {
        webContentsScreenshot.set(screenshot)
      })
    )

    unsubs.push(
      view.backgroundColor.subscribe((color) => {
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
  class:active
  bind:this={webContentsWrapper}
  style="--background-image: {$webContentsScreenshot?.image
    ? `url(${$webContentsScreenshot?.image})`
    : $webContentsBackgroundColor
      ? $webContentsBackgroundColor
      : 'white'};"
></div>

<style lang="scss">
  .webcontentsview-container {
    position: absolute;
    top: 0;
    left: 0;
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
