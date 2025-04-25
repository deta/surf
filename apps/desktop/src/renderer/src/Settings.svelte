<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'

  import appIcon from './assets/icon_512.png'
  import inlineAIScreenshot from './assets/inline-ai.png'

  import PromptSection from './components/PromptSection.svelte'
  import Prompt from './components/Prompt.svelte'
  import { isMac, useDebounce } from '@horizon/utils'
  import {
    type EditablePrompt,
    type SettingsWindowTab,
    type UserConfig,
    type UserSettings
  } from '@horizon/types'
  import SettingsOption from './components/SettingsOption.svelte'
  import LayoutPicker from './components/LayoutPicker.svelte'
  import DefaultSearchEnginePicker from './components/DefaultSearchEnginePicker.svelte'
  import AppStylePicker from './components/AppStylePicker.svelte'
  import ModelSettings, { type ModelUpdate } from './components/ModelSettings.svelte'
  import {
    BUILT_IN_MODELS,
    DEFAULT_AI_MODEL,
    Provider,
    type Model
  } from '@horizon/types/src/ai.types'
  import { prepareContextMenu } from '@horizon/core/src/lib/components/Core/ContextMenu.svelte'
  import { openDialog } from '@horizon/core/src/lib/components/Core/Dialog/Dialog.svelte'
  import SmartNotesOptions from './components/SmartNotesOptions.svelte'
  import ExtensionsManager from './components/ExtensionsManager.svelte'
  import { CHANGELOG_URL, SHORTCUTS_PAGE_URL } from '@horizon/core/src/lib/utils/env'
  import ContextLinkingOptions from './components/ContextLinkingOptions.svelte'

  // let error = ''
  // let loading = false

  const isDev = import.meta.env.DEV

  let version = ''
  let prompts: EditablePrompt[] = []
  let migrationOutput: HTMLParagraphElement
  let migrating = false
  let userConfig: UserConfig | undefined = undefined
  let userConfigSettings: UserSettings | undefined = undefined
  let currentExtensionsValue: boolean = false
  let currentNotesSidebarValue: boolean = false
  let checkInterval: NodeJS.Timeout
  let showLicenses = false
  let showMiscInfo = false
  let licenses: string

  const tabParam = new URLSearchParams(window.location.search).get(
    'tab'
  ) as SettingsWindowTab | null

  const isDefaultBrowser = writable(false)
  const activeTab = writable<SettingsWindowTab>(tabParam ?? 'general')
  const models = writable<Model[]>([])
  const selectedModel = writable<string>('')

  const debouncedPromptUpdate = useDebounce((id: string, content: string) => {
    // @ts-ignore
    window.api.updatePrompt(id, content)
  }, 500)

  const getAppInfo = async () => {
    // @ts-ignore
    const info = await window.api.getAppInfo()
    version = info.version
  }

  const getUserId = () => {
    return window.api
      .getUserConfig()
      .then((cfg) => (cfg.anon_telemetry ? cfg.anon_id : cfg.user_id))
      .catch((e) => {
        console.error(e)
        return 'Could not get user ID!'
      })
  }

  const checkForUpdates = async () => {
    // @ts-ignore
    await window.api.checkForUpdates()
  }

  const useAsDefaultBrowser = async () => {
    // @ts-ignore
    await window.api.useAsDefaultBrowser()

    // This is needed because we do not know if the user accepted the prompt
    checkInterval = setInterval(async () => {
      // @ts-ignore
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
    // @ts-ignore
    await window.api.updateUserConfigSettings(userConfigSettings)

    // we need to restart the app if the extensions setting has changed
    // this is done so that all the attached handlers, preloads etc are removed
    if (currentExtensionsValue !== userConfigSettings.extensions) {
      currentExtensionsValue = userConfigSettings.extensions
      // @ts-ignore
      // TODO: do we have a better way to restart the app while we wait for everything to finish?
      setTimeout(() => window.api.restartApp(), 2000)
    } else if (currentNotesSidebarValue !== userConfigSettings.experimental_notes_chat_sidebar) {
      currentNotesSidebarValue = userConfigSettings.experimental_notes_chat_sidebar
      setTimeout(() => window.api.restartApp(), 800)
    }
  }

  const handleSelectModel = (e: CustomEvent<string>) => {
    console.log('selected model', e.detail)
    selectedModel.set(e.detail)
    userConfigSettings.selected_model = e.detail
    handleSettingsUpdate()
  }

  const handleUpdateModel = async (e: CustomEvent<ModelUpdate>) => {
    let { id, updates } = e.detail

    console.log('updating model', id, updates)

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
    console.log('created model', e.detail)
    models.update((models) => [...models, e.detail])
    await tick()

    userConfigSettings.model_settings = $models

    handleSettingsUpdate()
  }

  const handleDeleteModel = async (e: CustomEvent<string>) => {
    const id = e.detail
    console.log('deleting model', id)

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
    // TODO: (maxu): Enable again when we get telemetry to work inside settings.svelte
    //telemetry.trackChangeTelemetryAnonymization(false)

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
    const data = await fetch(window.api.SettingsWindowEntrypoint + '/assets/dependencies.txt')
    const text = await data.text()
    if (text) {
      licenses = text
    }
  }

  const handleResetBackgroundImage = () => {
    // @ts-ignore
    window.api.resetBackgroundImage()
  }

  onMount(async () => {
    userConfig = await window.api.getUserConfig()
    console.log('loaded user config', userConfig)
    userConfigSettings = userConfig.settings
    currentExtensionsValue = userConfigSettings.extensions
    currentNotesSidebarValue = userConfigSettings.experimental_notes_chat_sidebar
    // @ts-ignore
    isDefaultBrowser.set(await window.api.isDefaultBrowser())
    console.log('loaded settings', userConfigSettings)

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
      console.log('user config settings change', settings)
      userConfigSettings = settings
      models.set(userConfigSettings.model_settings)
      selectedModel.set(userConfigSettings.selected_model)
    })

    if (!isDev) {
      fetchLicenses()
    }

    prepareContextMenu()
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
      <Icon name="code" size="24" />
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
        <img src={appIcon} alt="App Icon" />
        <div class="app-id">
          <h1>Surf</h1>

          <span class="version-pill">{version}</span>
        </div>

        <div class="links-wrapper">
          <button on:click={checkForUpdates}>Check for Updates</button>

          -

          <button
            on:click={() => {
              // @ts-ignore
              window.api.openURL(CHANGELOG_URL, true)
            }}
          >
            Changelog
          </button>

          -

          <button
            on:click={() => {
              // @ts-ignore
              window.api.openURL(SHORTCUTS_PAGE_URL, true)
            }}>Keyboard Shortcuts</button
          >
        </div>

        {#if !$isDefaultBrowser}
          <div class="default-wrapper">
            Surf is not set as your default browser.
            <button on:click={useAsDefaultBrowser}>Set as your default browser</button>
          </div>
        {/if}

        {#if userConfig && userConfig.anon_telemetry}
          <div
            class="default-wrapper"
            style="flex-direction: column;align-items: stretch;text-align: left;"
          >
            <div style="display: flex;align-items: center;justify-content: space-between;">
              <span style="max-width:40ch; text-align: left;"
                >Help us improve Surf by allowing us to contact you via email based on your usage
                behavior.
              </span>
              <button on:click={helpUsImproveSurf}>Help us improve Surf</button>
            </div>
            <small style="opacity: 0.7;"
              >Note, that even with this enabled, we don't have any insights into any private
              contents you are accessing.<br /><a
                style="cursor: pointer;"
                target="_blank"
                href="https://deta.notion.site/Analytics-152a5244a717812281f7cf4037bb66d7"
                >Learn More</a
              ></small
            >
          </div>
        {/if}

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
          <button
            on:click={() => {
              // @ts-ignore
              return window.api.openInvitePage(() => {})
            }}>Create Invite Link</button
          >
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

        <div class="license-wrapper">
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="license-trigger" on:click={() => (showMiscInfo = !showMiscInfo)}>
            <div class="license-icon" class:open={showMiscInfo}>
              <Icon name="chevron.down" />
            </div>
            Miscellaneous
          </div>

          {#if showMiscInfo}
            {#await getUserId() then id}
              <div style="display: flex; gap: 1ch; align-items: center;">
                <span><b>Surf ID:</b></span> <span style="user-select: text;">{id}</span>
              </div>
            {/await}
          {/if}
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
    {:else if $activeTab === 'appearance'}
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
              href="https://deta.notion.site/Experimental-Mode-152a5244a717801587dfcb374536b73d"
              target="_blank">More info in our docs ↗</a
            >
          </p>
        </div>

        {#if userConfigSettings}
          <SettingsOption
            icon="puzzle"
            title="Extensions Support"
            description="Use extensions in Surf. Please note that this feature is still in early development."
            bind:value={userConfigSettings.extensions}
            showConfirmDialog={(_) => true}
            getDialogMessage={(newExtensionValue) => {
              const title = 'Are you sure? (Surf will restart)'
              const message = newExtensionValue
                ? 'Enabling extensions will restart Surf.'
                : 'All your extensions will be uninstalled and Surf will restart.'
              return { title, message }
            }}
            on:update={handleSettingsUpdate}
          >
            {#if userConfigSettings.extensions}
              <ExtensionsManager />
            {/if}
          </SettingsOption>

          <SmartNotesOptions on:update={handleSettingsUpdate} bind:userConfigSettings />

          <ContextLinkingOptions on:update={handleSettingsUpdate} bind:userConfigSettings />

          <SettingsOption
            icon="marker"
            title="Live Contexts"
            description="Subscribe to RSS feeds of websites and pull in their content into a context."
            bind:value={userConfigSettings.live_spaces}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="sidebar.right"
            title="Annotations Sidebar"
            description="Enable the annotations sidebar where you can link Surflets and annotations to websites to easily revisit them from the sidebar."
            bind:value={userConfigSettings.annotations_sidebar}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="picture-in-picture"
            title="Automatic Picture-in-Picture"
            description="Switching away from the active tab while a video is playing, it will continue playing the video inside a floating window."
            bind:value={userConfigSettings.auto_toggle_pip}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="sparkles"
            title="Automatic Filename Cleanup"
            description="Automatically clean up filenames when saving resources."
            bind:value={userConfigSettings.cleanup_filenames}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="rectangle"
            title="Embeds on the Desktop"
            description="Embed content from websites directly on your desktop if the card is big enough."
            bind:value={userConfigSettings.experimental_desktop_embeds}
            on:update={handleSettingsUpdate}
          />
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

          <SettingsOption
            icon="rectangle"
            title="Auto Tag Images with AI"
            description="Use AI vision to automatically detect and tag the content of your saved images for better organization."
            bind:value={userConfigSettings.vision_image_tagging}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="eye"
            title="Always Include Screenshot in Chat"
            description="Always include a screenshot of your current webpage when using Chat."
            bind:value={userConfigSettings.always_include_screenshot_in_chat}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="circle-dot"
            title="Show Contexts in Previews"
            description="Show in which contexts a resource is saved in the resource preview."
            bind:value={userConfigSettings.show_resource_contexts}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="home"
            title="Link New Tab Menu and Desktop"
            description="Auto switch to the Desktop when opening the New Tab Menu ({isMac()
              ? '⌘'
              : 'ctrl'} + T)."
            bind:value={userConfigSettings.homescreen_link_cmdt}
            on:update={handleSettingsUpdate}
          />

          <SettingsOption
            icon="save"
            title="Save to Active Context"
            description="If enabled clicking the save button on a tab or chat message or downloading something will save it to the currently active context instead of the inbox."
            bind:value={userConfigSettings.save_to_active_context}
            on:update={handleSettingsUpdate}
          />
        {/if}

        <!--<PromptSection
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
        </PromptSection>-->
      </article>
    {/if}
  </div>
</main>

<style lang="scss">
  * {
    user-select: none;
  }
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
    width: calc(100vw - (100vw - 100%));
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
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    padding: 1rem 6rem;
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
    flex-grow: 1;
    overflow: auto;
    display: flex;
    justify-content: center;
    padding: 3rem;
    background-color: var(--color-background);

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

  .custom-model-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    padding: 0.5rem 0;
  }

  .form-field {
    display: grid;
    grid-template-columns: 180px 1fr;
    align-items: center;
    gap: 1rem;

    label {
      font-size: 0.9rem;
      color: var(--color-text);
    }
  }

  .input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    background: var(--color-background-light);
    color: var(--color-text);
    font-size: 0.9rem;
    transition: all 0.2s ease;

    &:focus {
      outline: none;
      border-color: var(--color-brand-light);
      box-shadow: 0 0 0 2px rgba(255, 167, 246, 0.1);
    }

    &::placeholder {
      color: var(--color-text-muted);
    }
  }

  .checkbox-container {
    display: flex;
    align-items: center;
  }

  .checkbox {
    appearance: none;
    width: 1rem;
    height: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 0.25rem;
    background: var(--color-background-light);

    position: relative;
    transition: all 0.2s ease;

    &:checked {
      background: var(--color-brand);
      border-color: var(--color-brand);

      &::after {
        content: '';
        position: absolute;
        left: 4px;
        top: 1px;
        width: 4px;
        height: 8px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }
    }

    &:focus {
      outline: none;
      border-color: var(--color-brand-light);
      box-shadow: 0 0 0 2px rgba(255, 167, 246, 0.1);
    }
  }

  .links-wrapper {
    margin-bottom: 2rem;
  }
</style>
