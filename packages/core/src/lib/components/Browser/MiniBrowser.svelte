<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import BrowserTab from '@horizon/core/src/lib/components/Browser/BrowserTab.svelte'
  import type { HistoryEntriesManager } from '@horizon/core/src/lib/service/history'
  import WebviewWrapper, { type WebViewWrapperEvents } from '../Cards/Browser/WebviewWrapper.svelte'
  import { writable } from 'svelte/store'
  import {
    ResourceAnnotation,
    ResourceManager,
    ResourceTag,
    type ResourceObject
  } from '../../service/resources'
  import type { Writable } from 'svelte/store'
  import {
    WebViewEventReceiveNames,
    type AnnotationRangeData,
    type DetectedWebApp,
    type ResourceDataAnnotation
  } from '@horizon/types'
  import { useLogScope } from '../../utils/log'
  import AnnotationItem from './AnnotationItem.svelte'
  import { Icon } from '@horizon/icons'
  import { wait } from '@horizon/web-parser/src/utils'

  export let resource: Writable<ResourceObject | undefined>
  export let resourceManager: ResourceManager

  let webview: BrowserTab
  let activeAnnotation = ''

  const initialUrl = writable('https://example.com')
  const dispatch = createEventDispatcher()

  const log = useLogScope('MiniBrowser')

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

  function close() {
    dispatch('close')
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close()
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  let loadingAnnotations = true
  let annotations: ResourceAnnotation[] = []

  const handleAppDetection = async (e: CustomEvent<DetectedWebApp>) => {
    try {
      log.debug('App detected', e.detail)

      if (!$resource) return

      loadingAnnotations = true
      annotations = await resourceManager.getAnnotationsForResource($resource.id)
      log.debug('Annotations', annotations)

      await wait(500)

      annotations.forEach(async (annotation) => {
        log.debug('Restoring highlight', annotation)

        const data = await annotation.getParsedData()
        log.debug('Annotation data', data)

        if (data.type !== 'highlight') return

        webview.sendWebviewEvent(WebViewEventReceiveNames.RestoreHighlight, {
          id: annotation.id,
          range: data.anchor.data as AnnotationRangeData
        })
      })
    } catch (e) {
      log.error(e)
    } finally {
      loadingAnnotations = false
    }
  }

  const handleAnnotationSelect = (e: CustomEvent<string>) => {
    const annotationId = e.detail
    log.debug('Annotation selected', annotationId)
    webview.sendWebviewEvent(WebViewEventReceiveNames.ScrollToAnnotation, annotationId)
  }

  const handleWebViewHighlight = async (e: CustomEvent<WebViewWrapperEvents['highlight']>) => {
    if (!$resource) return

    const { range, url } = e.detail
    log.debug('webview highlight', url, range)

    const annotationResource = await resourceManager.createResourceAnnotation(
      {
        type: 'highlight',
        anchor: {
          type: 'range',
          data: range
        },
        data: {}
      },
      { sourceURI: url },
      [
        // link the annotation to the page using its canonical URL so we can later find it
        ResourceTag.canonicalURL(url),

        // link the annotation to the bookmarked resource
        ResourceTag.annotates($resource.id)
      ]
    )

    log.debug('created annotation resource', annotationResource)
    annotations = [...annotations, annotationResource]

    log.debug('highlighting text in webview')
    webview.sendWebviewEvent(WebViewEventReceiveNames.RestoreHighlight, {
      id: annotationResource.id,
      range: range
    })
  }

  const handleAnnotationClick = (e: CustomEvent<WebViewWrapperEvents['annotationClick']>) => {
    log.debug('Annotation clicked', e.detail)

    activeAnnotation = e.detail.id

    setTimeout(() => {
      activeAnnotation = ''
    }, 1000)
  }
</script>

<div class="mini-browser-wrapper">
  <div class="close-hitarea" on:click={close} aria-hidden="true">
    <span class="label">Click or ESC to close</span>
  </div>
  <div id="mini-browser" class="mini-browser">
    <div class="resource-details">
      <slot />
    </div>

    <BrowserTab
      {tab}
      {historyEntriesManager}
      bind:this={webview}
      on:appDetection={handleAppDetection}
      on:highlight={handleWebViewHighlight}
      on:annotationClick={handleAnnotationClick}
    />

    <div class="annotations-view">
      {#if annotations.length > 0}
        <div class="annotations">
          {#each annotations as annotation (annotation.id)}
            <AnnotationItem
              resource={annotation}
              active={annotation.id === activeAnnotation}
              on:scrollTo={handleAnnotationSelect}
            />
          {/each}
        </div>
      {:else if loadingAnnotations}
        <div class="loading">
          <Icon name="spinner" />
          <p>Loading annotations…</p>
        </div>
      {:else}
        <div class="empty-annotations">
          <div class="empty-title">
            <Icon name="marker" />
            <h1>Nothing Annotated</h1>
          </div>
          <p>Select any text on the page and click the marker icon to highlight it.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .close-hitarea {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 5rem;
    background: linear-gradient(to bottom, #34393d, transparent);

    .label {
      transition: 240ms ease-out;
      color: #b8c7d0;
      user-select: none;
      opacity: 0;
    }

    &:hover {
      .label {
        opacity: 1;
      }
    }

    &:hover ~ .mini-browser {
      transform: translate(-50%, -50%) translateY(2.75rem) scale(0.98);
      backdrop-filter: blur(4px);
      .label {
        opacity: 1;
      }
    }
  }

  .mini-browser {
    position: absolute;
    display: flex;
    gap: 2rem;
    width: 80vw;
    height: 95vh;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    transition: 240ms ease-out;
    z-index: 100000;
  }

  .resource-details {
    position: relative;
    width: 40rem;
    border-radius: 12px;
    background: white;
  }

  .annotations-view {
    position: relative;
    width: 40rem;
    height: 100%;
    border-radius: 12px;
    background: white;
    padding: 1rem;
  }

  .annotations {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    overflow: auto;
    height: 100%;
  }

  .loading {
    margin: auto;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
  }

  .empty-annotations {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    opacity: 0.5;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }

    p {
      font-size: 1rem;
      color: #666;
      text-align: center;
    }
  }

  .empty-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    h1 {
      font-size: 1.25rem;
      font-weight: 500;
    }
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
