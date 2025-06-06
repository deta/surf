<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { derived, type Writable } from 'svelte/store'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'

  export let spaces: Writable<OasisSpace[]>
  export let infoText: string | undefined = undefined

  let selectedSpaceIndex = 0

  const dispatch = createEventDispatcher<{ 'save-resource-in-space': OasisSpace }>()

  const filteredSpaces = derived([spaces], ([spaces]) => {
    return spaces.filter(
      (space) =>
        space.id !== 'all' &&
        space.id !== 'inbox' &&
        space.dataValue.folderName !== '.tempspace' &&
        !space.dataValue.builtIn
    )
  })

  const handleClick = (index: number) => {
    selectedSpaceIndex = index
    console.log('Dispatching custom event from handleClick')
    dispatch('save-resource-in-space', $filteredSpaces[selectedSpaceIndex])
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="shortcut-wrapper">
  {#if infoText}
    <span class="info">{infoText}</span>
  {/if}

  {#if $filteredSpaces && $filteredSpaces.length > 0}
    {#each $filteredSpaces as space, index}
      <span class="label" on:click={() => handleClick(index)} role="none"
        >{space.dataValue.folderName}</span
      >
    {/each}
  {:else}
    <span>No spaces available</span>
  {/if}
</div>

<style lang="scss">
  .shortcut-wrapper {
    display: flex;
    overflow-y: auto;
    flex-direction: column;
    width: 19rem;
    max-height: 30rem;
    .label {
      display: flex;
      align-items: center;
      padding: 1rem 0.75rem 1rem 1rem;
      border-radius: 12px;

      gap: 10px;
      position: relative;
      color: #3c371f;
      font-weight: 500;
      letter-spacing: 0.0025em;
      font-smooth: always;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      :global(.dark) & {
        color: #d1d1c2;
      }

      &:hover {
        background-color: #e0e0d1;

        :global(.dark) & {
          background-color: #374151;
        }
      }

      & * {
        user-select: none;
      }
    }
  }

  span {
    padding: 8px;
    font-size: 1.1rem;
    text-align: left;
  }

  .info {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    font-weight: 500;
    text-align: left;
    color: #7d7653;
    // border-bottom: 1px solid #e0e0d1;

    :global(.dark) & {
      color: #d1d1c2;
    }
  }
</style>
