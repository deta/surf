<script lang="ts">
  import { writable } from 'svelte/store'
  import { onDestroy, onMount } from 'svelte'

  import { ViewLocation, type Fn } from '@deta/types'

  import { useLogScope } from '@deta/utils/io'
  import { wait } from '@deta/utils/data'
  import { type WebContentsView } from '@deta/services/views'
  import { useConfig } from '@deta/services'
  import ErrorPage from './ErrorPage.svelte'

  let {
    active = true,
    view,
    location = ViewLocation.Tab
  }: {
    active?: boolean
    view: WebContentsView
    location?: ViewLocation
  } = $props()

  const log = useLogScope('WebContents')
  const config = useConfig()

  const webContentsBackgroundColor = writable<string | null>(null)
  const webContentsScreenshot = writable(null)

  const error = view.error

  let webContentsWrapper: HTMLDivElement | null = null
  let unsubs: Fn[] = []

  // Compute fallback color immediately to prevent white flash
  const fallbackColor = $derived(config.settingsValue?.app_style === 'dark' ? '#1a1a1a' : 'white')

  onMount(async () => {
    if (!webContentsWrapper) {
      log.error('WebContents wrapper element is not defined')
      return
    }

    log.debug('Mounting web contents view', view.id)

    await wait(200)

    await view.mount(webContentsWrapper, { activate: active }, location)

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

    view.unmount()

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
      : fallbackColor};"
>
  {#if $error}
    <ErrorPage error={$error} on:reload={() => view.webContents.reload()} />
  {/if}
</div>

<style lang="scss">
  .webcontentsview-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--background-image, light-dark(white, #1a1a1a));
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    overflow: hidden;
  }

  //:global(.screen-picker-active .webcontentsview-container) {
  //  filter: none !important;
  //}
</style>
