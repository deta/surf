<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { type Readable } from 'svelte/store'
  import { useLogScope } from '@horizon/utils'
  import type { OasisSpace } from '../../../service/oasis'
  import { useToasts } from '../../../service/toast'
  import SpaceIcon from '../../Atoms/SpaceIcon.svelte'
  import { useConfig } from '../../../service/config'

  export let spaces: Readable<OasisSpace[]>
  export let open = false
  export let selectAll = false
  export let allowCancel = true

  const config = useConfig()
  const log = useLogScope('BrowsingContextSelector')
  const toatst = useToasts()
  const dispatch = createEventDispatcher<{
    close: { selectedSpaces: string[] }
    cancel: void
  }>()

  let sortedSpaces: OasisSpace[] = []
  let selectedSpaceIds: string[] = []
  let searchFilter = ''
  let horizontalMode = config.getSettings().tabs_orientation === 'horizontal'

  spaces.subscribe((spaces) => {
    sortedSpaces = spaces.sort((a, b) => {
      const aName = a.dataValue?.folderName || ''
      const bName = b.dataValue?.folderName || ''
      return aName.localeCompare(bName)
    })
    selectedSpaceIds = spaces
      .filter((space) => space.dataValue?.useAsBrowsingContext === true)
      .map((space) => space.id)
  })

  $: filteredSpaces = sortedSpaces.filter((space) => {
    const folderName = space.dataValue?.folderName || ''
    const matchesFilter = folderName.toLowerCase().includes(searchFilter.toLowerCase())
    const isSelected = selectedSpaceIds.includes(space.id)

    return matchesFilter || isSelected
  })

  function toggleSpace(spaceId: string) {
    if (selectedSpaceIds.includes(spaceId)) {
      selectedSpaceIds = selectedSpaceIds.filter((id) => id !== spaceId)
    } else {
      selectedSpaceIds = [...selectedSpaceIds, spaceId]
    }
  }

  function toggleSelectAll() {
    if (selectAll) {
      selectedSpaceIds = []
      selectAll = false
    } else {
      selectedSpaceIds = $spaces.map((space) => space.id)
      selectAll = true
    }
  }

  function handleSave() {
    log.debug('Saving browsing context selections', selectedSpaceIds)
    if (selectedSpaceIds.length === 0) {
      toatst.error('Please select at least one browsing context')
      return
    }
    dispatch('close', { selectedSpaces: selectedSpaceIds })
  }

  function handleCancel() {
    log.debug('Cancelling browsing context selection')
    dispatch('cancel')
  }

  function clearSearch() {
    searchFilter = ''
  }

  $: {
    log.debug('selectedSpaceIds', selectedSpaceIds)
  }
</script>

