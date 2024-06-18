<script lang="ts">
  import { derived, writable } from 'svelte/store'

  import { useLogScope } from '../../utils/log'
  import { useOasis } from '../../service/oasis'
  import { Icon } from '@horizon/icons'
  import Chat from '../Browser/Chat.svelte'
  import SearchInput from './SearchInput.svelte'
  import { createEventDispatcher, tick } from 'svelte'
  import { ResourceManager } from '../../service/resources'
  import OasisResourcesView from './OasisResourcesView.svelte'
  import type { SpaceEntry } from '../../types'
  import DropWrapper from './DropWrapper.svelte'
  import {
    MEDIA_TYPES,
    createResourcesFromMediaItems,
    processDrop
  } from '../../service/mediaImporter'

  export let spaceId: string

  $: isEverythingSpace = spaceId === 'all'

  const log = useLogScope('OasisTab')
  const oasis = useOasis()
  const dispatch = createEventDispatcher<{ open: string }>()

  const resourceManager = oasis.resourceManager
  const spaces = oasis.spaces

  const searchValue = writable('')
  const showChat = writable(false)
  const resourceIds = writable<string[]>([])
  const chatPrompt = writable('')
  const searchResults = writable<string[]>([])
  const selectedItem = writable<string | null>(null)

  // const selectedSpace = derived([spaces, selectedSpaceId], ([$spaces, $selectedSpaceId]) => {
  //     return $spaces.find(space => space.id === $selectedSpaceId)
  // })

  const spaceContents = writable<SpaceEntry[]>([])

  const spaceResourceIds = derived(
    [searchValue, spaceContents, searchResults],
    ([searchValue, spaceContents, searchResults]) => {
      const ids = spaceContents.map((x) => x.resource_id)

      if (searchValue) {
        if (isEverythingSpace) {
          return searchResults
        } else {
          return ids.filter((x) => searchResults.includes(x))
        }
      }

      return ids
    }
  )

  $: loadSpaceContents(spaceId)

  const loadSpaceContents = async (id: string) => {
    const items = await oasis.getSpaceContents(id)
    log.debug('Loaded space contents:', items)

    searchValue.set('')
    searchResults.set([])
    spaceContents.set(items)
  }

  const handleChat = async (e: CustomEvent) => {
    const result = e.detail
    chatPrompt.set(result)

    if (!isEverythingSpace) {
      const result = await oasis.getSpaceContents(spaceId)
      console.log('chatting with folder', result)

      resourceIds.set(result.map((r) => r.resource_id))
    } else {
      resourceIds.set([])
    }

    await tick()

    showChat.set(true)
    searchValue.set('')
  }

  const handleCloseChat = () => {
    showChat.set(false)
    searchValue.set('')
    chatPrompt.set('')
    resourceIds.set([])
  }

  const handleSearch = async (e: CustomEvent<string>) => {
    const value = e.detail

    if (!value) {
      searchResults.set([])
      return
    }

    const result = await resourceManager.searchResources(value, [
      ResourceManager.SearchTagDeleted(false)
    ])

    log.debug('searching all', result)

    searchResults.set(result.map((r) => r.resource.id))
  }

  const handleResourceRemove = async (e: CustomEvent<string>) => {
    const resourceId = e.detail
    log.debug('removing resource', resourceId)

    const references = await resourceManager.getAllReferences(resourceId, $spaces)

    let numberOfReferences = 0
    if (isEverythingSpace) {
      numberOfReferences = references.length
    }

    const confirm = window.confirm(
      !isEverythingSpace
        ? `Remove reference? The original will still be in Everything.`
        : numberOfReferences > 0
          ? `This resource will be deleted permanently including all of its ${numberOfReferences} references.`
          : `This resource will be deleted permanently.`
    )

    if (!confirm) {
      return
    }

    const folderContents = await oasis.getSpaceContents(spaceId)

    // DELETING SINGLE ITEM IN FOLDER
    if (!isEverythingSpace) {
      const matchingResource = folderContents.find((r) => r.resource_id === resourceId)
      try {
        if (matchingResource) {
          await resourceManager.deleteSpaceEntries([matchingResource.id])
          await loadSpaceContents(spaceId)
        }

        log.debug('trying to remove reference...', matchingResource)
      } catch (error) {
        log.error('Error removing reference:', error)
      }
    }

    // DELETING ALL ITEMS AND ITS REFERENCES
    if (isEverythingSpace) {
      for (const resource of references) {
        log.debug('references', references)
        try {
          await resourceManager.deleteSpaceEntries([resource.entryId])
        } catch (error) {
          log.error('Error removing reference:', error)
        }
      }

      try {
        await resourceManager.deleteResource(resourceId)
        await loadSpaceContents(spaceId)
        log.debug('Resource deleted')
      } catch (error) {
        log.error('Error deleting resource:', error)
      }
    }
  }

  const handleItemClick = (e: CustomEvent<string>) => {
    log.debug('Item clicked:', e.detail)
    selectedItem.set(e.detail)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    log.debug('Key down:', e.key)
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCloseChat()
    } else if (e.key === ' ') {
      e.preventDefault()
      if ($selectedItem) {
        dispatch('open', $selectedItem)
      }
    }
  }

  const handleDrop = async (e: CustomEvent<DragEvent>) => {
    const event = e.detail
    log.debug('Dropped', event)

    const isOwnDrop = event.dataTransfer?.types.includes(MEDIA_TYPES.RESOURCE)
    if (isOwnDrop) {
      log.debug('Own drop detected, ignoring...')
      log.debug(event.dataTransfer?.files)
      return
    }

    const parsed = await processDrop(event)
    log.debug('Parsed', parsed)

    const resources = await createResourcesFromMediaItems(resourceManager, parsed, '')
    log.debug('Resources', resources)

    await loadSpaceContents(spaceId)
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<DropWrapper on:drop={handleDrop}>
  <div class="wrapper">
    <div class="drawer-bar">
      <div class="drawer-chat-search">
        <div class="search-input-wrapper">
          <SearchInput bind:value={$searchValue} on:chat={handleChat} on:search={handleSearch} />
        </div>

        <div class="drawer-chat active">
          <button class="close-button" on:click={handleCloseChat}>
            <Icon name="close" size="15px" />
          </button>
        </div>
      </div>
      <!-- <ProgressiveBlur /> -->
    </div>

    {#if $showChat}
      <div class="chat-wrapper">
        <button class="close-button" on:click={handleCloseChat}>
          <Icon name="close" size="15px" />
        </button>

        <Chat
          tab={{
            type: 'chat',
            query: $chatPrompt
          }}
          {resourceManager}
          resourceIds={!isEverythingSpace ? $resourceIds : []}
          on:navigate={(e) => {}}
          on:updateTab={(e) => {}}
        />
      </div>
    {/if}

    <OasisResourcesView
      resourceIds={spaceResourceIds}
      selected={$selectedItem}
      on:click={handleItemClick}
      on:open
      on:remove={handleResourceRemove}
    />
  </div>
</DropWrapper>

<style lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    overflow: hidden;
    background: #f8f7f2;
    border-radius: 12px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  }

  .tabs {
    display: flex;
    gap: 1rem;
  }

  button {
    padding: 0.5rem;
    border: none;
    background: none;
    cursor: pointer;
  }

  button:hover {
    background: #f0f0f0;
  }

  .search-input-wrapper {
    position: relative;
    z-index: 10;
    width: 100%;
    height: 3.3rem;
    max-width: 32rem;
    view-transition-name: search-transition;
    &.active {
      height: auto;
      width: 100%;
    }
  }

  .drawer-bar {
    position: relative;
    top: 0;
    left: 0;
    right: 0;
    backdrop-filter: blur(3px);
    z-index: 1000;
    border-top: 0.5px solid rgba(0, 0, 0, 0.15);
    &:after {
      filter: opacity(1);
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
    }

    .drawer-chat-search {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      gap: 16px;
      padding: 1rem 1rem 1rem 1rem;
      transition: all 240ms ease-out;
      .drawer-chat {
        position: relative;
        z-index: 10;
        top: 0;

        .chat-input-wrapper {
          position: fixed;
          top: 0;
          left: 0;
        }

        .close-button {
          position: relative;
          display: none;
          top: -1rem;
          right: -3.5rem;
          justify-content: center;
          align-items: center;
          width: 2rem;
          height: 2rem;
          flex-shrink: 0;
          border-radius: 50%;
          border: 0.5px solid rgba(0, 0, 0, 0.15);
          transition: 60ms ease-out;
          background: white;
          z-index: 100;
          &:hover {
            outline: 3px solid rgba(0, 0, 0, 0.15);
          }
        }
      }

      .search-transition {
        position: relative;
      }
    }
  }

  .search-debug {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    padding-bottom: 1.5rem;
    padding-top: 0.25rem;
    background: rgba(255, 255, 255, 0.33);

    input {
      background: none;
      padding: 0.5rem;
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, 0.15);
      font-size: 1rem;
      font-weight: 500;
      letter-spacing: 0.02rem;
      width: 75px;
      text-align: center;
    }
  }

  .chat-wrapper {
    position: absolute;
    top: 1rem;
    left: 50%;
    right: 50%;
    z-index: 100000;
    width: 100%;
    height: 100%;
    max-width: 50vw;
    max-height: 70vh;
    overflow-y: scroll;
    border-radius: 16px;
    transform: translateX(-50%);
    background: white;
    box-shadow:
      0px 0px 0px 1px rgba(0, 0, 0, 0.2),
      0px 16.479px 41.197px 0px rgba(0, 0, 0, 0.46);

    .close-button {
      position: fixed;
      top: 0.5rem;
      left: 0.5rem;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
      border-radius: 50%;
      border: 0.5px solid rgba(0, 0, 0, 0.15);
      transition: 60ms ease-out;
      background: white;
      z-index: 10000;
      &.rotated {
        transform: rotate(-45deg);
      }
      &:hover {
        outline: 3px solid rgba(0, 0, 0, 0.15);
      }
    }
  }
</style>
