<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { Icon, IconConfirmation } from '@horizon/icons'

  import type { Space, SpaceSource } from '../../types'
  import {
    useLogScope,
    tooltip,
    parseStringIntoUrl,
    generateID,
    useDebounce,
    getHumanDistanceToNow,
    copyToClipboard
  } from '@horizon/utils'
  import { useOasis } from '../../service/oasis'
  import Switch from '../Atoms/Switch.svelte'
  import { useToasts } from '../../service/toast'
  import { useConfig } from '../../service/config'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'

  export let space: Space | null
  const config = useConfig()
  const userConfigSettings = config.settings

  const dispatch = createEventDispatcher<{
    refresh: void
    clear: void
    delete: boolean
    load: void
    'delete-auto-saved': void
  }>()
  const log = useLogScope('OasisSpaceSettings')
  const oasis = useOasis()
  const toasts = useToasts()
  const tabsManager = useTabsManager()
  const telemetry = oasis.resourceManager.telemetry
  const autoSaveResources = oasis.autoSaveResources

  let isLiveModeOn = space?.name.liveModeEnabled
  let hideViewedResources = space?.name.hideViewed
  let smartFilterQuery = space?.name.smartFilterQuery
  let sourceValue = ''
  let sortBy = space?.name.sortBy ?? 'created_at'
  let loading = false
  let showAddSource = false
  let shoulDeleteAllResources = false
  let expandedDangerZone = false
  let copySourceIcon: IconConfirmation

  const handleNameBlur = async () => {
    if (!space) return

    // TODO: rename tab as well
    await oasis.updateSpaceData(space.id, space.name)

    await tabsManager.updateSpaceTabs(space.id, space.name)

    await telemetry.trackUpdateSpaceSettings({
      setting: 'name',
      change: null
    })
  }

  const handleAddSourceBlur = () => {
    if (!sourceValue) {
      showAddSource = false
    }
  }

  const handleAddSource = async () => {
    if (!space || !sourceValue) return

    const url = parseStringIntoUrl(sourceValue)
    if (!url) {
      toasts.error('Invalid URL')
      return
    }

    const source = {
      id: generateID(),
      name: url.hostname,
      type: 'rss',
      url: url.href,
      last_fetched_at: null
    } as SpaceSource

    const newSources = [...(space.name.sources ?? []), source]
    space.name.sources = newSources

    showAddSource = false
    sourceValue = ''

    await oasis.updateSpaceData(space.id, { sources: newSources, liveModeEnabled: true })

    await telemetry.trackUpdateSpaceSettings({
      setting: 'source',
      change: 'added'
    })

    // dispatch('refresh')
  }

  const getSourceName = (source: SpaceSource) => {
    try {
      if (source.name) return source.name
      if (source.url) return new URL(source.url).hostname
    } catch (e) {
      return source.url
    }
  }

  const removeSource = async (source: SpaceSource) => {
    if (!space) return

    const confirmed = window.confirm(
      `Are you sure you want to remove the source "${getSourceName(source)}"?`
    )
    if (!confirmed) return

    space.name.sources = space.name.sources?.filter((s) => s.id !== source.id)

    await oasis.updateSpaceData(space.id, { sources: space.name.sources })

    toasts.success('Source removed!')

    await telemetry.trackUpdateSpaceSettings({
      setting: 'source',
      change: 'removed'
    })

    dispatch('refresh')
  }

  const copySource = (source: SpaceSource) => {
    copyToClipboard(source.url)
    copySourceIcon.showConfirmation()
  }

  const handleClearSpace = async () => {
    dispatch('clear')
  }

  const handleDeleteSpace = async () => {
    dispatch('delete', shoulDeleteAllResources)
  }

  const handleDeleteAutoSaved = async () => {
    dispatch('delete-auto-saved')
  }

  const handleLiveModeUpdate = useDebounce(async (e: CustomEvent<boolean>) => {
    if (!space) return

    space.name.liveModeEnabled = e.detail

    await oasis.updateSpaceData(space.id, { liveModeEnabled: e.detail })

    await telemetry.trackUpdateSpaceSettings({
      setting: 'live_mode',
      change: e.detail
    })
  }, 500)

  const handleSortingUpdate = useDebounce(async () => {
    if (!space) return

    space.name.sortBy = sortBy

    await oasis.updateSpaceData(space.id, { sortBy: sortBy })

    await telemetry.trackUpdateSpaceSettings({
      setting: 'sort_by',
      change: sortBy
    })

    dispatch('load')
  }, 500)

  const handleHideViewedUpdate = useDebounce(async (e: CustomEvent<boolean>) => {
    if (!space) return

    space.name.hideViewed = e.detail

    await oasis.updateSpaceData(space.id, { hideViewed: e.detail })

    await telemetry.trackUpdateSpaceSettings({
      setting: 'hide_viewed',
      change: e.detail
    })

    dispatch('load')
  }, 500)

  const handleSmartQueryBlur = useDebounce(async () => {
    if (!space) return

    if (smartFilterQuery === '') {
      smartFilterQuery = null
    }

    if (smartFilterQuery === space.name.smartFilterQuery) {
      return
    }

    space.name.smartFilterQuery = smartFilterQuery ?? null
    space.name.sql_query = null
    space.name.embedding_query = null

    await oasis.updateSpaceData(space.id, {
      smartFilterQuery: smartFilterQuery,
      sql_query: null,
      embedding_query: null
    })

    await telemetry.trackUpdateSpaceSettings({
      setting: 'smart_filter',
      change: null
    })

    dispatch('load')
  }, 500)

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Space' && !e.shiftKey) {
      e.preventDefault()
      e.stopImmediatePropagation()
      smartFilterQuery += ' '
    }
  }
