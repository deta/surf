<script lang="ts" context="module">
  // pretty-ignore
  export type ImportStatus = 'idle' | 'importing' | 'done' | 'error'
</script>

<script lang="ts">
  import { useResourceManager } from '@deta/services/resources'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { Importer } from '@deta/services'
  import { Icon } from '@deta/icons'
  import {
    BROWSER_TYPE_DATA,
    BrowserType,
    PRIMARY_BROWSRS,
    type BrowserTypeItem
  } from '@deta/types'
  import { isMac, useLogScope, wait } from '@deta/utils'

  import { createEventDispatcher } from 'svelte'
  import ImportDataItem from './ImportDataItem.svelte'
  import ImportInstructionsItem from './ImportInstructionsItem.svelte'

  export let currentStepIdx = 0
  export let canGoNext = false
  export let selectedBrowser: BrowserTypeItem | null = null
  export let importStatus: ImportStatus = 'idle'
  export let alternativeStyle = false
  export let showUsageInstructions = false

  const log = useLogScope('Importer')
  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()

  const dispatch = createEventDispatcher<{
    done: void
  }>()

  const importer = Importer.create({
    resourceManager,
    notebookManager
  })

  const majorBrowsers = BROWSER_TYPE_DATA.filter((browser) =>
    PRIMARY_BROWSRS.includes(browser.type)
  )
  const minorBrowsers = BROWSER_TYPE_DATA.filter(
    (browser) => !PRIMARY_BROWSRS.includes(browser.type)
  )

  let showMinorBrowsers = false
  let selectedData = {
    bookmarks: true,
    history: true,
    extensions: false
  }

  let importStatuses = {
    history: 'idle' as ImportStatus,
    bookmarks: 'idle' as ImportStatus
  }

  let importDataCount = {
    history: 0,
    bookmarks: 0
  }

  const MAX_INDEX = 4

  $: log.debug('Current step index:', currentStepIdx)

  $: importStatus = Object.values(importStatuses).every((status) => status === 'done')
    ? 'done'
    : Object.values(importStatuses).some((status) => status === 'error')
      ? 'error'
      : 'importing'

  $: canGoNext = !(
    (currentStepIdx === 0 && !selectedBrowser) ||
    (currentStepIdx === 1 && !selectedData.history && !selectedData.bookmarks) ||
    (currentStepIdx === 2 && importStatus !== 'done' && importStatus !== 'error')
  )

  let once = false
  $: if (selectedBrowser !== null && !once) {
    once = true
    selectedData = {
      bookmarks: selectedBrowser.supports.bookmarks,
      history: selectedBrowser.supports.history,
      extensions: false
    }
  }

  const handleBrowserClick = (browser: BrowserTypeItem) => {
    if (selectedBrowser?.type === browser.type) {
      selectedBrowser = null
      return
    }

    selectedBrowser = browser
    log.debug('Selected browser:', selectedBrowser)
  }

  const importHistory = async (type: BrowserType) => {
    try {
      importStatuses.history = 'importing'

      const res = await importer.importHistory(type)
      log.debug('History import result:', res)

      await wait(200)
      importDataCount.history = res.length
      importStatuses.history = 'done'

      return res
    } catch (error) {
      log.error('Error importing history:', error)

      // Simulate a delay to show the error state
      await wait(500)
      importStatuses.history = 'error'
    }
  }

  const importBookmarks = async (type: BrowserType) => {
    try {
      importStatuses.bookmarks = 'importing'

      const res = await importer.importBookmarks(type)
      log.debug('Bookmarks import result:', res)

      await wait(200)
      importStatuses.bookmarks = 'done'
      importDataCount.bookmarks = res.length

      return res
    } catch (error) {
      log.error('Error importing bookmarks:', error)

      // Simulate a delay to show the error state
      await wait(500)
      importStatuses.bookmarks = 'error'
    }
  }

  const startImportingData = async () => {
    try {
      if (!selectedBrowser) {
        return
      }

      importStatuses = {
        history: 'idle',
        bookmarks: 'idle'
      }

      const { type } = selectedBrowser

      const importPromises = []

      if (selectedData.history) {
        importPromises.push(importHistory(type))
      } else {
        importStatuses.history = 'done'
      }

      if (selectedData.bookmarks) {
        importPromises.push(importBookmarks(type))
      } else {
        importStatuses.bookmarks = 'done'
      }

      await Promise.all(importPromises)
    } catch (error) {
      log.error('Error importing data:', error)
    }
  }

  export const nextStep = () => {
    log.debug('Next step:', currentStepIdx)
    if (currentStepIdx <= MAX_INDEX) {
      currentStepIdx += 1
    }

    if (currentStepIdx === 2) {
      if (importStatus !== 'done') {
        startImportingData()
      }
    }

    if (currentStepIdx === 3 && !showUsageInstructions) {
      dispatch('done')
    }

    if (currentStepIdx === 4 && showUsageInstructions) {
      dispatch('done')
    }
  }

  export const previousStep = () => {
    if (currentStepIdx > 0) {
      currentStepIdx -= 1
    }

    if (currentStepIdx === 0) {
      selectedBrowser = null
      showMinorBrowsers = false
      selectedData = {
        bookmarks: true,
        history: true,
        extensions: false
      }
    }

    if (currentStepIdx === 1) {
      importStatuses = {
        history: 'idle',
        bookmarks: 'idle'
      }
    }
  }
