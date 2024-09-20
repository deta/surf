<script lang="ts">
  import { derived, writable, type Readable } from 'svelte/store'
  import type { Writable } from 'svelte/store'
  import { useLogScope } from '@horizon/utils'
  import Masonry from './MasonrySpace.svelte'
  import OasisResourceLoader from './OasisResourceLoader.svelte'

  export let resourceIds: Readable<string[]>
  export let selected: string | null = null
  export let isInSpace: boolean = false
  export let useMasonry: boolean = true
  export let searchValue: Writable<string> | undefined

  const log = useLogScope('OasisResourcesView')
  // const dispatch = createEventDispatcher<{ click: string }>()

  const CHUNK_SIZE = 40
  const CHUNK_THRESHOLD = 300

  let scrollElement: HTMLDivElement
  let refreshContentLayout: () => void

  const renderLimit = writable(CHUNK_SIZE)

  const renderContents = derived([resourceIds, renderLimit], ([resourceIds, renderLimit]) => {
    return resourceIds.slice(0, renderLimit)
  })

  const handleLoadChunk = (e: CustomEvent) => {
    if ($renderContents.length === 0) {
      renderLimit.set(40)
      return
    }
    if ($resourceIds.length <= $renderContents.length) {
      return
    }
    const CHUNK_SIZE = e.detail
    renderLimit.update((limit) => limit + CHUNK_SIZE)
  }
</script>

<div class="wrapper">
  {#if useMasonry}
    <div bind:this={scrollElement} class="content">
      {#if scrollElement}
        {#key $searchValue === ''}
          <Masonry
            items={$renderContents.map((id) => ({ id, data: null }))}
            isEverythingSpace={false}
            {searchValue}
            on:load-more={handleLoadChunk}
            let:item
            let:renderingDone={handleRenderingDone}
          >
            <OasisResourceLoader
              resourceOrId={item.id}
              {isInSpace}
              on:click
              on:open
              on:remove
              on:load
              on:blacklist-resource
              on:whitelist-resource
              on:rendered={handleRenderingDone}
            />
          </Masonry>
        {/key}
      {/if}
    </div>
  {:else}
    <div class="content flex flex-wrap gap-16 pt-[100px]">
      {#each $renderContents as resourceId (resourceId)}
        <div class="max-w-[420px] w-full">
          <OasisResourceLoader
            resourceOrId={resourceId}
            {isInSpace}
            on:click
            on:open
            on:blacklist-resource
            on:whitelist-resource
            on:remove
            on:load
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  .wrapper {
    height: 100%;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2rem;
    padding-bottom: 0;
  }

  .title {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .content {
    height: 100%;
    overflow: auto;
  }

  .go-back {
    position: absolute;
    top: 2rem;
    left: 2rem;
    z-index: 1000;
  }
</style>