</script>

<article class="wrapper">
  {#if space}
    <div class="header">
      <!-- <SpaceIcon folder={space} /> -->
      <div use:tooltip={{ text: 'Click to edit' }}>
        <input
          bind:value={space.name.folderName}
          on:blur={handleNameBlur}
          on:keydown|stopPropagation
          class="folder-input"
          spellcheck="false"
        />
      </div>

      <Switch
        label="Auto-refresh"
        color="#ff4eed"
        bind:checked={isLiveModeOn}
        on:update={handleLiveModeUpdate}
      />
    </div>

    <div class="content">
      {#if $userConfigSettings.live_spaces}
        <div class="sources">
          <div class="info">
            <div class="title">
              <Icon name="news" size="20px" />
              <h2>Subscriptions</h2>
            </div>

            <p>Subscriptions automatically bring content into your Space from external sources.</p>

            <p>
              If auto-refresh is enabled, these sources will automatically be loaded, otherwise you
              can manually refresh.
            </p>
          </div>

          {#if space.name.sources}
            {#each space.name.sources as source}
              <div class="source">
                <div class="title">
                  <img
                    class="favicon"
                    src={`https://www.google.com/s2/favicons?domain=${source.url}&sz=48`}
                    alt={`favicon`}
                  />

                  <h3 use:tooltip={source.url}>{getSourceName(source)}</h3>
                </div>
                <div class="meta">
                  <p>
                    Last fetched: {source.last_fetched_at
                      ? getHumanDistanceToNow(source.last_fetched_at)
                      : 'never'}
                  </p>

                  <div class="meta-actions">
                    <button on:click={() => copySource(source)} use:tooltip={'Copy Source URL'}>
                      <IconConfirmation bind:this={copySourceIcon} name="copy" />
                    </button>

                    <button on:click={() => removeSource(source)} use:tooltip={'Remove Source'}>
                      <Icon name="trash" />
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          {/if}

          {#if showAddSource}
            <div class="add-source">
              <input
                placeholder="RSS feed URL"
                autofocus
                spellcheck="false"
                bind:value={sourceValue}
                on:blur={handleAddSourceBlur}
              />

              <button on:click={handleAddSource} class="icon">
                <Icon name="add" />
              </button>
            </div>
          {:else}
            <div class="add-source">
              <button on:click={() => (showAddSource = true)} class="add-source">
                <Icon name="add" />
                Add Source
              </button>
            </div>
          {/if}
        </div>
      {/if}

      <div class="setting">
        <div class="smart-filter">
          <div class="title">
            <Icon name="sparkles" size="20px" />
            <h2>Smart Space</h2>
          </div>

          <p>Automatically add new items you save to this Space, if they match your description.</p>
          <input
            placeholder="e.g. articles about electric cars"
            bind:value={smartFilterQuery}
            on:blur={handleSmartQueryBlur}
            on:keydown={handleKeyDown}
          />

          {#if !isLiveModeOn}
            <p><b>Note:</b> When auto-refresh is turned off, you need to manually refresh.</p>
          {/if}
        </div>
      </div>

      <div class="setting">
        <div class="title">
          <Icon name="settings" size="20px" />
          <h3>Settings</h3>
        </div>

        <Switch
          label="Hide already viewed items"
          color="#ff4eed"
          bind:checked={hideViewedResources}
          on:update={handleHideViewedUpdate}
        />

        <div class="sorting">
          <p>Sort resources by when they were</p>

          <select bind:value={sortBy} on:change={handleSortingUpdate}>
            <option value="created_at">added to the space</option>
            <option value="source_published_at">originally published</option>
          </select>
        </div>
      </div>

      <div class="danger-zone">
        <div class="danger-title">
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-interactive-supports-focus -->
          <div
            class="expand-toggle"
            on:click={() => (expandedDangerZone = !expandedDangerZone)}
            role="button"
          >
            {#if expandedDangerZone}
              <Icon name="chevron.down" />
            {:else}
              <Icon name="chevron.right" />
            {/if}
            <h2>Danger Zone</h2>
          </div>

          {#if expandedDangerZone}
            <p>These actions cannot be undone.</p>
          {/if}
        </div>

        {#if expandedDangerZone}
          <div class="actions">
            <!-- <button
              on:click={handleClearSpace}
              use:tooltip={'Clear all resources from this Space.'}
            >
              <Icon name="close" />
              Clear resources from Space
            </button> -->

            <div class="action">
              <div class="action-row">
                <h3>Clear Space</h3>
                <p>Remove all resources from this Space.</p>
              </div>

              <button on:click={handleClearSpace}>
                <Icon name="close" />
                Clear Space
              </button>
            </div>

            <div class="action">
              <div class="action-row">
                <h3>Delete Space</h3>
                <!-- <p>Deletes the Space and optionally its resources.</p> -->

                <label>
                  <input bind:checked={shoulDeleteAllResources} type="checkbox" />
                  Permanently delete all resources as well
                </label>
              </div>

              <button on:click={handleDeleteSpace}>
                <Icon name="trash" />
                Delete Space
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {:else if loading}
    <div class="loading-wrapper">
      <div class="loading">
        <Icon name="spinner" />
        Loading…
      </div>
    </div>
  {:else}
    <div class="header">
      <!-- <SpaceIcon folder={space} /> -->
      <h1>Settings</h1>
    </div>

    <div class="setting">
      <Switch
        label="Auto Save Resources"
        color="#ff4eed"
        bind:checked={$autoSaveResources}
        on:update={handleLiveModeUpdate}
      />

      <p>
        <b>Note:</b> If enabled every web page you visit gets automatically saved to Your Stuff.
      </p>
    </div>

    <div class="danger-zone">
      <div class="danger-title">
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-interactive-supports-focus -->
        <div
          class="expand-toggle"
          on:click={() => (expandedDangerZone = !expandedDangerZone)}
          role="button"
        >
          {#if expandedDangerZone}
            <Icon name="chevron.down" />
          {:else}
            <Icon name="chevron.right" />
          {/if}
          <h2>Danger Zone</h2>
        </div>

        {#if expandedDangerZone}
          <p>These actions cannot be undone.</p>
        {/if}
      </div>

      {#if expandedDangerZone}
        <div class="actions">
          <!-- <button
            on:click={handleClearSpace}
            use:tooltip={'Clear all resources from this Space.'}
          >
            <Icon name="close" />
            Clear resources from Space
          </button> -->

          <div class="action">
            <div class="action-row">
              <h3>Delete Auto Saved Resources</h3>
              <p>Remove all auto saved resources from Your Stuff.</p>
            </div>

            <button on:click={handleDeleteAutoSaved}>
              <Icon name="close" />
              Delete Auto Saved
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</article>

<style lang="scss">
  .wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 2rem;
    width: 40rem;
    min-height: 20rem;
    border: 0.5px solid rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(12px);
    border-radius: 12px;
    box-shadow:
      0px 0px 0px 1px rgba(0, 0, 0, 0.07),
      0px 4px 10px 0px rgba(0, 0, 0, 0.12);
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
    width: 100%;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;

    h1 {
      font-size: 1.4rem;
      font-weight: 600;
      font-smooth: always;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
  }

  .folder-input {
    border: none;
    background: transparent;
    color: inherit;
    font-size: 1.4rem;
    font-weight: 600;
    opacity: 0.75;
    font-family: inherit;
    max-width: 15rem;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    outline: none;
    width: fit-content;

    &:focus {
      opacity: 1;
    }
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    h2 {
      font-size: 1.2rem;
      font-weight: 500;
    }

    p {
      font-size: 1.1rem;
      opacity: 0.75;
    }
  }

  .title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sources {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .source {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: rgba(0, 0, 0, 0.05);
    padding: 0.75rem 1rem;
    border-radius: 8px;

    .title {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .favicon {
        width: 1rem;
        height: 1rem;
        object-fit: cover;
      }

      h3 {
        font-size: 1.1rem;
        font-weight: 400;
      }
    }

    .meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;

      p {
        font-size: 1rem;
        opacity: 0.5;
      }

      button {
        border: none;
        background: none;
        color: inherit;
        opacity: 0.5;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        font-smooth: always;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
    }

    .meta-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
  }

  .add-source {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    button {
      border: none;
      background: none;
      color: inherit;
      font-size: 1.1rem;
      font-weight: 500;
      cursor: pointer;
      font-smooth: always;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    button.icon {
      background: #ff4eed;
      color: #fff;
      border-radius: 8px;
      padding: 0.5rem;
    }

    input {
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      padding: 0.5rem;
      //grey
      background: #f0f0f0;
      color: inherit;
      font-size: 1.1rem;
      font-family: inherit;
      font-smooth: always;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      outline: none;
      width: 100%;

      &::placeholder {
        color: inherit;
        opacity: 0.5;
      }

      &:active,
      &:focus {
        border: 1px solid #ff4eed;
      }
    }
  }

  .sorting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;

    p {
      font-size: 16px;
    }

    select {
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      padding: 0.5rem;
      //grey
      background: #f0f0f0;
      color: inherit;
      font-size: 1.1rem;
      font-family: inherit;
      font-smooth: always;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      outline: none;
    }
  }

  .danger-zone {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: rgba(255, 0, 0, 0.1);
    padding: 1rem;
    border-radius: 12px;

    .expand-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;

      h2 {
        font-size: 1.2rem;
        font-weight: 500;
      }
    }

    .danger-title {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      h2 {
        font-size: 1.2rem;
        font-weight: 500;
      }

      p {
        font-size: 1.1rem;
        opacity: 0.75;
      }
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .action {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;

      .action-row {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;

        h3 {
          font-size: 1.1rem;
          font-weight: 500;
        }

        p {
          font-size: 1rem;
          opacity: 0.75;
        }
      }

      button {
        flex-shrink: 0;
        background: #ffffff80;
        border: 1px solid #a89ca6;
        color: inherit;
        font-size: 1.1rem;
        font-weight: 500;
        cursor: pointer;
        font-smooth: always;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border-radius: 8px;
      }

      label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1rem;
        opacity: 0.75;

        input {
          cursor: pointer;
        }
      }
    }
  }

  .smart-filter {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    h2 {
      font-size: 1.2rem;
      font-weight: 500;
    }

    p {
      font-size: 1.1rem;
      opacity: 0.75;
    }

    input {
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      padding: 0.5rem;
      //grey
      background: #f0f0f0;
      color: inherit;
      font-size: 1.1rem;
      font-family: inherit;
      font-smooth: always;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      outline: none;
      width: 100%;

      &::placeholder {
        color: inherit;
        opacity: 0.5;
      }

      &:active,
      &:focus {
        border: 1px solid #ff4eed;
      }

      &:disabled {
        background: #f0f0f0;
        color: inherit;
        opacity: 0.5;
      }
    }
  }

  .setting {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    h3 {
      font-size: 1.2rem;
      font-weight: 500;
    }
  }

  .loading-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    flex: 1;
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
