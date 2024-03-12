<script lang="ts">
  import type { ResourceObject } from '@horizon/core/src/lib/service/resources'

  import ResourcePreview from '@horizon/core/src/lib/components/Resources/ResourcePreview.svelte'
  import ContentMasonry from '../ContentMasonry.svelte'
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'

  export let nearbyResults: any[]

  const dispatch = createEventDispatcher<{ click: any }>()

  let showNearby = false

  const handleNearbyClick = (result: any) => {
    console.log('Nearby result clicked:', result)
    dispatch('click', result)
  }
</script>

<div class="nearby">
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="header" on:click={() => (showNearby = !showNearby)}>
    <div class="title">Nearby ({nearbyResults.length})</div>
    <div class="icon">
      {#if showNearby}
        <Icon name="chevron.left" />
      {:else}
        <Icon name="chevron.right" />
      {/if}
    </div>
  </div>

  {#if showNearby}
    <div class="nearby-results">
      <ContentMasonry items={nearbyResults}>
        {#each nearbyResults as result}
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          <div class="nearby-item" on:click={() => handleNearbyClick(result)}>
            <ResourcePreview resource={result.resource} />
          </div>
        {/each}
      </ContentMasonry>
    </div>
  {/if}
</div>

<style lang="scss">
  .nearby {
    padding: 1rem;
    background: white;
    border-top: 0.5px solid rgba(0, 0, 0, 0.15);
    border-bottom: 0.5px solid rgba(0, 0, 0, 0.15);
    width: 100%;
  }

  .header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    opacity: 0.5;
  }

  .title {
    font-size: 1.1rem;
    font-weight: 500;
    text-align: center;
  }

  .icon {
    transform: rotate(90deg);
  }

  .nearby-results {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .nearby-item {
    cursor: pointer;
  }
</style>
