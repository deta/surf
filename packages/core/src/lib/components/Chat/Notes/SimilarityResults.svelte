<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { readable, writable } from 'svelte/store'
  import { DynamicIcon, Icon } from '@horizon/icons'
  import { tooltip } from '@horizon/utils'

  import type { AIChatMessageSource } from '@horizon/core/src/lib/types'
  import SimilarityItem from './SimilarityItem.svelte'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'
  import ChangeContextBtn from './ChangeContextBtn.svelte'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { useLogScope } from '@horizon/utils/src/log'
  // import CardSwipeStack from '@horizon/core/src/lib/components/Atoms/CardSwipeStack.svelte'

  export let sources: AIChatMessageSource[]
  export let floating = true
  export let collapsed = false
  export let loading = false
  export let activeSpace = readable<OasisSpace | undefined>(undefined)
  export let selectedContext = writable<string | null>(null)

  const dispatch = createEventDispatcher<{
    close: void
    'open-space': string
    'change-context': string
  }>()
  const log = useLogScope('SimilarityResults')
  const oasis = useOasis()

  const spaces = oasis.spaces

  const processSources = (sources: AIChatMessageSource[], collapsed: boolean) => {
    if (!collapsed) {
      return sources
    }

    // aggregate sources by resource_id
    const aggregatedSources = sources.reduce(
      (acc, source) => {
        if (!acc[source.resource_id]) {
          acc[source.resource_id] = []
        }

        acc[source.resource_id].push(source)

        return acc
      },
      {} as Record<string, AIChatMessageSource[]>
    )

    // append content of each source to the first source
    return Object.values(aggregatedSources).map((sources) => {
      const firstSource = sources[0]

      if (sources.length === 1) {
        return firstSource
      }

      firstSource.content = sources.map((source) => source.content).join('\n')

      return firstSource
    })
  }

  const handleOpenContext = () => {
    if ($activeSpace) {
      dispatch('open-space', $activeSpace.id)
    } else {
      dispatch('open-space', 'all')
    }
  }

  const handleSelectContext = (e: CustomEvent<string>) => {
    log.debug('Selected context', e.detail)

    dispatch('change-context', e.detail)
  }

  const handleSearchEverything = () => {
    dispatch('change-context', 'everything')
  }

  $: processedSources = processSources(sources, collapsed)
</script>

<div class="wrapper similarity-result" class:floating>
  <div class="content">
    <div class="header">
      <button
        use:tooltip={{ text: 'Close Sources', position: 'right' }}
        on:click={() => dispatch('close')}
      >
        <Icon name="close" size="16px" />
      </button>

      <div class="actions">
        {#if collapsed}
          <button
            use:tooltip={{ text: 'Expand Sources', position: 'left' }}
            on:click={() => (collapsed = false)}
          >
            <Icon name="line-height" size="16px" />
          </button>
        {:else}
          <button
            use:tooltip={{ text: 'Summarize Sources', position: 'left' }}
            on:click={() => (collapsed = true)}
          >
            <Icon name="sparkles" size="16px" />
          </button>
        {/if}

        <!-- <ChangeContextBtn
          {spaces}
          {selectedContext}
          {activeSpace}
          on:click={handleOpenContext}
          on:select={handleSelectContext}
        /> -->
      </div>
    </div>

    <!-- <CardSwipeStack items={sources} let:item={source}>
              <SimilarityItem source={source} />
          </CardSwipeStack> -->

    {#if loading}
      <div class="empty">
        <Icon name="spinner" size="16px" />
      </div>
    {:else if processedSources && processedSources.length > 0}
      <div class="list">
        {#each processedSources as source (source.uid + source.resource_id)}
          <SimilarityItem
            {source}
            summarize={collapsed}
            on:insert
            on:highlightWebviewText
            on:seekToTimestamp
          />
        {/each}
      </div>
    {:else}
      <div class="empty">
        <h2>No similar sources found</h2>

        {#if $selectedContext !== 'everything'}
          <button on:click={handleSearchEverything}>Search All my Stuff</button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .wrapper {
    top: 0;
    right: 0;
    border-left: 1px dashed #ddd;
    background: white;
    margin-left: auto;
    height: 100%;
    width: 25rem;

    :global(.dark) & {
      background: #1a1a1a;
      border-left: 1px dashed #333;
    }

    transition: margin 0.2s;

    &.floating {
      position: fixed;
      margin-left: unset;
    }
  }

  .content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    padding-bottom: 7rem;
    width: 100%;
    height: 100%;
    overflow-y: auto;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem;
    border-bottom: 1px dashed #ddd;

    :global(.dark) & {
      border-bottom: 1px dashed #333;
    }

    button {
      background: white;
      border: none;
      padding: 0.25rem;
      border-radius: 8px;
      color: #000000b5;
      transition:
        background 0.2s,
        color 0.2s;

      :global(.dark) & {
        background: #1a1a1a;
        color: #a3a3a3;

        &:hover {
          background: #333;
          color: #ffffff;
        }
      }

      &:hover {
        background: rgba(0, 0, 0, 0.1);
        color: #000000b5;
      }
    }
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    h2 {
      font-size: 1.1rem;
      margin-bottom: 1rem;
    }

    button {
      padding: 0.25rem 0.5rem;
      border: 1px solid #ddd;
      border-radius: 10px;
      background: white;
      color: #000000b5;
      transition:
        background 0.2s,
        color 0.2s;

      :global(.dark) & {
        background: #1a1a1a;
        color: #a3a3a3;

        &:hover {
          background: #333;
          color: #ffffff;
        }
      }

      &:hover {
        background: rgba(0, 0, 0, 0.1);
        color: #000000b5;
      }
    }
  }
</style>
