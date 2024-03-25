<script lang="ts">
  import { writable, type Unsubscriber } from 'svelte/store'
  import { onMount } from 'svelte'
  import { fly } from 'svelte/transition'
  import emblaCarouselSvelte from 'embla-carousel-svelte'
  import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'

  import { Icon } from '@horizon/icons'

  import Create from './Create.svelte'
  import { SERVICES } from '@horizon/web-parser'
  import type { Horizon } from '../../../../../service/horizon'
  import WebviewWrapper from '../../WebviewWrapper.svelte'
  import type { HistoryEntriesManager, SearchHistoryEntry } from '../../../../../service/history'

  export let webview: WebviewWrapper
  export let horizon: Horizon

  const historyEntriesManager = horizon.historyEntriesManager as HistoryEntriesManager

  let sites = writable<SearchHistoryEntry[]>([])

  $: iterableSites = $sites || []

  const AVAILABLE_SERVICES = SERVICES.filter((e) => e.showBrowserAction === true)

  async function updateSites() {
    const historyEntries = historyEntriesManager.searchEntries('')

    // Get today's date at midnight to compare with entry timestamps
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Filter entries visited today based on createdAt or updatedAt
    const visitedToday = historyEntries.filter((item) => {
      const entryDate = new Date(item.entry.createdAt)
      return entryDate >= today
    })

    // Sort entries by latest first based on createdAt or updatedAt
    const sortedEntries = visitedToday.sort((a, b) => {
      return new Date(b.entry.createdAt).getTime() - new Date(a.entry.createdAt).getTime()
    })

    // Assuming you want to keep unique sites with the latest visit
    const uniqueSitesWithLatestVisit = sortedEntries.reduce(
      (acc, currentEntry) => {
        if (!acc[currentEntry.site]) {
          acc[currentEntry.site] = currentEntry
        }
        return acc
      },
      {} as Record<string, SearchHistoryEntry>
    )

    sites.set(Object.values(uniqueSitesWithLatestVisit))
  }

  let embla: HTMLElement

  let showBrowserHomescreen: boolean = true

  let emblaCanScrollLeft = writable(false)
  let emblaCanScrollRight = writable(true)

  let emblaApi: any
  let options = { loop: false, dragFree: true }
  let plugins = [WheelGesturesPlugin({ forceWheelAxis: 'x' })]

  function onInit(event: any) {
    emblaApi = event.detail
    emblaApi.slideNodes()
    emblaApi.on('scroll', isScrolled)
  }

  function isScrolled(e: any) {
    emblaCanScrollLeft.set(e.canScrollPrev())
    emblaCanScrollRight.set(e.canScrollNext())
  }

  function handleClick(url: string) {
    webview?.navigate(url)
    showBrowserHomescreen = false
  }

  function handleNext() {
    emblaApi.scrollNext()
  }

  function handlePrevious() {
    emblaApi.scrollPrev()
  }

  let unsubscribeHistoryEntries: Unsubscriber

  onMount(() => {
    updateSites()

    // Delay the subscription to avoid unnecessary updates
    const timeout = setTimeout(() => {
      unsubscribeHistoryEntries = historyEntriesManager.entries.subscribe(() => {
        updateSites()
      })
    }, 500)

    return () => {
      if (timeout) clearTimeout(timeout)
      if (unsubscribeHistoryEntries) unsubscribeHistoryEntries()
    }
  })
</script>

