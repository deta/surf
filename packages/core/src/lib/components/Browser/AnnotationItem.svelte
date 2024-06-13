<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../utils/log'
  import type { ResourceAnnotation } from '../../service/resources'
  import type { AnnotationRangeData, ResourceDataAnnotation } from '../../types'
  import type { ResourcePreviewEvents } from '../Resources/events'
  import { Icon } from '@horizon/icons'

  export let resource: ResourceAnnotation
  export let active = false

  const log = useLogScope('AnnotationItem')
  const dispatch = createEventDispatcher<{ scrollTo: string }>()

  let annotation: ResourceDataAnnotation | null = null
  let content = ''
  let error = ''
  let url: URL
  let elem: HTMLDivElement

  $: if (active) {
    elem.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }

  const handleScrollTo = () => {
    if (!annotation) return
    dispatch('scrollTo', resource.id)
  }

  onMount(async () => {
    try {
      annotation = await resource.getParsedData()

      if (annotation.type === 'highlight') {
        content = (annotation.anchor.data as AnnotationRangeData).content_plain || ''
      }

      url = new URL(resource.metadata?.sourceURI || '')
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    }
  })

  onDestroy(() => {
    log.debug('Releasing data')
    // resource.releaseData()
  })
</script>

<div class="link-card" bind:this={elem} class:active>
  <!-- <a href={document?.url} target="_blank" class="link-card"> -->
  <div class="details">
    {#if error}
      <div class="title">{error}</div>
    {:else if annotation}
      <div class="title">{content}</div>

      <div class="footer">
        <div class="metadata">
          {#if annotation.type === 'highlight'}
            <Icon name="marker" />
            <div class="from">Highlight</div>
          {/if}
        </div>

        <button on:click={handleScrollTo}>View in Page</button>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .link-card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    color: inherit;
    text-decoration: none;
    border-bottom: 0.5px solid rgba(0, 0, 0, 0.15);
  }

  .link-card.active {
    background: #ffc5e7;
    border-radius: 5px;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    flex-shrink: 1;
    flex-grow: 1;
  }

  .favicon {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 5.1px;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .title {
    font-size: 1.1rem;
    line-height: 1.775rem;
    font-weight: 500;
    color: #443d5b;
    flex-shrink: 0;
    margin-top: 1rem;
    max-width: 95%;
  }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    color: #281b53;
    opacity: 0.65;

    button {
      background: none;
      border: none;
      color: #281b53;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
    }
  }

  .metadata {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .from {
      font-size: 1rem;
      font-weight: 500;
      text-decoration: none;
    }
  }
</style>
