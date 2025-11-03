<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@deta/icons'

  import appIcon from '../assets/icon_512.png'

  import { isMac, useDebounce } from '@deta/utils'
  import {
    type EditablePrompt,
    type SettingsWindowTab,
    type UserConfig,
    type UserSettings
  } from '@deta/types'
  import SettingsOption from './components/SettingsOption.svelte'
  import DefaultSearchEnginePicker from './components/DefaultSearchEnginePicker.svelte'
  import TeletypeDefaultActionPicker from './components/TeletypeDefaultActionPicker.svelte'
  import AppStylePicker from './components/AppStylePicker.svelte'
  import ModelSettings, { type ModelUpdate } from './components/ModelSettings.svelte'
  import { BUILT_IN_MODELS, DEFAULT_AI_MODEL, Provider, type Model } from '@deta/types/src/ai.types'
  import { openDialog, prepareContextMenu } from '@deta/ui'
  import SmartNotesOptions from './components/SmartNotesOptions.svelte'
  import LayoutPicker from '../components/LayoutPicker.svelte'

  // let error = ''
  // let loading = false

  const isDev = import.meta.env.DEV

  let version = ''
  let prompts: EditablePrompt[] = []
  let migrationOutput: HTMLParagraphElement
  let migrating = false
  let userConfig: UserConfig | undefined = undefined
  let userConfigSettings: UserSettings | undefined = undefined
  let currentNotesSidebarValue: boolean = false
  let checkInterval: NodeJS.Timeout
  let showLicenses = false
  let showMiscInfo = false
  let licenses: string
  let isDarkMode = false
  let backgroundImageUrl = ''

  const tabParam = new URLSearchParams(window.location.search).get(
    'tab'
  ) as SettingsWindowTab | null

  const isDefaultBrowser = writable(false)
  const activeTab = writable<SettingsWindowTab>(tabParam ?? 'general')
  const models = writable<Model[]>([])
  const selectedModel = writable<string>('')

  const getAppInfo = async () => {
    // @ts-ignore
    const info = await window.api.getAppInfo()
    version = info.version
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
    // @ts-ignore
    await window.api.updateUserConfigSettings(userConfigSettings)
  }

  const handleDarkModeToggle = (e: CustomEvent<boolean>) => {
    if (!userConfigSettings) return
    isDarkMode = e.detail
    userConfigSettings.app_style = isDarkMode ? 'dark' : 'light'
    handleSettingsUpdate()

    // Apply immediately to settings window
    document.documentElement.dataset.colorScheme = userConfigSettings.app_style
    document.documentElement.style.colorScheme = userConfigSettings.app_style
  }

  const handleSelectModel = (e: CustomEvent<string>) => {
    selectedModel.set(e.detail)
    userConfigSettings.selected_model = e.detail
    handleSettingsUpdate()
  }

  const handleUpdateModel = async (e: CustomEvent<ModelUpdate>) => {
    let { id, updates } = e.detail

    const updateModel = (model: Model, updates: Partial<Model>) => {
      if (model.provider === Provider.Custom) {
        updates = { ...updates, skip_append_open_ai_suffix: true }
      }

      return { ...model, ...updates }
    }

    models.update((models) => {
      const index = models.findIndex((model) => model.id === id)
      if (index === -1) {
        const model = BUILT_IN_MODELS.find((model) => model.id === id)
        if (!model) {
          return models
        }

        models.push(updateModel(model, updates))

        return models
      }

      models[index] = updateModel(models[index], updates)
      return models
    })

    await tick()

    userConfigSettings.model_settings = $models
    handleSettingsUpdate()
  }

  const handleCreatedModel = async (e: CustomEvent<Model>) => {
    models.update((models) => [...models, e.detail])
    await tick()

    userConfigSettings.model_settings = $models

    handleSettingsUpdate()
  }

  const handleDeleteModel = async (e: CustomEvent<string>) => {
    const id = e.detail

    if (id === $selectedModel) {
      selectedModel.set(DEFAULT_AI_MODEL)
      userConfigSettings.selected_model = DEFAULT_AI_MODEL
    }

    models.update((models) => models.filter((model) => model.id !== id))
    await tick()

    userConfigSettings.model_settings = $models
    handleSettingsUpdate()
  }

  const helpUsImproveSurf = async () => {
    window.api.deanonymizeUser()

    const { closeType: confirmed } = await openDialog({
      title: 'Share your email with us',
      message:
        'Accepting will share your email with us, and allow us to contact you based on your Surf usage. No spam, we promise.<br><br> (Surf will restart after accepting)',
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Accept', type: 'submit' }
      ]
    })
    if (confirmed) {
      window.api.restartApp()
    }
  }

  // const handleStart = () => {
  //   // @ts-expect-error
  //   window.api.restartApp()
  // }

  const fetchLicenses = async () => {
    // @ts-ignore
    const data = await fetch(
      window.api.SettingsWindowEntrypoint.replace('/Settings/settings.html', '') +
        '/assets/dependencies.txt'
    )
    const text = await data.text()
    if (text) {
      licenses = text
    }
  }

  const handleBackgroundImageApply = async () => {
    if (!userConfigSettings) return
    const normalized = backgroundImageUrl.trim()
    backgroundImageUrl = normalized
    ;(userConfigSettings as any).background_image_url = normalized
    await handleSettingsUpdate()
    // Wait a bit to ensure settings propagate, then trigger refresh
    await new Promise((resolve) => setTimeout(resolve, 100))
    // @ts-ignore
    window.api.resetBackgroundImage?.()
  }

  const handleResetBackgroundImage = async () => {
    backgroundImageUrl = ''
    if (!userConfigSettings) return
    ;(userConfigSettings as any).background_image_url = ''
    await handleSettingsUpdate()
    // Wait a bit to ensure settings propagate, then trigger refresh
    await new Promise((resolve) => setTimeout(resolve, 100))
    // @ts-ignore
    window.api.resetBackgroundImage?.()
  }

  onMount(prepareContextMenu)
  onMount(async () => {
    userConfig = await window.api.getUserConfig()
    userConfigSettings = userConfig.settings
    backgroundImageUrl = ((userConfigSettings as any)?.background_image_url ?? '').trim()
    currentNotesSidebarValue = userConfigSettings.experimental_notes_chat_sidebar
    // @ts-ignore
    isDefaultBrowser.set(await window.api.isDefaultBrowser())

    // Initialize dark mode state from settings
    isDarkMode = userConfigSettings.app_style === 'dark'
    // Apply color scheme immediately
    document.documentElement.dataset.colorScheme = userConfigSettings.app_style || 'light'
    document.documentElement.style.colorScheme = userConfigSettings.app_style || 'light'

    models.set(userConfigSettings.model_settings)
    selectedModel.set(userConfigSettings.selected_model)

    getAppInfo()

    // @ts-ignore
    window.api.onSetPrompts((data: EditablePrompt[]) => {
      prompts = data
    })

    // @ts-ignore
    window.api.getPrompts()

    window.api.onUserConfigSettingsChange((settings: UserSettings) => {
      userConfigSettings = settings
      models.set(userConfigSettings.model_settings)
      selectedModel.set(userConfigSettings.selected_model)
      backgroundImageUrl = ((userConfigSettings as any)?.background_image_url ?? '').trim()
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
      on:click={() => activeTab.set('ai')}
      role="tab"
      tabindex="0"
      class="tab no-drag"
      class:active={$activeTab === 'ai'}
    >
      <Icon name="sparkles" size="24" />
      <h1>AI</h1>
    </div>

    <!-- <div
      on:click={() => activeTab.set('appearance')}
      role="tab"
      tabindex="0"
      class="tab no-drag"
      class:active={$activeTab === 'appearance'}
    >
      <Icon name="sidebar.left" size="24" />
      <h1>Appearance</h1>
    </div> -->

    <!-- <div
      on:click={() => activeTab.set('advanced')}
      role="tab"
      tabindex="0"
      class="tab no-drag"
      class:active={$activeTab === 'advanced'}
    >
      <Icon name="adjustments.horizontal" size="24" />
      <h1>Advanced</h1>
    </div>

    -->
  </div>

  <div class="content-wrapper">
    {#if $activeTab === 'general'}
      <article class="general">
        <img src={appIcon} alt="App Icon" />
        <div class="app-id">
          <h1>Surf</h1>

          <span class="version-pill">{version}</span>
        </div>

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
          <div class="dark-mode-wrapper">
            <SettingsOption
              icon="moon"
              title="Dark Mode"
              description="Enable dark appearance for the application."
              bind:value={isDarkMode}
              on:update={handleDarkModeToggle}
            />
          </div>

          <div class="search-wrapper">
            <DefaultSearchEnginePicker
              bind:value={userConfigSettings.search_engine}
              on:update={() => handleSettingsUpdate()}
            />
          </div>

          <div class="teletype-wrapper">
            <TeletypeDefaultActionPicker
              bind:value={userConfigSettings.teletype_default_action}
              on:update={() => handleSettingsUpdate()}
            />
          </div>

          <div class="background-wrapper">
            <div class="header">
              <h2>Background Image</h2>
              <p class="description">
                Paste an image URL to customize Surf&apos;s background. Leave this empty to use the
                default gradient.
              </p>
            </div>

            <div class="background-controls">
              <input
                type="url"
                placeholder="https://example.com/background.jpg"
                bind:value={backgroundImageUrl}
                on:keydown={(event) => event.key === 'Enter' && handleBackgroundImageApply()}
              />
              <div class="background-actions">
                <button
                  type="button"
                  class="primary"
                  on:click={handleBackgroundImageApply}
                  disabled={!backgroundImageUrl.trim()}
                >
                  Apply
                </button>
                <button
                  type="button"
                  class="reset"
                  on:click={handleResetBackgroundImage}
                  disabled={!backgroundImageUrl}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        {/if}

        {#if licenses}
          <div class="license-wrapper">
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="license-trigger" on:click={() => (showLicenses = !showLicenses)}>
              <div class="license-icon" class:open={showLicenses}>
                <Icon name="chevron.down" />
              </div>
              Open Source Licenses And Notices
            </div>

            {#if showLicenses}
              <div class="license-output">
                <pre>{licenses}</pre>
              </div>
            {/if}
          </div>
        {/if}

        <div class="license-wrapper">
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="license-trigger" on:click={() => (showMiscInfo = !showMiscInfo)}>
            <div class="license-icon" class:open={showMiscInfo}>
              <Icon name="chevron.down" />
            </div>
            Miscellaneous
          </div>
        </div>
      </article>
    {:else if $activeTab === 'ai'}
      <article class="general">
        {#if $models && $selectedModel}
          <ModelSettings
            selectedModelId={selectedModel}
            {models}
            on:select-model={handleSelectModel}
            on:update-model={handleUpdateModel}
            on:created-model={handleCreatedModel}
            on:delete-model={handleDeleteModel}
          />
        {/if}
      </article>
      <!-- {:else if $activeTab === 'appearance'}
      <article class="general">
        <LayoutPicker
          bind:orientation={userConfigSettings.tabs_orientation}
          on:update={handleSettingsUpdate}
        />
        <AppStylePicker
          bind:style={userConfigSettings.app_style}
          on:update={handleSettingsUpdate}
        />
        <div style="width: 100%;   max-width: 62ch;">
          <SettingsOption
            icon="unmute"
            title="Turntable Favicons"
            description="Tabs will have their favicons spinning to indicate media playing."
            bind:value={userConfigSettings.turntable_favicons}
            on:update={handleSettingsUpdate}
          />
        </div>
      </article> -->
      <!-- {:else if $activeTab === 'advanced'}
      <article class="list">
        {#if userConfigSettings}
          <div class="box">
            <div class="box-icon">
              <Icon name="info" size="25px" />
            </div>

            <p>
              Some of the following features are still under development and may not work as
              expected. Feel free to try them out and give us feedback. <a
                href="https://deta.notion.site/Experimental-Mode-152a5244a717801587dfcb374536b73d"
                target="_blank">More info in our docs ↗</a
              >
            </p>
          </div>

          <SmartNotesOptions on:update={handleSettingsUpdate} bind:userConfigSettings />

          <SettingsOption
            icon="chat.square.heart"
            title="Custom Prompts"
            description="Save custom prompts inside notes for quick re-use."
            bind:value={userConfigSettings.enable_custom_prompts}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="save"
            title="Save to Active Context"
            description="If enabled clicking the save button on a tab or chat message or downloading something will save it to the currently active context instead of the inbox."
            bind:value={userConfigSettings.save_to_active_context}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="download"
            title="Save Downloads to System Downloads Folder"
            description="If enabled, a copy of the files you download with Surf will be saved to your system's default downloads folder in addition to your stuff in Surf."
            bind:value={userConfigSettings.save_to_user_downloads}
            on:update={handleSettingsUpdate}
          />

          {#if !isMac()}
            <SettingsOption
              icon="picture-in-picture"
              title="Automatic Picture-in-Picture"
              description="Switching away from the active tab while a video is playing, it will continue playing the video inside a floating window."
              bind:value={userConfigSettings.auto_toggle_pip}
              on:update={handleSettingsUpdate}
            />
          {/if}

          <SettingsOption
            icon="sparkles"
            title="Automatic Filename Cleanup"
            description="Automatically clean up filenames when saving resources."
            bind:value={userConfigSettings.cleanup_filenames}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="message"
            title="Auto Generate Chat Prompts"
            description="Let Surf generate chat prompts for you based on the page content and metadata. The prompts will be shown directly in the chat sidebar."
            bind:value={userConfigSettings.automatic_chat_prompt_generation}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="rectangle"
            title="Auto Tag Images with AI"
            description="Use AI vision to automatically detect and tag the content of your saved images for better organization."
            bind:value={userConfigSettings.vision_image_tagging}
            on:update={handleSettingsUpdate}
          />
        {/if}
      </article> -->
    {/if}
  </div>
</main>

<style lang="scss">
  * {
    user-select: none;
  }
  :global(:root) {
    /* Import design tokens */
    --color-text: var(--on-app-background, #0c0729);
    --color-text-muted: var(--on-surface, #5b6882);
    --color-text-light: var(--white, #ffffff);
    --color-brand: var(--accent, #6d82ff);
    --color-brand-dark: var(--on-surface-accent, #330988);
    --color-brand-light: var(--accent-background, #f3f5ff);
    --color-link: var(--accent, #6d82ff);
    --color-link-dark: var(--on-surface-accent, #330988);
    --color-background: var(--app-background, #c8e3ff);
    --color-background-dark: var(--accent-muted, rgba(91, 104, 130, 0.45));
    --color-background-light: var(--app-background-light, #fefeff);
    --color-border-dark: var(--on-surface-muted, #3c465a);
    --color-border: var(--white-40, rgba(255, 255, 255, 0.4));
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
    width: calc(100vw - (100vw - 100%));
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
    background-color: light-dark(var(--color-background), var(--app-background-dark, #0f172a));
    display: flex;
    flex-direction: row;
    overflow: hidden;
  }

  .drag {
    -webkit-app-region: drag;
  }

  .no-drag {
    -webkit-app-region: no-drag;
  }

  :global(a) {
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
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--t-1, 0.25rem);
    justify-content: flex-start;
    align-items: stretch;
    padding: var(--t-4, 1rem);
    padding-top: var(--t-10, 4rem); /* Space for macOS traffic lights */
    border-right: 0.5px solid light-dark(var(--color-border), rgba(71, 85, 105, 0.4));
    width: 200px;
    z-index: 10;

    background: radial-gradient(
      453.65% 343.29% at 50.04% 0%,
      color(display-p3 0.8807 0.9291 0.9921) 0%,
      color(display-p3 0.7031 0.8325 0.9963) 69.23%,
      color(display-p3 0.7938 0.8654 0.9912) 93.37%
    );

    @media (prefers-color-scheme: dark) {
      background: radial-gradient(
        453.65% 343.29% at 50.04% 0%,
        rgba(30, 41, 59, 0.95) 0%,
        rgba(15, 23, 42, 0.98) 69.23%,
        rgba(15, 23, 42, 1) 93.37%
      );
    }
  }

  h2 {
    line-height: 1;
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
  }

  p {
    margin: 0;
    color: light-dark(var(--color-text-muted), var(--text-subtle-dark, #94a3b8));
    font-size: 1rem;
    line-height: 1.4;
  }
  .tab {
    display: flex;
    gap: var(--t-2, 0.5rem);
    align-items: center;
    padding: var(--t-2, 0.5rem) var(--t-3, 0.75rem);
    border-radius: var(--t-11, 11px);
    color: light-dark(var(--color-text-muted), var(--text-subtle-dark, #94a3b8));
    width: 100%;
    justify-content: flex-start;
    border: 0.5px solid transparent;
    cursor: pointer;
    user-select: none;

    transition:
      background-color 90ms ease-out,
      border-color 90ms ease-out,
      box-shadow 90ms ease-out;

    &:hover {
      background: light-dark(rgba(255, 255, 255, 0.6), rgba(30, 41, 59, 0.5));
      box-shadow:
        inset 0 0 0 0.75px light-dark(rgba(255, 255, 255, 0.1), rgba(100, 116, 139, 0.1)),
        inset 0 0.5px 0 1px light-dark(rgba(255, 255, 255, 0.2), rgba(148, 163, 184, 0.1)),
        inset 0 -0.75px 0 1px light-dark(rgba(0, 0, 0, 0.01), rgba(0, 0, 0, 0.3));
    }

    &.active {
      border: 0.5px solid light-dark(var(--white, #fff), rgba(71, 85, 105, 0.6));
      background: radial-gradient(
        290.88% 100% at 50% 0%,
        rgba(237, 246, 255, 0.96) 0%,
        rgba(246, 251, 255, 0.93) 100%
      );
      box-shadow:
        0 -0.5px 1px 0 rgba(119, 189, 255, 0.15) inset,
        0 1px 1px 0 #fff inset,
        0 3px 3px 0 rgba(62, 71, 80, 0.02),
        0 1px 2px 0 rgba(62, 71, 80, 0.02),
        0 0 1px 0 rgba(0, 0, 0, 0.09);
      color: light-dark(var(--color-brand-dark), var(--accent-dark, #8192ff));

      @media (prefers-color-scheme: dark) {
        background: radial-gradient(
          290.88% 100% at 50% 0%,
          rgba(30, 41, 59, 0.96) 0%,
          rgba(15, 23, 42, 0.93) 100%
        );
        box-shadow:
          0 -0.5px 1px 0 rgba(129, 146, 255, 0.15) inset,
          0 1px 1px 0 rgba(71, 85, 105, 0.3) inset,
          0 3px 3px 0 rgba(0, 0, 0, 0.3),
          0 1px 2px 0 rgba(0, 0, 0, 0.2),
          0 0 1px 0 rgba(0, 0, 0, 0.5);
      }
    }

    h1 {
      font-family: var(--tab-title-fontFamily, var(--default, Inter, sans-serif));
      font-weight: var(--tab-title-fontWeight, var(--semimedium, 420));
      font-size: var(--tab-title-fontSize, var(--t-12-6, 12.6px));
      line-height: var(--tab-title-lineHeight, normal);
      letter-spacing: var(--tab-title-letterSpacing, var(--loosen, 0.0125em));
      margin: 0;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
      -webkit-font-smoothing: subpixel-antialiased;
      text-rendering: optimizeLegibility;
    }
  }

  .content-wrapper {
    position: relative;
    flex-grow: 1;
    overflow: auto;
    display: flex;
    justify-content: center;
    padding: 3rem;
    background-color: light-dark(#e3f0ff, var(--surface-elevated-dark, #1b2435));

    box-shadow:
      -0.5px 0 1px 0 light-dark(rgb(250, 250, 250), rgba(15, 23, 42, 0.8)) inset,
      0px 0 1px 0 light-dark(#fff, rgba(71, 85, 105, 0.3)) inset,
      -3px 0 1px 0 light-dark(rgba(0, 0, 0, 0.025), rgba(0, 0, 0, 0.3)),
      -2px 0 1px 0 light-dark(rgba(9, 10, 11, 0.01), rgba(0, 0, 0, 0.2)),
      -1px 0 1px 0 light-dark(rgba(9, 10, 11, 0.03), rgba(0, 0, 0, 0.25));

    // display: flex;
    // flex-direction: column;
    // flex: 1;
    // overflow: auto;
    // padding: 3rem;
    // padding-top: 5rem;
    // height: fit-content;
    // width: 100%;
    // justify-content: center;
    // align-items: center;
    // background-color: var(--color-background);
    // z-index: 0;
  }

  .general {
    height: fit-content;
    width: 100%;
    max-width: 45rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    position: unset;

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
        background: light-dark(#d7e1fd, rgba(129, 146, 255, 0.2));
        color: light-dark(#678fff, var(--accent-dark, #8192ff));
      }
    }

    button {
      padding: 0.75rem 1rem;
      border: none;
      outline: none;
      border-radius: 0.5rem;
      background: none;
      color: light-dark(var(--color-link), var(--accent-dark, #8192ff));

      transition: color 0.2s;
      font-size: 1.1rem;

      &:hover {
        color: light-dark(var(--color-link-dark), var(--accent, #6d82ff));
      }
      &:disabled {
        cursor: not-allowed;
        color: light-dark(var(--color-text-muted), var(--text-subtle-dark, #94a3b8));
      }
    }
  }

  .background-actions {
    button.primary {
      background: var(--color-brand);
      color: var(--color-text-light);

      &:hover {
        background: var(--color-brand-dark);
      }
    }
  }

  .default-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: light-dark(
      var(--color-background-light),
      var(--surface-elevated-dark, #1b2435)
    );
    border-bottom: 1px solid light-dark(var(--color-border), rgba(71, 85, 105, 0.4));
    border-radius: 1.25rem;
    padding: 1rem 1.25rem;
    text-align: center;
    width: 100%;
    gap: 1rem;
    margin-bottom: 1.5rem;
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));

    button {
      padding: 8px 16px;
      color: var(--color-text-light);
      border: none;
      border-radius: 0.75rem;
      font-size: 0.9rem;
      font-weight: 500;

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
        color: rgb(237, 237, 237);

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
  .search-wrapper,
  .teletype-wrapper,
  .dark-mode-wrapper,
  .background-wrapper {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: radial-gradient(
      290.88% 100% at 50% 0%,
      rgba(237, 246, 255, 0.96) 0%,
      rgba(246, 251, 255, 0.93) 100%
    );
    border: 0.5px solid rgba(255, 255, 255, 0.8);
    border-radius: 11px;
    padding: 1rem;
    margin: 1rem 0;
    box-shadow:
      0 -0.5px 1px 0 rgba(119, 189, 255, 0.15) inset,
      0 1px 1px 0 #fff inset,
      0 3px 3px 0 rgba(62, 71, 80, 0.02),
      0 1px 2px 0 rgba(62, 71, 80, 0.02),
      0 1px 1px 0 rgba(0, 0, 0, 0.05),
      0 0 1px 0 rgba(0, 0, 0, 0.09);
    transition:
      background-color 90ms ease-out,
      box-shadow 90ms ease-out;

    @media (prefers-color-scheme: dark) {
      background: radial-gradient(
        290.88% 100% at 50% 0%,
        rgba(30, 41, 59, 0.96) 0%,
        rgba(15, 23, 42, 0.93) 100%
      );
      border: 0.5px solid rgba(71, 85, 105, 0.6);
      box-shadow:
        0 -0.5px 1px 0 rgba(129, 146, 255, 0.15) inset,
        0 1px 1px 0 rgba(71, 85, 105, 0.3) inset,
        0 3px 3px 0 rgba(0, 0, 0, 0.3),
        0 1px 2px 0 rgba(0, 0, 0, 0.2),
        0 1px 1px 0 rgba(0, 0, 0, 0.4),
        0 0 1px 0 rgba(0, 0, 0, 0.5);
    }
  }

  .background-wrapper {
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 0.75rem;
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
      color: light-dark(var(--color-text-muted), var(--text-subtle-dark, #94a3b8));
    }
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 45rem;
    height: fit-content;
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
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));

    transition: color 0.2s;

    &:hover {
      color: light-dark(var(--color-link), var(--accent-dark, #8192ff));
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
    border: 1px solid light-dark(var(--color-border), rgba(71, 85, 105, 0.4));
    border-radius: 8px;
    background: light-dark(var(--color-background-light), var(--surface-elevated-dark, #1b2435));
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
    outline: none;
    font-size: 1rem;
    font-family: inherit;

    &:focus {
      border-color: light-dark(var(--color-brand-light), var(--accent-dark, #8192ff));
    }
  }

  .links-wrapper {
    margin-bottom: 2rem;
  }

  .background-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .background-controls input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    border: 1px solid light-dark(var(--color-border), rgba(71, 85, 105, 0.4));
    background: light-dark(var(--color-background), var(--surface-elevated-dark, #1b2435));
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
  }

  .background-controls input::placeholder {
    color: light-dark(var(--color-text-muted), var(--text-subtle-dark, #94a3b8));
  }

  .background-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .background-actions button {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid transparent;
    background: light-dark(var(--color-brand), var(--accent-dark, #8192ff));
    color: var(--color-text-light);
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  .background-actions button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .background-actions .reset {
    background: transparent;
    border: 1px solid light-dark(var(--color-border), rgba(71, 85, 105, 0.4));
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
  }
</style>
