<script lang="ts">
  import { createEventDispatcher, getContext, onMount, tick } from 'svelte'
  import type { Horizon, HorizonsManager } from '../../service/horizon'
  import type { ResourceObject } from '../../service/resources'
  import { useLogScope } from '../../utils/log'
  import { generateRootDomain } from '../../utils/url'
  import { formatDistanceToNow, parseISO } from 'date-fns'
  import type { Card } from '../../types'

  import Link from '../Atoms/Link.svelte'

  const log = useLogScope('DrawerDetailsWrapper')

  export let draggable = true
  export let resource: ResourceObject
  export let horizon: Horizon

  const resourceManager = horizon.resourceManager

  const horizonManager = getContext<HorizonsManager>('horizonsManager')

  let userContext = resource.metadata?.userContext

  type CardHorizon = { id: string; horizon: Horizon }

  // TODO: Move this component to the core package and import the ResourceSearchResultItem type
  let nearbyResults: any[] = []
  let cards: Card[] = []
  let cardHorizons: CardHorizon[] = []

  const handleKeyDown = () => {
    resourceManager.updateResourceMetadata(resource.id, { userContext })
  }

  const handleNearbySearch = async () => {
    const results = await resourceManager.searchForNearbyResources(resource.id, 500000, 5)
    log.debug('Nearby search results:', results)
    nearbyResults = results
  }

  const handleCardClick = async (item: CardHorizon) => {
    // TODO: handle navigation to different horizons
    if (horizon.id !== item.horizon.id) {
      return
      log.debug('switching horizon')
      // TODO: this is quite buggy right now
      await horizonManager.switchHorizon(item.horizon.id)
      await tick()
    }

    log.debug('scrolling to card center')
    await item.horizon.scrollToCardCenter(item.id)

    log.debug('selected card scrolled to center')
  }

  const fetchData = async (resource: ResourceObject) => {
    handleNearbySearch()

    cards = await horizon.getCardsByResourceId(resource.id)

    const cardsWithUniqueHorizon = cards.reduce((acc, card) => {
      if (!acc.find((c) => c.id === card.id)) {
        acc.push(card)
      }
      return acc
    }, [] as Card[])

    cardHorizons = await Promise.all(
      cardsWithUniqueHorizon.map(async (card) => {
        const horizon = await horizonManager.getHorizon(card.horizonId)

        return { id: card.id, horizon }
      })
    )
  }

  function formatRelativeDate(dateIsoString) {
    return formatDistanceToNow(parseISO(dateIsoString), { addSuffix: true })
  }

  $: fetchData(resource)
</script>

<!-- svelte-ignore missing-declaration a11y-no-static-element-interactions -->
<div class="details-item">
  <div {draggable} on:dragstart class="details-preview">
    <slot />
  </div>
  <div class="textarea-wrapper">
    <textarea
      id="modernTextarea"
      placeholder="Add Context..."
      bind:value={userContext}
      on:keyup={handleKeyDown}
    ></textarea>
  </div>

  <div class="references-wrapper">
    {#if cardHorizons.length > 0}
      <div class="header">
        <div class="title">This card is placed on</div>
      </div>
      <div class="cards-wrapper">
        {#each cardHorizons as item (item.id)}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div class="card" on:click={() => handleCardClick(item)}>
            {item.horizon.data.name}
          </div>
        {/each}
      </div>
    {:else}
      <div>Not placed on any Horizon</div>
    {/if}
  </div>

  <div class="metadata-wrapper">
    <div class="metadata">
      {#if resource.metadata?.sourceURI}
        <div class="source-button">
          <Link url={resource.metadata?.sourceURI} label={'Go to Source'} locked={true} />
        </div>
      {/if}

      <div class="metadata-text">
        <span>Updated {formatRelativeDate(resource.updatedAt)}</span>
        <span>Created {formatRelativeDate(resource.createdAt)}</span>
      </div>
    </div>
  </div>

  <slot name="proximity-view" result={nearbyResults} />
</div>

<style lang="scss">
  .details-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rem;
    width: 100%;
    max-height: 42rem;
    height: min-content;
    .details-preview {
      padding: 2rem;
      max-width: 30rem;
    }
  }

  :global(.details-preview img) {
    max-height: 40rem;
  }

  .textarea-wrapper,
  .metadata-wrapper,
  .references-wrapper {
    position: relative;
    padding: 1rem 4rem;
    left: 0;
    right: 0;
    display: flex;
    width: 100%;
    justify-content: center;
    background: white;
    border-top: 0.5px solid rgba(0, 0, 0, 0.15);
    border-bottom: 0.5px solid rgba(0, 0, 0, 0.15);
  }

  textarea {
    width: 100%;
    max-width: 28rem;
    height: 150px;
    padding: 10px;
    border-radius: 8px;
    outline: none;
    resize: vertical;
    font-family: inherit;
    font-size: 1.25rem;
    font-weight: 500;
    letter-spacing: 0.02rem;
    border: 0;
    resize: none;
  }

  .metadata-wrapper {
    padding: 2rem 0;
    .metadata {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      width: 100%;
      max-width: 28rem;
      font-family: inherit;
      font-size: 1.25rem;
      font-weight: 500;
      .source-button {
        display: flex;
        padding: 0.5rem;
        justify-content: center;
        align-items: center;
        width: fit-content;
        border-radius: 6px;
        border: 0.5px solid rgba(0, 0, 0, 0.2);
        transition: 60ms ease-out;
        &:hover {
          outline: 3px solid rgba(0, 0, 0, 0.15);
        }
      }
      .metadata-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        font-family: inherit;
        font-size: 1rem;
        font-weight: 400;
        opacity: 0.6;
        letter-spacing: 0.02rem;
      }
    }
  }

  .references-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    .header {
      padding-top: 1rem;
      .title {
        font-family: inherit;
        font-size: 1rem;
        font-weight: 400;
        opacity: 0.6;
      }
    }
  }

  .cards-wrapper {
    padding: 2rem;
    display: flex;
    gap: 1rem;
    .card {
      padding: 1rem;
      background: white;
      border: 0.5px solid rgba(0, 0, 0, 0.15);
      border-radius: 8px;
      font-family: inherit;
      font-size: 1.25rem;
      font-weight: 500;
      cursor: pointer;
      transition: 60ms ease-out;
      &:hover {
        outline: 3px solid rgba(0, 0, 0, 0.15);
      }
    }
  }
</style>