{#if open}
  <div class="modal-overlay" class:horizontal-mode={horizontalMode}>
    <div class="browsing-context-selector">
      <!-- Debug info -->
      {#if $spaces.length === 0}
        <div class="debug-info">
          <h3>No contexts available to display</h3>
          <p>This could be because:</p>
          <ul>
            <li>No contexts with nesting data were found</li>
            <li>The contexts store wasn't properly updated</li>
            <li>There was an error loading the contexts</li>
          </ul>
        </div>
      {/if}
      <div class="dialog-content">
        <div class="header">
          <h2>Select Browsing Contexts</h2>
          <p>
            Browsing contexts contain open tabs and appear in the context switcher. You can switch
            to a different set of tabs when you switch the browsing context.
          </p>
        </div>

        <div class="search-container">
          <div class="search-input-wrapper">
            <input
              type="text"
              placeholder="Search contexts..."
              bind:value={searchFilter}
              class="search-input"
            />
            {#if searchFilter}
              <button class="clear-search" on:click={clearSearch} title="Clear search"> × </button>
            {/if}
          </div>
        </div>

        <div class="actions">
          <div class="space-item">
            <label class="custom-checkbox">
              <input type="checkbox" on:click={toggleSelectAll} />
              <span class="checkmark"></span>
            </label>
            <div class="space-info">
              <span class="space-name">Select All</span>
            </div>
          </div>
        </div>

        <div class="spaces-list">
          {#each filteredSpaces as space}
            {@const spaceData = space.dataValue}
            {@const isSelected = selectedSpaceIds.includes(space.id)}
            {@const matchesFilter = (spaceData.folderName || '')
              .toLowerCase()
              .includes(searchFilter.toLowerCase())}
            {#if spaceData.folderName}
              <div
                class="space-item"
                class:selected-highlight={isSelected && searchFilter && !matchesFilter}
              >
                <label class="custom-checkbox">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    on:change={() => toggleSpace(space.id)}
                  />
                  <span class="checkmark"></span>
                </label>
                <div class="space-info">
                  <div class="space-icon">
                    <SpaceIcon folder={space} size="sm" interactive={false} />
                  </div>
                  <span class="space-name">{spaceData.folderName}</span>
                  {#if isSelected}
                    <span class="selected-badge">Selected</span>
                  {/if}
                </div>
              </div>
            {/if}
          {/each}

          {#if filteredSpaces.length === 0}
            <div class="no-results">
              <p>No contexts found matching "{searchFilter}"</p>
            </div>
          {/if}
        </div>

        <div class="footer">
          {#if allowCancel}
            <button class="custom-button secondary" on:click={handleCancel}>Cancel</button>
          {/if}
          <button class="custom-button primary" on:click={handleSave}>Save</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .modal-overlay {
    position: fixed;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(1px);
    z-index: 999999;
    display: block;
    isolation: isolate;
    transform: translateZ(0);
    contain: layout style paint;

    &.horizontal-mode {
      top: 0;
      left: auto;
    }

    &:not(.horizontal-mode) {
      left: 0;
      top: auto;
    }
  }

  .browsing-context-selector {
    position: fixed;
    width: 480px;
    max-width: 90vw;
    max-height: 80vh;
    background: var(--color-surface, white);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    z-index: 9999;

    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);

    margin: 0;
    padding: 0;
    box-sizing: border-box;

    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .custom-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color 0.2s,
      color 0.2s,
      border-color 0.2s;
    border: none;
    outline: none;

    &.primary {
      background: var(--color-primary, #4952f2);
      color: white;

      &:hover {
        background: var(--color-primary-dark, #3a42d9);
      }
    }

    &.secondary {
      background: transparent;
      border: 1px solid var(--color-border, #e0e0e0);
      color: var(--color-text, #333);

      &:hover {
        background: rgba(0, 0, 0, 0.05);
      }
    }
  }

  .dialog-content {
    display: flex;
    flex-direction: column;
    padding: 24px;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }

  .header {
    margin-bottom: 16px;

    h2 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 8px 0;
    }

    p {
      font-size: 14px;
      color: var(--color-text-secondary, #666);
      margin: 0;
      line-height: 1.5;
    }
  }

  .search-container {
    margin-bottom: 16px;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input {
    width: 100%;
    padding: 10px 12px;
    padding-right: 36px;
    border: 1px solid var(--color-border, #e0e0e0);
    border-radius: 8px;
    font-size: 14px;
    background: var(--color-surface, white);
    color: var(--color-text, #333);
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--color-primary, #4952f2);
      box-shadow: 0 0 0 2px rgba(73, 82, 242, 0.1);
    }

    &::placeholder {
      color: var(--color-text-secondary, #999);
    }
  }

  .clear-search {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    font-size: 18px;
    color: var(--color-text-secondary, #999);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;

    &:hover {
      background: rgba(0, 0, 0, 0.05);
      color: var(--color-text, #333);
    }
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .spaces-list {
    flex: 1;
    overflow-y: auto;
    margin: 0 -24px;
    padding: 0 24px;
    height: 100%;
    flex-grow: 1;
  }

  .space-item {
    display: flex;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border, #e0e0e0);

    &:last-child {
      border-bottom: none;
    }

    &.selected-highlight {
      background: rgba(73, 82, 242, 0.05);
      border-radius: 6px;
      padding: 8px 12px;
      margin: 0 -12px;
      border-bottom: 1px solid var(--color-border, #e0e0e0);
    }
  }

  .space-info {
    display: flex;
    align-items: center;
    margin-left: 12px;
    flex: 1;
  }

  .selected-badge {
    margin-left: auto;
    background: var(--color-primary, #4952f2);
    color: white;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 10px;
    font-weight: 500;
  }

  .no-results {
    text-align: center;
    padding: 24px 0;
    color: var(--color-text-secondary, #666);
    font-size: 14px;
  }

  .custom-checkbox {
    position: relative;
    display: inline-block;
    width: 20px;
    height: 20px;
    cursor: pointer;

    input {
      position: absolute;
      opacity: 0;
      cursor: pointer;
      height: 0;
      width: 0;
    }

    .checkmark {
      position: absolute;
      top: 0;
      left: 0;
      height: 20px;
      width: 20px;
      background-color: transparent;
      border: 2px solid var(--color-border, #ddd);
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    input:checked ~ .checkmark {
      background-color: var(--color-primary, #4952f2);
      border-color: var(--color-primary, #4952f2);
    }

    .checkmark:after {
      content: '';
      position: absolute;
      display: none;
      left: 6px;
      top: 2px;
      width: 5px;
      height: 10px;
      border: solid white;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }

    input:checked ~ .checkmark:after {
      display: block;
    }
  }

  .space-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
  }

  .space-name {
    font-size: 14px;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border, #e0e0e0);
  }

  .debug-info {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
    font-size: 14px;
    color: #495057;
  }
</style>
