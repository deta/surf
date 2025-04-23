<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon, IconConfirmation } from '@horizon/icons'

  import {
    useLogScope,
    tooltip,
    parseStringIntoUrl,
    generateID,
    useDebounce,
    getHumanDistanceToNow,
    copyToClipboard
  } from '@horizon/utils'
  import { OasisSpace, useOasis } from '../../../service/oasis'
  import Switch from '../../Atoms/Switch.svelte'
  import { useToasts } from '../../../service/toast'
  import { useConfig } from '../../../service/config'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import SpaceIcon from '../../Atoms/SpaceIcon.svelte'
  import { openDialog } from '../../Core/Dialog/Dialog.svelte'
  import type { SpaceSource } from '@horizon/core/src/lib/types/spaces.types'

  export let space: OasisSpace | null
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

  let spaceData = space?.data
  let isLiveModeOn = $spaceData?.liveModeEnabled
  let smartFilterQuery = $spaceData?.smartFilterQuery
  let sortBy = $spaceData?.sortBy ?? 'resource_added_to_space'
  let sortOrder = $spaceData?.sortOrder ?? 'desc'

  let sourceValue = ''
  let loading = false
  let showAddSource = false
  let shoulDeleteAllResources = false
  let expandedDangerZone = false
  let copySourceIcon: IconConfirmation
  let selectedTab: 'general' | 'smart' | 'sources' = 'smart'

  const handleNameBlur = async () => {
    if (!space) return

    // TODO: rename tab as well
    await oasis.updateSpaceData(space.id, space.dataValue)

    await tabsManager.updateSpaceTabs(space.id, space.dataValue)

    telemetry.trackUpdateSpaceSettings({
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

    const newSources = [...(space.dataValue.sources ?? []), source]

    await space.updateData({ sources: newSources, liveModeEnabled: true })

    showAddSource = false
    sourceValue = ''

    telemetry.trackUpdateSpaceSettings({
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

    const { closeType: confirmed } = await openDialog({
      message: `Are you sure you want to remove the source "${getSourceName(source)}"?`
    })

    if (!confirmed) return

    await space.updateData({ sources: space.dataValue.sources?.filter((s) => s.id !== source.id) })

    toasts.success('Source removed!')

    telemetry.trackUpdateSpaceSettings({
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

    await space.updateData({ liveModeEnabled: e.detail })

    telemetry.trackUpdateSpaceSettings({
      setting: 'live_mode',
      change: e.detail
    })
  }, 200)

  const handleSmartQueryBlur = useDebounce(async () => {
    if (!space) return

    if (smartFilterQuery === '') {
      smartFilterQuery = null
    }

    if (smartFilterQuery === space.dataValue.smartFilterQuery) {
      return
    }

    await space.updateData({
      smartFilterQuery: smartFilterQuery,
      sql_query: null,
      embedding_query: null
    })

    telemetry.trackUpdateSpaceSettings({
      setting: 'smart_filter',
      change: null
    })

    dispatch('load')
  }, 350)

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Space' && !e.shiftKey) {
      e.preventDefault()
      e.stopImmediatePropagation()
      smartFilterQuery += ' '
    }
  }
</script>

<article class="wrapper">
  {#if space && $spaceData}
    <div class="header">
      <div class="title">
        <div class="icon-wrapper">
          <SpaceIcon folder={space} size="lg" />
        </div>

        <div use:tooltip={{ text: 'Click to edit' }}>
          <input
            bind:value={$spaceData.folderName}
            on:blur={handleNameBlur}
            on:keydown|stopPropagation
            class="folder-input"
            spellcheck="false"
          />
        </div>
      </div>

      <Switch
        label="Auto-refresh"
        color="#ff4eed"
        bind:checked={isLiveModeOn}
        on:update={handleLiveModeUpdate}
      />
    </div>

    <div class="content-wrapper">
      <div class="tabs">
        <button
          class="tab"
          class:active={selectedTab === 'smart'}
          on:click={() => (selectedTab = 'smart')}
        >
          <Icon name="sparkles" />
          Smart Filter
        </button>

        {#if $userConfigSettings.live_spaces}
          <button
            class="tab"
            class:active={selectedTab === 'sources'}
            on:click={() => (selectedTab = 'sources')}
          >
            <Icon name="rss" />
            Subscriptions
          </button>
        {/if}

        <button
          class="tab"
          class:active={selectedTab === 'general'}
          on:click={() => (selectedTab = 'general')}
        >
          <Icon name="settings" />
          Context Settings
        </button>
      </div>

      <div class="content">
        {#if selectedTab === 'sources'}
          <div class="sources">
            <div class="info">
              <p>
                Subscriptions automatically bring content into your context from your favorite
                external sources. Provide a RSS feed and Surf will fetch the latest content.
              </p>

              {#if !isLiveModeOn}
                <p><b>Note:</b> Since auto-refresh is turned off, you need to manually refresh.</p>
              {/if}
            </div>

            {#if $spaceData.sources}
              {#each $spaceData.sources as source}
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
        {:else if selectedTab === 'smart'}
          <div class="smart-filter">
            <p>
              Based on the provided description Surf will find links, articles and even files that
              are relevant to the context and add them when you view the context.
            </p>

            <input
              placeholder="e.g. articles about electric cars that I saved last week"
              bind:value={smartFilterQuery}
              on:blur={handleSmartQueryBlur}
              on:keydown={handleKeyDown}
            />

            {#if !isLiveModeOn}
              <p><b>Note:</b> Since auto-refresh is turned off, you need to manually refresh.</p>
            {/if}
          </div>
        {:else}
          <div class="setting">
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
                      <h3>Clear Context</h3>
                      <p>Remove all resources from this Context.</p>
                    </div>

                    <button on:click={handleClearSpace}>
                      <Icon name="close" />
                      Clear Context
                    </button>
                  </div>

                  <div class="action">
                    <div class="action-row">
                      <h3>Delete Context</h3>
                      <!-- <p>Deletes the Space and optionally its resources.</p> -->

                      <label>
                        <input bind:checked={shoulDeleteAllResources} type="checkbox" />
                        Permanently delete all resources as well
                      </label>
                    </div>

                    <button on:click={handleDeleteSpace}>
                      <Icon name="trash" />
                      Delete Context
                    </button>
                  </div>
                </div>
              {/if}
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
    gap: 1.5rem;
    padding: 1.5rem;
    width: 40rem;
    min-height: 20rem;
    border: 0.5px solid rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(12px);
    border-radius: 12px;
    box-shadow:
      0px 0px 0px 1px rgba(0, 0, 0, 0.07),
      0px 4px 10px 0px rgba(0, 0, 0, 0.12);

    @apply bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .tab {
    border: none;
    background: none;
    color: inherit;
    font-size: 1.1rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.5rem;
    border-bottom: 1.5px solid transparent;
    opacity: 0.6;

    transition: all 0.2s ease-in-out;

    &:hover {
      opacity: 0.9;
    }

    &.active {
      opacity: 0.9;
      border-bottom-color: rgba(80, 80, 80, 0.214);

      :global(.dark) & {
        border-bottom-color: rgba(255, 255, 255, 0.432);
      }

      &:hover {
        opacity: 1;
      }
    }
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
  }

  .title {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    h1 {
      font-size: 1.4rem;
      font-weight: 600;
      font-smooth: always;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .icon-wrapper {
      width: 1.5rem;
      height: 1.5rem;
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
      font-size: 1rem;
      opacity: 0.9;
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

    :global(.dark) & {
      background: rgba(255, 255, 255, 0.05);
    }

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
        opacity: 0.9;
      }

      button {
        border: none;
        background: none;
        color: inherit;
        opacity: 0.5;
        font-size: 1rem;
        font-weight: 500;

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

      :global(.dark) & {
        background: rgba(155, 155, 155, 0.216);
        border-color: rgba(255, 255, 255, 0.1);
      }

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

  .danger-zone {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: rgba(255, 0, 0, 0.1);
    padding: 1rem;
    border-radius: 12px;

    :global(.dark) & {
      background: rgba(255, 55, 55, 0.457);
    }

    .expand-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;

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
        opacity: 0.9;
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
          opacity: 0.9;
        }
      }

      button {
        flex-shrink: 0;
        background: #ffffff80;
        border: 1px solid #a89ca6;
        color: inherit;
        font-size: 1rem;
        font-weight: 500;

        font-smooth: always;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border-radius: 8px;

        :global(.dark) & {
          background: #a51111;
          border-color: #901010;
        }
      }

      label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1rem;
        opacity: 0.75;

        input {
        }
      }
    }
  }

  .smart-filter {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    h2 {
      font-size: 1.2rem;
      font-weight: 500;
    }

    p {
      font-size: 1rem;
      opacity: 0.9;
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

      :global(.dark) & {
        background: rgba(155, 155, 155, 0.216);
        border-color: rgba(255, 255, 255, 0.1);
      }

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
    gap: 1.5rem;

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
