<script lang="ts">
  import type { ResourceDataLink } from '@horizon/types'
  import {
    LinkImporter,
    WebCrateImporter,
    WebParser,
    type DetectedResource
  } from '@horizon/web-parser'
  import { writable } from 'svelte/store'
  import { useLogScope } from '../../utils/log'
  import { tick } from 'svelte'
  import { getFileType } from '../../utils/files'
  import ResourceType from '../Resources/ResourceType.svelte'
  import { ResourceTag, type ResourceManager } from '../../service/resources'

  export let resourceManager: ResourceManager

  const log = useLogScope('Importer')

  let webcrateDomain = (window as any).WEBCRATE_DOMAIN ?? import.meta.env.R_VITE_WEBCRATE_DOMAIN
  let webcrateApiKey = (window as any).WEBCRATE_API_KEY ?? import.meta.env.R_VITE_WEBCRATE_API_KEY
  const FETCH_BATCH_SIZE = 50
  const PROCESS_BATCH_SIZE = 10
  const LIMIT = 500

  const linkImporter = new LinkImporter()
  const appImporter = new WebCrateImporter(webcrateDomain, webcrateApiKey)
  const batchFetcher = appImporter.getBatchFetcher(FETCH_BATCH_SIZE)

  const queue = writable<ResourceDataLink[]>([])
  const processing = writable<ResourceDataLink[]>([])
  const processed = writable<{ resource: DetectedResource; sourceId: string }[]>([])
  const failed = writable<ResourceDataLink[]>([])

  const running = writable(false)
  const fetchDone = writable(false)
  const dryRun = writable(true)
  const processBatchSize = writable(PROCESS_BATCH_SIZE)

  let showDebug = false

  $: log.debug('Queue changed', $queue)
  $: log.debug('Processing changed', $processing)
  $: log.debug('Processed changed', $processed)
  $: log.debug('Failed changed', $failed)

  $: if (!$running) {
    log.debug('Import stopped')
  }

  $: if ($processed.length + $failed.length === LIMIT) {
    running.set(false)
    log.debug('Import finished')
  }

  $: if ($running && $queue.length > 0 && $processing.length === 0) {
    log.debug('Queue is not empty, processing next item')
    processNextItem()
  }

  // $: if ($running && $processing.length < PROCESS_BATCH_SIZE && $queue.length > 0) {
  //   log.debug('Processing next item')

  //   const link = $queue[0]
  //   if (link) {
  //     log.debug('Processing item', link)
  //     processItem(link)
  //   } else {
  //     log.debug('Queue is empty')
  //     running.set(false)
  //   }
  // }

  const fillQueue = async () => {
    if ($fetchDone) {
      log.warn('fill queue was called even though fetch is done')
      return
    }

    const batch = await batchFetcher.fetchNextBatch()
    log.debug('Filling queue', batch.length)

    if (batch.length === 0) {
      fetchDone.set(true)
    }

    if ($queue.length + $processing.length + $processed.length + batch.length >= LIMIT) {
      fetchDone.set(true)
    }

    queue.update((prev) => [...prev, ...batch])

    log.debug('Queue size', $queue.length)
  }

  const processItem = async (item: ResourceDataLink) => {
    try {
      log.debug('Processing item', item.url)

      processing.update((prev) => [...prev, item])
      queue.update((prev) => prev.filter((i) => i !== item))

      const detectedResource = await linkImporter.processLink(item)

      if (!$dryRun) {
        const resource = await resourceManager.createResourceOther(
          new Blob([JSON.stringify(detectedResource.data)], { type: detectedResource.type }),
          { sourceURI: `https://${webcrateDomain}/link/${item.source_id}` },
          [ResourceTag.import()]
        )

        log.debug('Resource created', resource)
      }

      processed.update((prev) => [
        ...prev,
        { resource: detectedResource, sourceId: item.source_id! }
      ])
    } catch (error) {
      log.error('Error processing link', item, error)
      failed.update((prev) => [...prev, item])
    } finally {
      processing.update((prev) => prev.filter((i) => i !== item))
    }
  }

  const processNextItem = async () => {
    await tick()
    if ($processing.length >= $processBatchSize) {
      log.debug('Processing batch is full')
      return
    }

    log.debug('Processing next item')

    const link = $queue[0]
    if (link) {
      log.debug('Processing item', link)
      processItem(link)
    } else {
      log.debug('Queue is empty')
      running.set(false)
    }
  }

  const startImport = async () => {
    log.debug('Starting import')
    running.set(true)

    queue.subscribe(async (items) => {
      log.debug('Queue changed', items)

      const fetchedSoFar = $processing.length + $processed.length + items.length + $failed.length
      if ($running && items.length === 0 && fetchedSoFar < LIMIT) {
        log.debug('Queue is empty, filling queue')
        await fillQueue()
        await tick()
      }

      if ($running && $processing.length < $processBatchSize && items.length > 0) {
        await tick()
        await processNextItem()
      }
    })

    processing.subscribe(async (items) => {
      log.debug('Processing changed', items)

      if ($running && items.length < $processBatchSize && $queue.length > 0) {
        await tick()
        await processNextItem()
      }
    })
  }

  const stopImport = () => {
    log.debug('Stopping import')
    running.set(false)
  }
