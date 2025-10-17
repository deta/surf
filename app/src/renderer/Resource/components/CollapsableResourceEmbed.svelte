<script lang="ts">
  import { Icon } from '@deta/icons'
  import {
    isModKeyPressed,
    tooltip,
    useDebounce,
    useLogScope,
    getHostname,
    getFileKind
  } from '@deta/utils'

  import { onMount, tick } from 'svelte'
  import type { WebviewTag } from 'electron'
  import { writable } from 'svelte/store'
  import { useResourceManager } from '@deta/services/resources'
  import {
    AddResourceToSpaceEventTrigger,
    OpenInMiniBrowserEventFrom,
    ResourceTagsBuiltInKeys
  } from '@deta/types'
  import type { Resource } from '@deta/services/resources'
  import { SpaceEntryOrigin, type BookmarkTabState } from '@deta/types'
  import { useToasts } from '@deta/ui'
  import CollapsableBlock from './CollapsableBlock.svelte'
  import Image from '@deta/ui/src/lib/components/Image/Image.svelte'

  export let resource: Resource
  export let tab: any | undefined = undefined
  export let showPreview: boolean = true
  export let initialCollapsed: boolean | 'auto' = 'auto'
  export let fullSize = false
  export let collapsable = true
  export let saveable = true
  export let draggable: boolean = true
  export let resizable: boolean = false
  export let minHeight: string = '200px'
  export let maxHeight: string = '1000px'
  export let initialHeight: string = '400px'
  export let expandable = true
  export let hideHeader = false
  export let isEditable: boolean = true

  export const reloadApp = async () => {
    if (showPreview || showHiddenPreview) {
      renderHTMLPreview()
    }
  }

  const log = useLogScope('CollapsableResourceEmbed')
  const resourceManager = useResourceManager()
  const toasts = useToasts()

  const generatedName = writable('')
  const customName = writable('')
  const appIsLoading = writable(false)
  const saveState = writable<BookmarkTabState>('idle')

  let appContainer: HTMLDivElement
  let webview: WebviewTag | null = null
  let webviewMediaPlaying = false
  let webviewMuted = true
  let showImagePreview = false

  let showHiddenPreview = false
  let collapsed = initialCollapsed === 'auto' ? true : initialCollapsed

  $: if (initialCollapsed) {
    collapsed = true
  } else if (!initialCollapsed) {
    collapsed = false
  }

  $: canonicalUrl = (resource?.tags ?? []).find(
    (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
  )?.value

  $: silentResource =
    resource && (resource.tags ?? []).some((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)

  $: if ((showPreview || showHiddenPreview) && !collapsed && expandable) {
    renderHTMLPreview()
  }

  $: if (tab && tab.title !== $customName) {
    customName.set(tab.title)
  }

  $: if (resource && !silentResource && $saveState === 'idle') {
    saveState.set('saved')
  }

  const changeResourceName = useDebounce(async (name: string) => {
    if (!resource) return
    await resourceManager.updateResourceMetadata(resource.id, { name })
    // tabsManager.updateResourceTabs(resource.id, { title: name })
  }, 300)

  const handleChangeTitle = (e: CustomEvent<string>) => {
    changeResourceName(e.detail)
  }

  const saveAppAsResource = async (spaceId?: string, silent = false) => {
    try {
      if (!silent) {
        saveState.set('in_progress')
      }

      if (!silent) {
        await resourceManager.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.SILENT)
      }

      log.debug('Saved app', resource)

      if (!resource) {
        if (!silent) {
          saveState.set('error')
        }
        return
      }

      if (!silent) {
        saveState.set('saved')
        toasts.success(spaceId ? 'Saved to Context!' : 'Saved to Stuff!')
      }

      return resource
    } catch (error: any) {
      log.error('Error saving app', error)

      if (!silent) {
        saveState.set('error')
      }
    }
  }

  const handleOpenAsTab = async (e: MouseEvent) => {
    // if (resource) {
    //   tabsManager.openResourceAsTab(resource, {
    //     active: !isModKeyPressed(e)
    //   })
    // }
  }

  const setWebviewMuted = (value?: boolean) => {
    if (webview) {
      const muted = value ?? !webviewMuted
      webview.setAudioMuted(muted)
      webviewMuted = muted
    }
  }

  const renderHTMLPreview = async () => {
    await tick()

    // Check if this is an image resource
    if (resource?.type?.startsWith('image/')) {
      log.debug('Rendering image preview', resource.id)
      showImagePreview = true
      return
    }

    if (!appContainer) {
      log.debug('No app container')
      return
    }

    appContainer.innerHTML = ''

    if (!canonicalUrl) {
      log.debug('Not HTML or no canonical URL')
      return
    }

    log.debug('Rendering HTML preview', canonicalUrl)

    webview = document.createElement('webview') as WebviewTag
    // @ts-ignore
    webview.nodeintegration = false
    // @ts-ignore
    webview.webpreferences =
      'autoplayPolicy=document-user-activation-required,contextIsolation=true,nodeIntegration=false,sandbox=true,webSecurity=true'
    webview.partition = `persist:horizon`
    webview.style.width = '100%'
    webview.style.height = '100%'
    webview.style.border = 'none'

    // webview.addEventListener('page-title-updated', (e) => {
    //   $generatedName = e.title
    // })

    webview.addEventListener('did-start-loading', () => appIsLoading.set(true))
    webview.addEventListener('did-stop-loading', () => appIsLoading.set(false))
    webview.addEventListener('dom-ready', () => setWebviewMuted(true))
    webview.addEventListener('media-started-playing', () => (webviewMediaPlaying = true))
    webview.addEventListener('media-paused', () => (webviewMediaPlaying = false))

    appContainer.appendChild(webview)

    // @ts-ignore
    webview.src = canonicalUrl
  }

  const openMiniBrowser = async () => {
    // globalMiniBrowser.openResource(resource.id, {
    //   from: OpenInMiniBrowserEventFrom.Note
    // })
  }

  onMount(async () => {
    if (
      resource &&
      !(resource.tags ?? []).some((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)
    ) {
      saveState.set('saved')
    }

    log.debug('Collapsable resource block mounted', { resource, initialCollapsed, showPreview })

    $generatedName =
      resource.metadata?.name ||
      (canonicalUrl ? getHostname(canonicalUrl) : getFileKind(resource.type)) ||
      ''

    if (showPreview) {
      renderHTMLPreview()
    }
  })
</script>

<CollapsableBlock
  title={$customName || $generatedName || canonicalUrl}
  bind:collapsed
  {resource}
  {fullSize}
  {collapsable}
  {resizable}
  {minHeight}
  {maxHeight}
  {initialHeight}
  {initialCollapsed}
  {hideHeader}
  {draggable}
  {isEditable}
  fitContent={resource?.type?.startsWith('image/')}
  additionalWrapperStyles={resource?.type?.startsWith('image/') ? 'max-height: max-content' : ''}
  {...$$restProps}
  on:change-title={handleChangeTitle}
>
  <div slot="actions" class="flex items-center gap-3">
    {#if expandable}
      {#if collapsed}
        <div class="flex items-center gap-1">
          <div class="p-1 opacity-60">
            <Icon name="world" />
          </div>
        </div>
      {:else}
        <div class="flex items-center gap-2">
          {#if webviewMediaPlaying}
            <button
              tabindex="-1"
              use:tooltip={{
                text: webviewMuted ? 'Unmute Audio' : 'Mute Audio',
                position: 'left'
              }}
              class="flex items-center p-1 rounded-md transition-colors"
              on:click|stopPropagation={() => setWebviewMuted()}
            >
              {#if webviewMuted}
                <Icon name="mute" size="16px" />
              {:else}
                <Icon name="unmute" size="16px" />
              {/if}
            </button>
          {/if}

          <!-- {#if saveable}
            <SaveToStuffButton
              state={saveState}
              {resource}
              side="left"
              className="flex items-center  p-1 rounded-md  transition-colors"
              on:save={(e) => saveAppAsResource(e.detail, false)}
            />
          {/if} -->

          <button
            tabindex="-1"
            use:tooltip={{ text: 'Reload', position: 'left' }}
            class="flex items-center p-1 rounded-md transition-colors"
            on:click|stopPropagation={() => reloadApp()}
          >
            <div class="flex items-center gap-1">
              {#if $appIsLoading}
                <Icon name="spinner" size="16px" />
              {:else}
                <Icon name="reload" size="16px" />
              {/if}
            </div>
          </button>

          <button
            tabindex="-1"
            use:tooltip={{ text: 'Open in Mini Browser', position: 'left' }}
            class="flex items-center p-1 rounded-md transition-colors"
            on:click|stopPropagation={() => openMiniBrowser()}
          >
            <Icon name="eye" size="16px" />
          </button>

          <button
            tabindex="-1"
            use:tooltip={{ text: 'Open as Tab', position: 'left' }}
            class="flex items-center p-1 rounded-md transition-colors"
            on:click|stopPropagation={handleOpenAsTab}
          >
            <Icon name="arrow.up.right" size="16px" />
          </button>
        </div>
      {/if}
    {/if}
  </div>

  {#if showImagePreview}
    <div class="image-preview-container">
      <Image
        src={`surf://surf/resource/${resource.id}?raw=true`}
        alt={resource.metadata?.name || 'Image'}
        style="height: 100%; width: 100%; max-width: 100%; object-fit: contain; border-radius: 8px;"
      />
    </div>
  {:else}
    <div bind:this={appContainer} class="webview-container" />
  {/if}
</CollapsableBlock>

<style lang="scss">
  .image-preview-container {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    background-color: light-dark(white, #1e2433);
  }

  .webview-container {
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