{#if showBrowserHomescreen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="browser-homescreen"
    in:fly={{ y: 10, duration: 160 }}
    out:fly={{ y: 10, duration: 160 }}
  >
    <div class="homescreen-content">
      <h2 class="subheadline">Create</h2>
      <div class="embla-wrapper">
        <div
          class="embla"
          use:emblaCarouselSvelte={{ options }}
          on:emblaInit={onInit}
          class:scrolled={$emblaCanScrollLeft}
          bind:this={embla}
        >
          <div class="embla__container">
            {#each AVAILABLE_SERVICES as item, i (i)}
              <div
                class="create-trigger"
                on:click|preventDefault={() => handleClick(item.browserActionUrl)}
              >
                <Create service={item.id} index={i} />
              </div>
            {/each}
          </div>
        </div>
        {#if $emblaCanScrollLeft}
          <button
            class="embla__prev"
            on:click={handlePrevious}
            in:fly={{ x: 10, duration: 160 }}
            out:fly={{ x: 10, duration: 160 }}
          >
            <Icon name="chevron.left" color="red" />
          </button>
        {/if}
        {#if $emblaCanScrollRight}
          <button
            class="embla__next"
            on:click={handleNext}
            in:fly={{ x: -10, duration: 160 }}
            out:fly={{ x: -10, duration: 160 }}
          >
            <Icon name="chevron.right" />
          </button>
        {/if}
      </div>

      {#if $sites.length > 0}
        <h2 class="subheadline">History</h2>
      {/if}
      <div class="popular-sites">
        {#each $sites.slice(0, 6) as site}
          <div class="site" on:click|preventDefault={() => handleClick(site.entry.url ?? '')}>
            <img
              class="site-favicon"
              src={`https://www.google.com/s2/favicons?domain=${site.entry.url}&sz=128`}
              alt="favicon"
            />
            <div class="site-title">{site.entry.title}</div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .browser-homescreen {
    position: absolute;
    bottom: 3rem;
    z-index: 0;
    width: 100%;
    height: auto;
    border-top: 0.5px solid rgba(255, 255, 255, 0.4);
    background: linear-gradient(0deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.3) 100%),
      linear-gradient(
        0deg,
        rgba(210, 210, 210, 0.18) 0%,
        rgba(172, 172, 172, 0.18) 48.96%,
        rgba(193, 108, 164, 0.18) 100%
      ),
      linear-gradient(180deg, rgba(255, 255, 255, 0.6) 75.4%, rgba(255, 255, 255, 0) 99.85%);

    backdrop-filter: blur(12px);

    .homescreen-content {
      margin: 0 auto;
      max-width: 50rem;
      padding: 2rem 2rem 4rem 2rem;

      h2.subheadline {
        font-size: 1.25rem;
        font-weight: 500;
        opacity: 0.6;
        padding: 1.5rem 0 0.75rem 0;
      }

      .create-wrapper {
        display: flex;
        gap: 1rem;
      }

      .popular-sites {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: repeat(2, 1fr);
        grid-column-gap: 1rem;
        grid-row-gap: 1rem;

        .site {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.5rem;
          border-radius: 12px;
          width: 100%;
          overflow: auto;
          cursor: pointer;
          &:hover {
            background: rgba(0, 0, 0, 0.05);
          }
          .site-favicon {
            max-width: 32px;
            max-height: 32px;
            border-radius: 4px;
          }

          .site-title {
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: pre;
            opacity: 0.5;
          }
        }
      }
    }
  }

  .embla-wrapper {
    position: relative;
  }

  .embla {
    overflow: hidden;
    -webkit-mask-image: linear-gradient(to right, #000 98%, transparent 100%);
    &.scrolled {
      -webkit-mask-image: linear-gradient(to right, transparent, #000 2%, #000 98%, transparent);
    }
  }
  .embla__container {
    display: flex;
  }

  .embla__prev,
  .embla__next {
    top: 40%;
    background: transparent;
    border: 0;
    cursor: pointer;
    pointer-events: all;
    transform: translateY(-50%);
  }

  .embla__prev {
    position: absolute;
    left: -1.25rem;
  }

  .embla__next {
    position: absolute;
    right: -1.25rem;
  }

  @container browsercard (max-height: 350px) {
    .browser-homescreen {
      display: none;
    }
  }

  @container browsercard (max-height: 500px) {
    .browser-homescreen {
      padding-top: 2rem;
      height: 100%;
      .homescreen-content {
        .popular-sites {
          .site:nth-last-child(3),
          .site:nth-last-child(2),
          .site:nth-last-child(1) {
            display: none;
          }
        }
      }
    }
  }
</style>