</script>

<div class="wrapper">
  <div class="content">
    <h1>Link Importer</h1>

    <div class="service">
      <h2>WebCrate Config</h2>

      <div class="inputs">
        <label>
          Domain
          <input type="text" bind:value={webcrateDomain} />
        </label>

        <label>
          API Key
          <input type="password" bind:value={webcrateApiKey} />
        </label>
      </div>
    </div>

    <div class="section">
      <button class="btn" on:click={() => ($running ? stopImport() : startImport())}>
        {#if $running}
          Importing Links…
        {:else}
          Start Import
        {/if}
      </button>

      <div class="debug">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="debug-toggle" on:click={() => (showDebug = !showDebug)}>Debug Controls</div>
        {#if showDebug}
          <div class="controls">
            <label>
              Dry Run
              <input type="checkbox" bind:checked={$dryRun} />
            </label>

            <label>
              Max Concurrent Processing ({$processBatchSize})
              <input type="range" min="1" max="50" bind:value={$processBatchSize} />
            </label>
          </div>
        {/if}
      </div>
    </div>

    <div class="section full">
      <div class="stats">
        <div class="stat">
          <div class="label">Queue</div>
          <div class="value">{$queue.length}</div>
        </div>
        <div class="stat">
          <div class="label">Processing</div>
          <div class="value">{$processing.length}</div>
        </div>
        <div class="stat">
          <div class="label">Processed</div>
          <div class="value">{$processed.length}</div>
        </div>
        <div class="stat">
          <div class="label">Failed</div>
          <div class="value">{$failed.length}</div>
        </div>
      </div>

      <div class="list">
        {#each $failed as item}
          <a href={item.url} target="_blank" class="item failed">{item.url}</a>
        {/each}
        {#each $processed.reverse() as item}
          {@const preview = WebParser.getResourcePreview(item.resource)}
          <a href={preview.url} target="_blank" class="item">
            <div class="bar">
              <div>{preview.title}</div>
              <div class="type">
                <ResourceType type={preview.type} />
              </div>
            </div>
            <div class="url">{preview.url}</div>
          </a>
        {/each}
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    height: 100%;
    padding-top: 5rem;
    display: flex;
    justify-content: center;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    max-width: 500px;
    width: 90%;
  }

  .section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;

    &.full {
      flex: 1;
      height: 100%;
      overflow: hidden;
    }
  }

  h1 {
    font-size: 2rem;
    font-weight: 500;
  }

  .service {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: #f0f0f0;
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid #ccc;

    h2 {
      font-size: 1.2rem;
      font-weight: 500;
    }

    .inputs {
      display: flex;
      flex-direction: column;
      gap: 1rem;

      label {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      input {
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 8px;
        appearance: none;
        margin: none;
        outline: none;
        font-size: 1rem;
      }
    }
  }

  .debug {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    cursor: pointer;

    .debug-toggle {
      width: 100%;
      text-align: center;
    }
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;

    label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  }

  .stats {
    width: 100%;
    padding: 0.5rem 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;

    .stat {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .label {
      font-size: 0.9rem;
      color: #666;
    }

    .value {
      font-size: 1.2rem;
      font-weight: 500;
    }
  }

  .btn {
    padding: 10px 20px;
    background-color: #0d1014;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    appearance: none;
    margin: none;
    outline: none;
    font-size: 1rem;
    width: 100%;
  }

  .list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow: auto;
    width: 100%;
    height: 100%;
    padding-bottom: 2rem;
  }

  .item {
    padding: 10px;
    background-color: #f0f0f0;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-decoration: none;
    color: inherit;

    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;

      div {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .type {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #959595;
      }
    }

    .url {
      font-size: 0.9rem;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &.failed {
      background-color: #f4cfcf;
    }
  }
</style>
