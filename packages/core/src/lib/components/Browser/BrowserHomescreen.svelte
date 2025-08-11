<script lang="ts" context="module">
  export const oasisAPIEndpoint = writable('')
</script>

<script lang="ts">
  import { writable, type Unsubscriber, derived } from 'svelte/store'
  import { createEventDispatcher, onMount } from 'svelte'
  import type { Writable } from 'svelte/store'
  import { fly } from 'svelte/transition'

  import { Icon } from '@horizon/icons'
  import SpacesView, { type CreateSpaceTabEvent } from '../Oasis/Scaffolding/SpacesView.svelte'

  import type { HistoryEntriesManager, SearchHistoryEntry } from '../../service/history'
  import browserBackground from '../../../../public/assets/foggy-placeholder.png'
  import AddressToolbar, { type ActionEvent } from '../Atoms/Toolbar/AddressToolbar.svelte'
  import type { TabSpace } from '../../types/browser.types'
  import { parseStringIntoBrowserLocation, parseStringIntoUrl, useLogScope } from '@deta/utils'
  import OasisResourceModalWrapper from '../Oasis/OasisResourceModalWrapper.svelte'
  import { useResourceManager } from '../../service/resources'
  import { OpenResourceEventFrom } from '@deta/types'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'

  export let historyEntriesManager: HistoryEntriesManager
  export let spaces: Writable<OasisSpace[]>
  export let active = true

  const log = useLogScope('BrowserHomescreen')
  const dispatch = createEventDispatcher<{
    navigate: string
    chat: string
    rag: string
    'create-tab-from-space': TabSpace
  }>()
  const resourceManager = useResourceManager()

  const sites = writable<SearchHistoryEntry[]>([])
  const currentCardHistory = writable([])
  const deactivateToolbar = writable(false)
  const showAllSpaces = writable(false)
  const showResourceDetails = writable(false)
  const resourceDetailsModalSelected = writable<string | null>(null)

  let value: string = ''
  let editing = false
  let inputEl: HTMLInputElement

  $: if (inputEl) {
    log.debug('inputEl', inputEl)
    setTimeout(() => {
      focusInput()
    }, 200)
  }

  const focusInput = () => {
    inputEl.focus()
  }

  const isResourceDetailsModalOpen = derived(
    [showResourceDetails, resourceDetailsModalSelected],
    ([$showResourceDetails, $resourceDetailsModalSelected]) => {
      return $showResourceDetails && !!$resourceDetailsModalSelected
    }
  )

  const openResourceDetailsModal = (resourceId: string) => {
    resourceDetailsModalSelected.set(resourceId)
    showResourceDetails.set(true)

    resourceManager.getResource(resourceId, { includeAnnotations: false }).then((resource) => {
      if (resource) {
        resourceManager.telemetry.trackOpenResource(resource.type, OpenResourceEventFrom.NewTab)
      }
    })
  }

  const closeResourceDetailsModal = () => {
    showResourceDetails.set(false)
    resourceDetailsModalSelected.set(null)
  }

  async function updateSites() {
    const historyEntries = historyEntriesManager.searchEntries('')

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

  let showBrowserHomescreen: boolean = true

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
    } else if (type === 'rag') {
      dispatch('rag', value)
      inputEl.blur()
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      goToURL()
    }
  }

  const handleCreateTabFromOasisSidebar = (e: CustomEvent<CreateSpaceTabEvent>) => {
    dispatch('create-tab-from-space', e.detail.tab)
  }

  function goToURL() {
    const url = parseStringIntoUrl(value)
    if (!url) return

    dispatch('navigate', url.href)
    inputEl.blur()
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

  $: {
    if (inputEl) {
      if (active === true) {
        inputEl.focus()
      } else inputEl.blur()
    }
  }
</script>

{#if $isResourceDetailsModalOpen && $resourceDetailsModalSelected}
  <OasisResourceModalWrapper
    resourceId={$resourceDetailsModalSelected}
    {active}
    on:close={() => closeResourceDetailsModal()}
  />
{/if}

{#if showBrowserHomescreen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="browser-homescreen"
    in:fly={{ y: 25, duration: 160 }}
    out:fly={{ y: 25, duration: 160 }}
  >
    {#if !$showAllSpaces}
      <div class="homescreen-content">
        <img class="browser-background" src={browserBackground} alt="background" />
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
              placeholder="Enter a URL, search the web or ask Your Stuff"
              bind:this={inputEl}
              bind:value
              on:keyup={handleKeyUp}
            />
          </div>
          <div class="address-tip">
            <p>Hit <span>↩</span> to open a site or <span>⌘ + ↩</span> to ask Your Stuff</p>
          </div>
          <!-- <div class="page-title">{$title}</div> -->
        </div>
      </div>
    {:else}
      <SpacesView
        onBack={() => showAllSpaces.set(false)}
        {resourceManager}
        on:createTab={handleCreateTabFromOasisSidebar}
        on:open-resource={(e) => openResourceDetailsModal(e.detail)}
        {spaces}
      />
    {/if}
  </div>
{/if}

<style lang="scss">
  .browser-background {
    position: relative;
    width: 40rem;
    height: 40rem;
    object-fit: cover;
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

  .isActive {
    pointer-events: auto;
  }
</style>
