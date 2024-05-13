<script lang="ts">
  import { writable, type Unsubscriber } from 'svelte/store'
  import { createEventDispatcher, onMount } from 'svelte'
  import { fly } from 'svelte/transition'
  import emblaCarouselSvelte from 'embla-carousel-svelte'
  import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'

  import { Icon } from '@horizon/icons'

  import Create from './Create.svelte'
  import { SERVICES } from '@horizon/web-parser'
  import type { HistoryEntriesManager, SearchHistoryEntry } from '../../service/history'
  import browserBackground from '../../../../public/assets/browser-background.png'
  import AddressToolbar, {
    type ActionEvent
  } from '../Cards/Browser/modules/toolbar/AddressToolbar.svelte'
  import {
    checkIfUrl,
    parseStringIntoBrowserLocation,
    parseStringIntoUrl,
    prependProtocol
  } from '../../utils/url'
  import log from '../../utils/log'

  export let historyEntriesManager: HistoryEntriesManager

  const dispatch = createEventDispatcher<{ navigate: string; chat: string }>()

  const sites = writable<SearchHistoryEntry[]>([])
  const currentCardHistory = writable([])
  const deactivateToolbar = writable(false)

  let value: string = ''
  let editing = false
  let inputEl: HTMLInputElement

  $: iterableSites = $sites || []

  $: if (inputEl) {
    log.debug('inputEl', inputEl)
    setTimeout(() => {
      inputEl.focus()
    }, 200)
  }

  const AVAILABLE_SERVICES = SERVICES.filter((e) => e.showBrowserAction === true)

  async function updateSites() {
    const historyEntries = historyEntriesManager.searchEntries('')

    // Get today's date at midnight to compare with entry timestamps
    // const today = new Date()
    // today.setHours(0, 0, 0, 0)

    // // Filter entries visited today based on createdAt or updatedAt
    // const visitedToday = historyEntries.filter((item) => {
    //   const entryDate = new Date(item.entry.createdAt)
    //   return entryDate >= today
    // })

    // Sort entries by latest first based on createdAt or updatedAt
    const sortedEntries = historyEntries.sort((a, b) => {
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
    // webview?.navigate(url)
    dispatch('navigate', url)
    showBrowserHomescreen = false
  }

  function handleNext() {
    emblaApi.scrollNext()
  }

  function handlePrevious() {
    emblaApi.scrollPrev()
  }

  const handleAddressToolbarAction = (e: CustomEvent<ActionEvent>) => {
    const { type, value } = e.detail
    if (type === 'navigation') {
      const url = parseStringIntoBrowserLocation(value)
      if (!url) return

      dispatch('navigate', url)
      inputEl.blur()
    } else if (type === 'chat') {
      dispatch('chat', value)
      inputEl.blur()
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      goToURL()
    }
  }

  function goToURL() {
    const url = parseStringIntoUrl(value)
    if (!url) return

    dispatch('navigate', url.href)
    inputEl.blur()
  }

  let unsubscribeHistoryEntries: Unsubscriber

  // $: if (showBrowserHomescreen && inputEl) {
  //   editing = true
  //   inputEl.focus()
  // }

  onMount(() => {
    updateSites()

    // setTimeout(() => {
    //   editing = true
    //   inputEl?.focus()
    // }, 2000)

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
  <img class="browser-background" src={browserBackground} alt="background" />
  <div
    class="browser-homescreen"
    in:fly={{ y: 10, duration: 160 }}
    out:fly={{ y: 10, duration: 160 }}
  >
    <div class="homescreen-content">
      <div
        class="address-bar-wrapper isActive"
        class:isEditing={editing}
        in:fly={{ x: -10, duration: 160 }}
        out:fly={{ x: -10, duration: 60 }}
      >
        {#if editing && value !== ''}
          <div
            class="address-bar-toolbar"
            class:isEditing={editing}
            class:deactivated={$deactivateToolbar}
            in:fly={{ y: 4, duration: 180, delay: 120 }}
            out:fly={{ y: 10, duration: 60 }}
          >
            <AddressToolbar
              bind:inputValue={value}
              cardHistory={$currentCardHistory}
              {historyEntriesManager}
              on:action={handleAddressToolbarAction}
            />
          </div>
        {/if}
        <div class="address-bar" draggable="true">
          <Icon name="sparkles" />
          <input
            on:focus={() => (editing = true)}
            on:blur={() => {
              // hide toolbar until the callback performing the action is completed
              deactivateToolbar.set(true)
              setTimeout(() => {
                editing = false
                deactivateToolbar.set(false)
              }, 100)
            }}
            type="text"
            class="isActive"
            placeholder="Enter a URL, search the web or ask Oasis AI"
            bind:this={inputEl}
            bind:value
            on:keyup={handleKeyUp}
          />
        </div>
        <div class="address-tip">
          <p>Hit <span>↩</span> to open a site or <span>⌘ + ↩</span> to ask Oasis AI</p>
        </div>
        <!-- <div class="page-title">{$title}</div> -->
      </div>

      <div class="section">
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
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <!-- svelte-ignore a11y-click-events-have-key-events -->
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
      </div>

      <div class="section">
        {#if $sites.length > 0}
          <h2 class="subheadline">History</h2>
        {/if}
        <div class="popular-sites">
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          {#each $sites.slice(0, 6) as site}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
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
  </div>
{/if}

<style lang="scss">
  .browser-background {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
  }

  .browser-homescreen {
    position: absolute;
    bottom: 0;
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
      display: flex;
      flex-direction: column;
      gap: 2rem;
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

  .navbar-wrapper {
    position: relative;
    display: flex;
    gap: 0.75rem;
    width: 100%;
  }

  .address-bar-wrapper {
    position: relative;
    top: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    /* padding: 0 10% 0 calc(10% + 1.5rem); */
  }

  .address-tip {
    width: 100%;
    margin-top: 1rem;
    color: rgba(0, 0, 0, 0.6);
    font-size: 0.85rem;
    text-align: center;

    p span {
      font-weight: 500;
      background: rgba(255, 255, 255, 0.3);
      padding: 0.1rem 0.25rem;
      border-radius: 4px;
    }
  }

  .address-bar {
    position: relative;
    display: inline-block;
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    background: #ffffff;
    color: #212121;
    letter-spacing: 0.02rem;
    outline-offset: -2px;
    outline-style: hidden;
    transition:
      background 120ms ease-in,
      outline-offset 200ms cubic-bezier(0.33, 1, 0.68, 1);

    input {
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
      font-size: 0.95rem;
      color: #212121;
      outline: none;
    }
  }

  .address-bar:focus {
    background: #fbeaf2;
    outline: 2px solid #e173a8;
    color: #000000;
    text-align: left;
    outline-offset: 2px;
    /* -webkit-mask-image: linear-gradient(to right, #000 95%, transparent 100%); */
  }

  .address-bar:hover {
    background: radial-gradient(115% 115% at 50% 100%, #ffd3f0 0%, #ffdff4 100%);
  }

  .address-bar-toolbar {
    position: absolute;
    z-index: 100;
    top: 4rem;
    height: auto;
    width: 100%;
    background: rgba(255, 255, 255, 0.98);
    border: 0.5px solid rgba(0, 0, 0, 0.12);
    box-shadow:
      0px 3px 4px 0px rgba(0, 0, 0, 0.13),
      0px 1px 2px 0px rgba(0, 0, 0, 0.1),
      0px 0px 0.5px 0px rgba(0, 0, 0, 0.12),
      0px 1px 3px 0px rgba(0, 0, 0, 0.2),
      0px 0px 1px 4px rgba(0, 0, 0, 0.01);
    outline: 2px solid white;
    border-radius: 8px;
    &.deactivated {
      opacity: 0;
    }
  }
</style>
