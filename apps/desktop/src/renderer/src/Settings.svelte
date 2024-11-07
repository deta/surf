<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'

  import appIcon from './assets/icon_512.png'
  import inlineAIScreenshot from './assets/inline-ai.png'
  import pageInsightsScreenshot from './assets/page-insights.png'
  import customPromptsScreenshot from './assets/custom-prompts.png'

  import PromptSection from './components/PromptSection.svelte'
  import Prompt from './components/Prompt.svelte'
  import { useDebounce } from '@horizon/utils'
  import type { EditablePrompt, UserConfig, UserSettings } from '@horizon/types'
  import SettingsOption from './components/SettingsOption.svelte'
  import LayoutPicker from './components/LayoutPicker.svelte'
  import DefaultSearchEnginePicker from './components/DefaultSearchEnginePicker.svelte'

  // let error = ''
  // let loading = false

  const isDev = import.meta.env.DEV

  let version = ''
  let prompts: EditablePrompt[] = []
  let migrationOutput: HTMLParagraphElement
  let migrating = false
  let userConfigSettings: UserSettings | undefined = undefined
  let userConfig: UserConfig | undefined = undefined
  let checkInterval: NodeJS.Timeout
  let showLicenses = false
  let licenses: string

  const isDefaultBrowser = writable(false)

  const activeTab = writable<'general' | 'appearance' | 'experiments' | 'advanced'>('general')

  const debouncedPromptUpdate = useDebounce((id: string, content: string) => {
    window.api.updatePrompt(id, content)
  }, 500)

  const getAppInfo = async () => {
    const info = await window.api.getAppInfo()
    version = info.version
  }

  const checkForUpdates = async () => {
    await window.api.checkForUpdates()
  }

  const useAsDefaultBrowser = async () => {
    await window.api.useAsDefaultBrowser()

    // This is needed because we do not know if the user accepted the prompt
    checkInterval = setInterval(async () => {
      isDefaultBrowser.set(await window.api.isDefaultBrowser())
    }, 1000)
  }

  const handleMigration = async () => {
    migrating = true
    try {
      // @ts-ignore
      await window.backend.sffs.js__backend_run_migration()
      migrationOutput.innerText = 'Migration complete!'
    } catch (error) {
      console.error(error)
      migrationOutput.innerText = error
    }
    migrating = false
  }

  const handleSettingsUpdate = async () => {
    console.log('updating settings', userConfigSettings)
    await window.api.updateUserConfigSettings(userConfigSettings)
  }

  // const handleStart = () => {
  //   // @ts-expect-error
  //   window.api.restartApp()
  // }

  const fetchLicenses = async () => {
    const data = await fetch(window.api.SettingsWindowEntrypoint + '/assets/dependencies.txt')
    const text = await data.text()
    if (text) {
      licenses = text
    }
  }

  const handleResetBackgroundImage = () => {
    window.api.resetBackgroundImage()
  }

  onMount(async () => {
    userConfigSettings = window.api.getUserConfigSettings()
    userConfig = await window.api.getUserConfig()
    isDefaultBrowser.set(await window.api.isDefaultBrowser())
    console.log('loaded settings', userConfigSettings)

    getAppInfo()

    window.api.onSetPrompts((data) => {
      prompts = data
    })

    window.api.getPrompts()

    window.api.onUserConfigSettingsChange((settings: UserSettings) => {
      console.log('user config settings change', settings)
      userConfigSettings = settings
    })

    if (!isDev) {
      fetchLicenses()
    }
  })

  onDestroy(() => {
    clearInterval(checkInterval)
  })
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<main>
  <div class="tabs drag">
    <div
      on:click={() => activeTab.set('general')}
      role="tab"
      tabindex="0"
      class="tab no-drag"
      class:active={$activeTab === 'general'}
    >
      <Icon name="settings" size="24" />
      <h1>General</h1>
    </div>

    <div
      on:click={() => activeTab.set('appearance')}
      role="tab"
      tabindex="0"
      class="tab no-drag"
      class:active={$activeTab === 'appearance'}
    >
      <Icon name="sidebar.left" size="24" />
      <h1>Appearance</h1>
    </div>

    <div
      on:click={() => activeTab.set('experiments')}
      role="tab"
      tabindex="0"
      class="tab no-drag"
      class:active={$activeTab === 'experiments'}
    >
      <Icon name="sparkles" size="24" />
      <h1>Experiments</h1>
    </div>

    <div
      on:click={() => activeTab.set('advanced')}
      role="tab"
      tabindex="0"
      class="tab no-drag"
      class:active={$activeTab === 'advanced'}
    >
      <Icon name="adjustments.horizontal" size="24" />
      <h1>Advanced</h1>
    </div>
  </div>

  <div class="content-wrapper">
    {#if $activeTab === 'general'}
      <article class="general">
        {#if !$isDefaultBrowser}
          <div class="default-wrapper">
            Surf is not set as your default browser.
            <button on:click={useAsDefaultBrowser}>Set as your default browser</button>
          </div>
        {/if}

        <img src={appIcon} alt="App Icon" />
        <div class="app-id">
          <h1>Surf</h1>

          <span class="version-pill">{version}</span>
        </div>

        <button on:click={checkForUpdates}>Check for Updates</button>

        {#if isDev}
          <div class="dev-wrapper">
            <h3>Migration</h3>
            <button on:click={handleMigration} disabled={migrating}>Run Migration</button>
            {#if migrating}
              <Icon name="spinner" size="22px" />
            {/if}
          </div>
        {/if}
        <div class="migration-output">
          <p bind:this={migrationOutput}></p>
        </div>
        {#if userConfigSettings}
          <div class="search-wrapper">
            <DefaultSearchEnginePicker
              bind:value={userConfigSettings.search_engine}
              on:update={() => handleSettingsUpdate()}
            />
          </div>
        {/if}

        <div class="dev-wrapper">
          <h3>Invite Friends</h3>
          <button on:click={() => window.api.openInvitePage(() => {})}>Create Invite Link</button>
        </div>

        <div class="license-wrapper">
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="license-trigger" on:click={() => (showLicenses = !showLicenses)}>
            <div class="license-icon" class:open={showLicenses}>
              <Icon name="chevron.down" />
            </div>
            Open Source Licenses
          </div>

          {#if showLicenses}
            <div class="license-output">
              <pre>{licenses ?? 'Loading...'}</pre>
            </div>
          {/if}
        </div>
      </article>
    {:else if $activeTab === 'appearance'}
      <article class="general">
        <LayoutPicker
          bind:orientation={userConfigSettings.tabs_orientation}
          on:update={handleSettingsUpdate}
        />
      </article>
    {:else if $activeTab === 'experiments'}
      <article class="list">
        <div class="box">
          <div class="box-icon">
            <Icon name="info" size="25px" />
          </div>

          <p>
            The following features are still under development and may not work as expected. Feel
            free to try them out and give us feedback. <a
              href="https://deta.notion.site/Experimental-Mode-10ca5244a7178061a9fadc2434c6e666"
              target="_blank">More info in our docs ↗</a
            >
          </p>
        </div>

        {#if userConfigSettings}
          <SettingsOption
            icon="marker"
            title="Live Spaces"
            description="Subscribe to RSS feeds of websites and pull in their content into a space."
            bind:value={userConfigSettings.live_spaces}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="code-block"
            title="Go Wild Mode"
            description="Modify the page or create mini apps from the page sidebar."
            bind:value={userConfigSettings.go_wild_mode}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="marker"
            title="Annotations Sidebar"
            description="View and create annotations from the page sidebar."
            bind:value={userConfigSettings.annotations_sidebar}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="home"
            title="Homescreen"
            description="Pin resources and spaces onto your personalizable homescreen. (This feature might change soon, so your homescreen state might reset at that point)."
            bind:value={userConfigSettings.homescreen}
            on:update={handleSettingsUpdate}
          >
            {#if userConfigSettings.homescreen}
              <section>
                <button on:click={handleResetBackgroundImage} style="padding: 0.5em 0.75em;"
                  >Reset Background Image</button
                >
              </section>
            {/if}
          </SettingsOption>
        {/if}
      </article>
    {:else if $activeTab === 'advanced'}
      <article class="list">
        {#if userConfigSettings}
          <SettingsOption
            icon="search"
            title="Use Semantic Search"
            description="Use search to find resources in Your Stuff based on their semantic relevance."
            bind:value={userConfigSettings.use_semantic_search}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="marker"
            title="Show Annotations in My Stuff"
            description="If enabled, annotations will be shown in My Stuff. Otherwise, you can only see them if you are on the page with the annotation, or if you search."
            bind:value={userConfigSettings.show_annotations_in_oasis}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="download"
            title="Save Downloads to System Downloads Folder"
            description="If enabled, a copy of the files you download with Surf will be saved to your system's default downloads folder in addition to your stuff in Surf."
            bind:value={userConfigSettings.save_to_user_downloads}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="message"
            title="Auto Generate Chat Prompts"
            description="Let Surf generate chat prompts for you based on the page content and metadata. The prompts will be shown directly in the chat sidebar."
            bind:value={userConfigSettings.automatic_chat_prompt_generation}
            on:update={handleSettingsUpdate}
          />
        {/if}

        <PromptSection
          title="Inline Page Menu Prompts"
          description="Customize prompts used for the inline AI menu in web pages."
          image={inlineAIScreenshot}
        >
          {#each prompts.filter((x) => x.kind === 'inline') as prompt}
            <Prompt
              title={prompt.title}
              description={prompt.description}
              content={prompt.content}
              on:update={(e) => debouncedPromptUpdate(prompt.id, e.detail)}
            />
          {/each}

          <div class="box">
            <Icon name="info" size="22px" />
            <p>Prompts can be written with basic Markdown syntax.</p>
          </div>
        </PromptSection>
      </article>
    {/if}
  </div>
</main>

<style lang="scss">
  :global(:root) {
    --color-text: #0c081a;
    --color-text-muted: #262332a2;
    --color-text-light: #ffffff;
    // --color-brand: #F73B95;
    // --color-brand-dark: #e6348a;
    --color-brand: #ff4eed;
    --color-brand-dark: #ff4eed;
    --color-brand-light: #ffa7f6;
    --color-link: #007bff;
    --color-link-dark: #0056b3;
    --color-background: #fafafa;
    --color-background-dark: #f0f0f0;
    --color-background-light: #ffffff;
    --color-border-dark: #d1d1d1;
    --color-border: #e0e0e0;
  }

  :global(*) {
    box-sizing: border-box;
  }

  article {
    position: relative;
    top: 0;
  }

  main {
    height: 100vh;
    width: 100vw;
    color: var(--color-text);
    background-color: var(--color-background);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .drag {
    -webkit-app-region: drag;
  }

  .no-drag {
    -webkit-app-region: no-drag;
  }

  a {
    color: var(--color-link);
    text-decoration: none;

    &:hover {
      color: var(--color-link-dark);
    }
  }

  img {
    width: 100px;
    height: 100px;
  }

  .tabs {
    position: fixed;
    top: 0;
    display: flex;
    gap: 1rem;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    padding: 1rem;
    background: var(--color-background-light);
    border-bottom: 1px solid var(--color-border);
    width: 100%;
    z-index: 10;
  }

  .tab {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.1s ease-in-out;

    &.active {
      background: var(--color-background-dark);
      color: var(--color-text);
    }

    &:hover {
      background: var(--color-background);
      color: var(--color-text);
    }

    h1 {
      font-size: 1.2rem;
      font-weight: 400;
    }
  }

  .content-wrapper {
    position: absolute;
    top: 4.5rem;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: auto;
    padding: 3rem;
    height: fit-content;
    width: 100%;
    justify-content: center;
    align-items: center;
    background-color: var(--color-background);
    z-index: 0;
  }

  .general {
    height: 100%;
    width: 100%;
    max-width: 45rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;

    .app-id {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      h1 {
        font-size: 2rem;
        font-weight: 700;
      }

      .version-pill {
        font-size: 1rem;
        line-height: 0.85;
        padding: 0.5rem;
        border-radius: 0.5rem;
        background: #d7e1fd;
        color: #678fff;
      }
    }

    button {
      padding: 0.75rem 1rem;
      border: none;
      outline: none;
      border-radius: 0.5rem;
      background: none;
      color: var(--color-link);
      cursor: pointer;
      transition: color 0.2s;
      font-size: 1.1rem;

      &:hover {
        color: var(--color-link-dark);
      }
      &:disabled {
        cursor: not-allowed;
        color: var(--color-text-muted);
      }
    }
  }

  .default-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--color-background-light);
    border-bottom: 1px solid var(--color-border);
    border-radius: 1.25rem;
    padding: 1rem 1.25rem;
    text-align: center;
    width: 100%;
    gap: 1rem;
    margin-bottom: 1.5rem;

    button {
      padding: 8px 16px;
      color: var(--color-text-light);
      border: none;
      border-radius: 0.75rem;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      background: radial-gradient(
        circle at 50% -50%,
        rgba(215, 143, 215, 1) 0%,
        rgba(45, 150, 205, 1) 35%,
        rgba(74, 144, 226, 1) 100%
      );
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      text-transform: uppercase;
      letter-spacing: 1px;
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.3), transparent);
        transition: all 0.5s;
      }

      &:hover {
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);

        &::before {
          left: 100%;
        }
      }

      &:active {
        transform: translateY(1px);
      }
    }
  }

  .dev-wrapper,
  .search-wrapper {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--color-background-dark);
    border-bottom: 1px solid var(--color-border);
    border-radius: 1rem;
    padding: 1rem;
    margin: 1rem 0;
  }

  .box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.5rem;
    border-radius: 0.5rem;
    color: var(--color-text);
    text-align: left;
    margin-bottom: 1rem;

    .box-icon {
      flex-shrink: 0;
    }

    p {
      font-size: 1.1rem;
      color: var(--color-text-muted);
    }
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 45rem;
  }

  .license-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .license-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: var(--color-link);
    }
  }

  .license-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease-in-out;

    &.open {
      transform: rotate(180deg);
    }
  }

  .license-output {
    height: 300px;
    overflow: auto;
    width: 100%;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-background-light);
    color: var(--color-text);
    outline: none;
    font-size: 1rem;
    font-family: inherit;

    &:focus {
      border-color: var(--color-brand-light);
    }
  }
</style>
