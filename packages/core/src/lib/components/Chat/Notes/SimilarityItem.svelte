<script lang="ts" context="module">
  // prettier-ignore
  export type InsertSourceEvent = {
    source: AIChatMessageSource,
    text: string,
    summarized: boolean
  };
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'

  import { Icon } from '@horizon/icons'
  import { tooltip, useLogScope } from '@horizon/utils'

  import PreviewSource from '@horizon/core/src/lib/components/Resources/Previews/PreviewSource.svelte'
  import { useResourceManager, type Resource } from '@horizon/core/src/lib/service/resources'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import type {
    AIChatMessageSource,
    HighlightWebviewTextEvent,
    JumpToWebviewTimestampEvent
  } from '@horizon/core/src/lib/types'
  import { getResourcePreview, type PreviewData } from '@horizon/core/src/lib/utils/resourcePreview'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { useGlobalMiniBrowser } from '@horizon/core/src/lib/service/miniBrowser'
  import {
    CreateTabEventTrigger,
    EventContext,
    OpenInMiniBrowserEventFrom,
    SummarizeEventContentSource
  } from '@horizon/types'

  export let source: AIChatMessageSource
  export let summarize: boolean = false

  const log = useLogScope('SimilarityItem')
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const globalMiniBrowser = useGlobalMiniBrowser()
  const ai = useAI()

  const dispatch = createEventDispatcher<{
    insert: InsertSourceEvent
    highlightWebviewText: HighlightWebviewTextEvent
    seekToTimestamp: JumpToWebviewTimestampEvent
  }>()

  let resource: Resource | null = null
  let previewData: PreviewData | null = null
  let summarizing = false
  let truncate = true
  let summary: string | null = null

  const handleInsert = () => {
    log.debug('Inserting', source)

    dispatch('insert', {
      source: source,
      text: summarize && summary ? summary : source.content,
      summarized: summarize && summary ? true : false
    })
  }

  const openSource = (preview: boolean) => {
    if (summarize) {
      if (preview) {
        globalMiniBrowser.openResource(source.resource_id, {
          from: OpenInMiniBrowserEventFrom.Note
        })
      } else {
        tabsManager.openResourcFromContextAsPageTab(source.resource_id, {
          trigger: CreateTabEventTrigger.NoteCitation
        })
      }

      return
    }

    if (source.metadata?.timestamp !== undefined && source.metadata?.timestamp !== null) {
      dispatch('seekToTimestamp', {
        resourceId: source.resource_id,
        timestamp: source.metadata.timestamp,
        preview: preview,
        context: EventContext.Note
      })
      return
    }

    dispatch('highlightWebviewText', {
      resourceId: source.resource_id,
      answerText: summarize && summary ? summary : source.content,
      sourceUid: source.uid,
      preview: preview,
      context: EventContext.Note
    })
  }

  const handleHighlight = () => {
    log.debug('Highlighting', source)

    openSource(true)
  }

  const handleOpen = (e: MouseEvent) => {
    log.debug('Opening', source)

    openSource(false)
  }

  const handleExpand = () => {
    truncate = !truncate
  }

  const summarizeContent = async () => {
    try {
      summarizing = true
      truncate = false

      if (summary) {
        return
      }

      const completion = await ai.summarizeText(source.content, {
        context: EventContext.Note,
        contentSource: SummarizeEventContentSource.Citation
      })

      if (completion.error) {
        log.error('Error generating AI output', completion.error)
        summarize = false
        return
      }

      summary = completion.output

      log.debug('Summarized', source, summary)
    } catch (e) {
      log.error(e)
    } finally {
      summarizing = false
    }
  }

  $: if (summarize) {
    summarizeContent()
  } else {
    truncate = true
  }

  onMount(async () => {
    try {
      resource = await resourceManager.getResource(source.resource_id)
      if (resource) {
        previewData = await getResourcePreview(resource)
        log.debug('Preview', previewData)
      }
    } catch (e) {
      log.error(e)
    }
  })
</script>

<div class="wrapper">
  {#if resource && previewData}
    <div class="metadata">
      {#if previewData.metadata && previewData.metadata.length > 0}
        <div class="source-wrapper">
          <PreviewSource
            data={previewData.metadata[0]}
            text={previewData.title || previewData.source?.text}
            type={resource.type}
          />
        </div>
      {/if}

      <div class="actions">
        {#if !summarize}
          {#if truncate}
            <button use:tooltip={{ text: 'Expand Text' }} class="action" on:click={handleExpand}>
              <Icon name="line-height" size="15px" />
            </button>
          {:else}
            <button use:tooltip={{ text: 'Collapse Text' }} class="action" on:click={handleExpand}>
              <Icon name="text-collapse" size="15px" />
            </button>
          {/if}
        {/if}

        <button use:tooltip={{ text: 'Insert into Note' }} class="action" on:click={handleInsert}>
          <Icon name="textInsert" size="15px" />
        </button>

        <button
          use:tooltip={{ text: 'Open in Mini Browser' }}
          class="action"
          on:click={handleHighlight}
        >
          <Icon name="eye" size="15px" />
        </button>

        <button use:tooltip={{ text: 'Open as Tab' }} class="action" on:click={handleOpen}>
          <Icon name="arrow.up.right" size="15px" />
        </button>
      </div>
    </div>

    {#if summarizing}
      <div class="loading">
        <Icon name="spinner" size="15px" /> Summarizing…
      </div>
    {:else}
      <div class="content" class:truncating={truncate}>
        {summarize ? summary : source.content}
      </div>
    {/if}
  {/if}
</div>

<style lang="scss">
  .wrapper {
    flex-shrink: 0;
    width: 100%;
    height: min-content;
    background: white;
    border: 1px solid #e5e5e5;
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    :global(.dark) & {
      background: #1a1a1a;
      border-color: #333;
    }

    &:hover {
      .action {
        display: block;
        opacity: 0.5;
      }
    }
  }

  .metadata {
    flex-shrink: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .source-wrapper {
    width: 100%;
    overflow: hidden;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 22px;
  }

  .action {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 50%;
    transition:
      background 0.2s,
      opacity 0.2s;
    opacity: 0;

    :global(.dark) & {
      &:hover {
        background: #333;
      }
    }

    &:hover {
      background: rgba(0, 0, 0, 0.1);
      opacity: 1 !important;
    }
  }

  .content {
    font-size: 0.9em;
    line-height: 1.5;
    color: #333;
    user-select: text;

    :global(.dark) & {
      color: #f3f3f3;
    }
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95em;
  }

  .truncating {
    // max-height: 200px;
    // overflow-y: auto;
    // text-overflow: ellipsis;

    // truncate after 8 lines
    display: -webkit-box;
    -webkit-line-clamp: 8;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
