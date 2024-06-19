<script lang="ts">
  import { ResourceTypes, type ResourceDataLink, type ResourceDataPost } from '@horizon/types'
  import {
    LinkImporter,
    TwitterImporter,
    WebCrateImporter,
    WebParser,
    YoutubePlaylistImporter,
    type DetectedResource
  } from '@horizon/web-parser'
  import { writable } from 'svelte/store'
  import { useLogScope } from '../../utils/log'
  import { tick } from 'svelte'
  import { getFileType } from '../../utils/files'
  import ResourceType from '../Resources/ResourceType.svelte'
  import { ResourceTag, type ResourceManager } from '../../service/resources'
  import { wait } from '../../utils/time'
  import type { BatchFetcher } from '@horizon/web-parser/src/importers/batcher'

  export let resourceManager: ResourceManager

  const log = useLogScope('Importer')

  let webcrateDomain = (window as any).WEBCRATE_DOMAIN ?? import.meta.env.R_VITE_WEBCRATE_DOMAIN
  let webcrateApiKey = (window as any).WEBCRATE_API_KEY ?? import.meta.env.R_VITE_WEBCRATE_API_KEY

  const FETCH_BATCH_SIZES = {
    webcrate: 300,
    twitter: 100,
    youtube: 50
  }
  const PROCESS_BATCH_SIZE = 10
  const LIMIT = 500

  const linkImporter = new LinkImporter()

  const queue = writable<DetectedResource[]>([])
  const processing = writable<DetectedResource[]>([])
  const processed = writable<{ resource: DetectedResource; sourceId: string }[]>([])
  const failed = writable<DetectedResource[]>([])

  const running = writable(false)
  const fetchDone = writable(false)
  const dryRun = writable(true)
  const processBatchSize = writable(PROCESS_BATCH_SIZE)
  const tab = writable<'webcrate' | 'twitter' | 'csv' | 'browser' | 'youtube'>('twitter')

  let showDebug = true
  let csvData = ''
  let htmlBookmarksData = ''
  let youtubePlaylistUrl = ''
  let batchFetcher: BatchFetcher<DetectedResource>

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

  const fillQueue = async () => {
    if ($fetchDone) {
      log.warn('fill queue was called even though fetch is done')
      return
    }

    if ($tab === 'webcrate' || $tab === 'twitter' || $tab === 'youtube') {
      const batch = await batchFetcher.fetchNextBatch()
      log.debug('Filling queue', batch.length)

      if (batch.length === 0) {
        fetchDone.set(true)
      }

      if ($queue.length + $processing.length + $processed.length + batch.length >= LIMIT) {
        fetchDone.set(true)
      }

      queue.update((prev) => [...prev, ...batch])
    } else if ($tab === 'csv') {
      log.debug('Parsing CSV data')
      const lines = csvData.split('\n')
      const headersMatch = lines[0].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
      log.debug('Headers', headersMatch)
      const headers = headersMatch?.map((header) => header.replace(/"/g, '')) ?? []
      const data = lines.slice(1).map((line) => {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        return headers.reduce((acc, key, index) => {
          acc[key] = parts[index]
          return acc
        }, {} as any)
      })

      const resources = data.map((item) => ({
        type: ResourceTypes.LINK,
        data: {
          url: item.url,
          title: item.title ?? item.name,
          description: item.description ?? item.excerpt,
          tags: item.tags ? item.tags.split(',') : [],
          date_published: item.published ?? item.created,
          image: item.image ?? item.cover
        } as any as ResourceDataLink
      }))

      fetchDone.set(true)

      queue.update((prev) => [...prev, ...resources])
    } else if ($tab === 'browser') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlBookmarksData, 'text/html')
      const links = Array.from(doc.querySelectorAll('a'))
      const data = links.map((link) => ({
        url: link.href,
        title: link.innerText
      }))

      const resources = data.map((item) => ({
        type: ResourceTypes.LINK,
        data: {
          url: item.url,
          title: item.title
        } as any as ResourceDataLink
      }))

      fetchDone.set(true)

      queue.update((prev) => [...prev, ...resources])
    } else {
      log.error('Unknown tab', $tab)
    }

    log.debug('Queue size', $queue.length)
  }

  const processItem = async (item: DetectedResource) => {
    try {
      if (item.type === ResourceTypes.LINK) {
        const link = item.data as ResourceDataLink

        log.debug('Processing item', link.url)

        processing.update((prev) => [...prev, item])
        queue.update((prev) => prev.filter((i) => i !== item))

        const detectedResource = await linkImporter.processLink(link)

        log.debug('Detected resource for item', link.url, detectedResource)

        if (!$dryRun) {
          const resource = await resourceManager.createResourceOther(
            new Blob([JSON.stringify(detectedResource.data)], { type: detectedResource.type }),
            { sourceURI: link.url },
            [ResourceTag.import()]
          )

          log.debug('Resource created', resource)
        }

        processed.update((prev) => [
          ...prev,
          { resource: detectedResource, sourceId: link.source_id! }
        ])
      } else if (item.type.startsWith(ResourceTypes.POST)) {
        const post = item.data as ResourceDataPost
        log.debug('Processing item', post.url)

        processing.update((prev) => [...prev, item])
        queue.update((prev) => prev.filter((i) => i !== item))

        if (!$dryRun) {
          const resource = await resourceManager.createResourceOther(
            new Blob([JSON.stringify(post)], { type: item.type }),
            { sourceURI: post.url },
            [ResourceTag.import()]
          )

          log.debug('Resource created', resource)
        }

        processed.update((prev) => [...prev, { resource: item, sourceId: post.post_id! }])
      } else {
        log.error('Unknown resource type', item)
      }
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
      // running.set(false)
    }
  }

  const startImport = async () => {
    log.debug('Starting import')

    if ($tab === 'webcrate') {
      const appImporter = new WebCrateImporter(webcrateDomain, webcrateApiKey)
      batchFetcher = appImporter.getBatchFetcher(FETCH_BATCH_SIZES.webcrate)
    } else if ($tab === 'twitter') {
      const appImporter = new TwitterImporter()
      batchFetcher = appImporter.getBatchFetcher(FETCH_BATCH_SIZES.twitter)
      await appImporter.init()
    } else if ($tab === 'youtube') {
      const appImporter = new YoutubePlaylistImporter(youtubePlaylistUrl)
      batchFetcher = appImporter.getBatchFetcher(FETCH_BATCH_SIZES.youtube)

      await appImporter.init()
    }

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
    <div class="header">
      <h1>Importer 5000™</h1>

      <div class="tabs">
        <button on:click={() => tab.set('twitter')} class="tab" class:active={$tab === 'twitter'}
          >Twitter</button
        >
        <button on:click={() => tab.set('csv')} class="tab" class:active={$tab === 'csv'}
          >CSV</button
        >
        <button on:click={() => tab.set('webcrate')} class="tab" class:active={$tab === 'webcrate'}
          >WebCrate</button
        >
        <button on:click={() => tab.set('youtube')} class="tab" class:active={$tab === 'youtube'}
          >YouTube</button
        >
        <button on:click={() => tab.set('browser')} class="tab" class:active={$tab === 'browser'}
          >Firefox/Chrome</button
        >
      </div>
    </div>

    {#if $tab === 'webcrate'}
      <div class="service">
        <h2>WebCrate Setup</h2>

        <div class="explainer">
          <p>
            To import links from WebCrate the app needs to connect to your WebCrate instance using
            the WebCrate API.
          </p>
          <p>
            You need to generate a API key from your <a
              href="https://deta.space"
              target="_blank"
              class="link">Space dashboard.</a
            >
          </p>
        </div>

        <div class="inputs">
          <label>
            Domain
            <input type="text" placeholder="WebCrate instance domain" bind:value={webcrateDomain} />
          </label>

          <label>
            API Key
            <input
              type="password"
              placeholder="WebCrate instance API key"
              bind:value={webcrateApiKey}
            />
          </label>
        </div>
      </div>
    {:else if $tab === 'twitter'}
      <div class="service">
        <h2>Twitter Setup</h2>

        <div class="explainer">
          <p>
            To import your Twitter bookmarks you need to be logged in to Twitter.com in this app.
            Your bookmarks will be extracted automatically without further setup.
          </p>
        </div>

        <a href="https://twitter.com/login" target="_blank" class="link">Login to Twitter ↗</a>
      </div>
    {:else if $tab === 'csv'}
      <div class="service">
        <h2>CSV / Raindrop</h2>

        <div class="explainer">
          <p>
            To import your links from bookmarking services like Raindrop.io you need to export your
            data as CSV and paste it below.
          </p>

          <p>
            Checkout <a href="https://help.raindrop.io/export/" target="_blank" class="link"
              >Raindrop's Docs</a
            > on how to export your data.
          </p>
        </div>

        <textarea placeholder="csv data" bind:value={csvData}></textarea>
      </div>
    {:else if $tab === 'browser'}
      <div class="service">
        <h2>Firefox / Chrome</h2>

        <div class="explainer">
          <p>Export your bookmarks from your browser and paste the HTML file exporterd below.</p>
        </div>

        <textarea placeholder="exported html file" bind:value={htmlBookmarksData}></textarea>
      </div>
    {:else if $tab === 'youtube'}
      <div class="service">
        <h2>YouTube Playlist</h2>

        <div class="explainer">
          <p>
            To import videos from a YouTube playlist you need to paste the playlist URL below. The
            videos will be imported automatically without further setup.
          </p>

          <p>
            If the playlist is private you need to be <a
              href="https://youtube.com/login"
              target="_blank"
              class="link">logged in to youtube.com</a
            > in this app.
          </p>
        </div>

        <div class="inputs">
          <input
            placeholder="https://www.youtube.com/playlist?list=<id>"
            bind:value={youtubePlaylistUrl}
          />
        </div>
      </div>
    {/if}

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
      {#if $queue.length + $processing.length + $processed.length + $failed.length !== 0}
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
      {/if}

      <div class="list">
        {#each $failed as item}
          <a href={item.data.url} target="_blank" class="item failed">{item.data.url}</a>
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
    background-color: white;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    max-width: 600px;
    width: 90%;
  }

  .header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .tab {
    padding: 0.5rem;
    background: none;
    border: none;
    cursor: pointer;
    appearance: none;
    margin: none;
    outline: none;
    font-size: 1.2rem;

    &.active {
      border-bottom: 2px solid #ababab;
    }
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
    gap: 1.25rem;
    background: #f0f0f0;
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid #ccc;

    h2 {
      font-size: 1.2rem;
      font-weight: 500;
    }

    .explainer {
      font-size: 1rem;
      color: #666;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .inputs {
      display: flex;
      flex-direction: column;
      gap: 1rem;

      label {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        font-weight: 500;
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

    textarea {
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 8px;
      appearance: none;
      margin: none;
      outline: none;
      font-size: 1rem;
      height: 200px;
      width: 100%;
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
    background-color: #f26daa;
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

  .link {
    color: #1da1f2;
    border: none;
    cursor: pointer;
    appearance: none;
    margin: none;
    outline: none;
    font-size: 1rem;
    text-decoration: none;
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
      back10ground-color: #f4cfcf;
    }
  }
</style>