</script>

<div class="wrapper" class:alternative-style={alternativeStyle}>
  <div class="content">
    {#if currentStepIdx === 0}
      <div class="step-wrapper">
        <div class="browser-grid">
          {#each majorBrowsers as browser}
            <button
              class="browser"
              class:selected={selectedBrowser?.type === browser.type}
              class:faded={selectedBrowser && selectedBrowser?.type !== browser.type}
              on:click={() => handleBrowserClick(browser)}
            >
              <Icon name={browser.icon} size="24px" />
              <div class="browser-name">{browser.name}</div>
            </button>
          {/each}

          {#if showMinorBrowsers}
            {#each minorBrowsers as browser}
              <button
                class="browser"
                class:selected={selectedBrowser?.type === browser.type}
                class:faded={selectedBrowser && selectedBrowser?.type !== browser.type}
                on:click={() => handleBrowserClick(browser)}
              >
                <Icon name={browser.icon} size="24px" />
                <div class="browser-name">{browser.name}</div>
              </button>
            {/each}
          {/if}

          <button
            class="browser"
            class:faded={selectedBrowser}
            on:click={() => (showMinorBrowsers = !showMinorBrowsers)}
          >
            {#if showMinorBrowsers}
              <Icon name="minus" size="24px" />
              <div class="browser-name">Show Less</div>
            {:else}
              <Icon name="add" size="24px" />
              <div class="browser-name">Show More</div>
            {/if}
          </button>
        </div>

        <!-- <p class="hint">
          Pick a browser and in the next step decide what to import.
        </p> -->
      </div>
    {:else if currentStepIdx === 1 || currentStepIdx === 2}
      <div class="step-wrapper">
        <div class="data-list">
          <ImportDataItem
            label="Bookmarks"
            icon="bookmark"
            status={importStatuses.bookmarks}
            count={importDataCount.bookmarks}
            bind:checked={selectedData.bookmarks}
            disabled={!selectedBrowser?.supports.bookmarks}
          />

          <ImportDataItem
            label="Browsing History"
            icon="history"
            status={importStatuses.history}
            count={importDataCount.history}
            bind:checked={selectedData.history}
            disabled={!selectedBrowser?.supports.history}
          />

          <ImportDataItem label="Extensions" icon="puzzle" disabled />
        </div>
      </div>
    {:else if currentStepIdx === 3}
      <div class="step-wrapper">
        <div class="data-list">
          {#if selectedData.bookmarks}
            <ImportInstructionsItem
              label="Bookmarks"
              icon="bookmark"
              shortcut={[isMac() ? 'cmd' : 'ctrl', 'O']}
            />
          {/if}

          {#if selectedData.history}
            <ImportInstructionsItem
              label="Browsing History"
              icon="history"
              shortcut={[isMac() ? 'cmd' : 'ctrl', 'Y']}
            />
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    max-width: 600px;
    width: 90%;
  }

  .step-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .browser-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    width: 100%;
  }

  .wrapper:not(.alternative-style) .browser {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    border-radius: 1rem;
    color: #2f2f2f;
    cursor: default;

    border: 3px solid transparent;
    background: #ffffff;
    box-shadow:
      0px 0px 1px 0px rgba(0, 0, 0, 0.09),
      0px 1px 1px 0px rgba(0, 0, 0, 0.07),
      0px 2px 4px 0px rgba(0, 0, 0, 0.02);
    box-shadow:
      0px 0px 1px 0px color(display-p3 0 0 0 / 0.09),
      0px 1px 1px 0px color(display-p3 0 0 0 / 0.07),
      0px 2px 4px 0px color(display-p3 0 0 0 / 0.02);
    transition:
      background-color 0.2s ease-in-out,
      border 0.1s ease-in-out,
      outline 0.01s ease-in-out;

    &.selected {
      background-color: white;
      border: 3px solid #3b82f6;
      color: #000000;

      &:hover {
        outline: 3px solid rgba(255, 255, 255, 0.3) !important;
      }
    }

    &.faded {
      opacity: 0.5;
    }

    .browser-name {
      font-size: 1.2rem;
      font-weight: 500;
    }

    :global(.dark) & {
      color: #e5e5e5;
      background-color: #2a2a2a;
    }

    &:hover {
      background: #ffffff;
      outline: 3px solid rgba(255, 255, 255, 0.4);

      :global(.dark) & {
        color: #e5e5e5;
        background-color: #3a3a3a;
      }
    }
  }

  .alternative-style .browser {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    border: 2px solid transparent;
    border-radius: 1rem;
    background-color: #eff5ff;
    color: #2f2f2f;
    cursor: default;

    &.selected {
      background-color: #e9eeff;
      border: 2px solid #3b82f6;
      color: #000000;
    }

    .browser-name {
      font-size: 1.2rem;
      font-weight: 500;
    }

    :global(.dark) & {
      color: #e5e5e5;
      background-color: #2a2a2a;
    }

    &:hover {
      background-color: #edf2ff;

      :global(.dark) & {
        color: #e5e5e5;
        background-color: #3a3a3a;
      }
    }
  }

  .data-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }
</style>
