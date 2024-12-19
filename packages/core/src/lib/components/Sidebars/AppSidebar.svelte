<script lang="ts" context="module">
  export type ExecuteCodeInTabEvent = { tabId: string; appId: string; code: string }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { writable } from 'svelte/store'

  import { Icon } from '@horizon/icons'
  import { Editor, getEditorContentText } from '@horizon/editor'

  import { useLogScope } from '@horizon/utils'
  import { SFFS } from '../../service/sffs'
  import { useTelemetry } from '../../service/telemetry'
  import { slide } from 'svelte/transition'
  import type BrowserTab from '../Browser/BrowserTab.svelte'
  import { useToasts } from '../../service/toast'
  import type { Tab } from '../../types'
  import { minifyHTML, sanitizeHTML } from '@horizon/web-parser/src/utils'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { openDialog } from '../Core/Dialog/Dialog.svelte'

  export let activeBrowserTab: BrowserTab
  export let activeTab: Tab
  export let appId: string
  export let horizontalTabs = false

  let fetching = false
  let prompt = ''
  let directCode = ''
  let inputValue = ''
  let app: HTMLIFrameElement
  let timeout: ReturnType<typeof setTimeout>
  let editorFocused = false
  let delayedEditorFocus = false
  let editor: Editor

  const log = useLogScope('AppsSidebar')
  const telemetry = useTelemetry()
  const toasts = useToasts()
  const ai = useAI()
  const dispatch = createEventDispatcher<{
    clear: void
    'execute-tab-code': ExecuteCodeInTabEvent
    close: void
  }>()
  const config = useConfig()

  const userSettings = config.settings
  const activeToolTab = writable<'app' | 'page'>('page')

  $: if (inputValue.startsWith('app:') || inputValue.startsWith('<p>app:')) {
    activeToolTab.set('app')
  }

  // this is needed to properly handle the focus state of the editor and showing/hiding the button
  $: if (editorFocused) {
    log.debug('editor focused')
    delayedEditorFocus = true

    if (timeout) {
      clearTimeout(timeout)
    }
  } else {
    timeout = setTimeout(() => {
      delayedEditorFocus = false
    }, 100)
  }

  const changeToolTab = (tab: 'app' | 'page') => {
    activeToolTab.set(tab)

    if (delayedEditorFocus) {
      editor.focus()
    }
  }

  const cleanSource = (source: string) => {
    const escapeSequencePattern = /\\[\\ntbrvf0']/g
    source = source.replace(escapeSequencePattern, '')

    const stringPattern = /\\"/g
    source = source.replace(stringPattern, '"')

    if (source.startsWith('"')) {
      source = source.slice(1)
    }
    if (source.endsWith('"')) {
      source = source.slice(0, -1)
    }
    if (source.startsWith('```')) {
      source = source.slice(3)
    }
    if (source.endsWith('```')) {
      source = source.slice(0, -3)
    }
    if (source.startsWith('html')) {
      source = source.slice(4)
    }
    if (source.startsWith('javascript')) {
      source = source.slice(10)
    }
    if (source.startsWith('js')) {
      source = source.slice(2)
    }
    return source
  }

  const cleanContext = (html: string) => {
    let clean = cleanSource(html)
    return `\`\`\`html\n${clean}\n\`\`\``
  }

  const getTabContext = async (tab: BrowserTab) => {
    const content = await tab.executeJavaScript('document.body.outerHTML.toString()')
    if (!content) {
      return null
    }

    const cleaned = sanitizeHTML(content)
    const minified = await minifyHTML(cleaned)

    return cleanContext(minified)
  }

  // const handleMessageEvent = (e: any) => {
  //   if (e.source.frameElement.id !== appId) {
  //     return
  //   }
  //   // TODO: figure out why debouncing is required, multiple messages are being sent
  //   dispatch('execute-tab-code', { tabId: activeTab.id, appId: appId, code: cleanSource(e.data.data) })
  // }

  const handlePromptSubmit = async () => {
    fetching = true

    if (!inputValue) return
    let savedInputValue = getEditorContentText(inputValue)

    try {
      inputValue = ''
      editor.clear()
      editor.blur()

      const tabId = activeTab.id
      const tabContext = await getTabContext(activeBrowserTab)
      if (!tabContext) {
        log.error('no content found from javscript execution')
        toasts.error('Error: failed to parse content for create app context')
        inputValue = savedInputValue
        editor.setContent(savedInputValue)
        return
      }

      const isAppPrompt = savedInputValue.toLowerCase().startsWith('app:')

      if ($activeToolTab === 'app' && !isAppPrompt) {
        savedInputValue = `app: ${savedInputValue}`
      }

      const createApp = savedInputValue.toLowerCase().startsWith('app:')

      log.debug(
        createApp ? 'Creating app with input:' : 'Modifying page with input',
        savedInputValue,
        appId
      )

      const appCode = await ai.createApp(appId, savedInputValue, {
        contexts: [tabContext]
      })
      if (!appCode) {
        throw new Error('no app code returned from backend call')
      }

      const clean = cleanSource(appCode)
      log.debug('got source code:', clean)
      if (clean.startsWith('"Error code: 4')) {
        throw new Error('Page content is unfortunately too long')
      }

      prompt = savedInputValue

      if (createApp) {
        app.srcdoc = clean

        await telemetry.trackGoWildCreateApp()
        return
      }

      directCode = clean
      dispatch('execute-tab-code', { tabId: tabId, appId: appId, code: clean })

      await telemetry.trackGoWildModifyPage()
    } catch (error) {
      log.error('Failed to create app:', error)
      inputValue = savedInputValue
      editor.setContent(savedInputValue)
      openDialog({
        title: 'Failed to create app!',
        message: `${error}`,
        actions: [{ title: 'Close', type: 'reset' }]
      })
    } finally {
      fetching = false
    }
  }

  const handleCodeRerun = async () => {
    dispatch('execute-tab-code', { tabId: activeTab.id, appId: appId, code: directCode })

    await telemetry.trackGoWildRerun()
  }

  const handleClear = async () => {
    prompt = ''
    app.srcdoc = ''
    dispatch('clear')

    await telemetry.trackGoWildClear()
  }

  const handleInputKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePromptSubmit()
    }
  }

  onMount(async () => {
    if (!appId) {
      log.error('no app id')
      await openDialog({
        title: 'No app id',
        message: '',
        actions: [{ title: 'Close', type: 'reset' }]
      })
    }
    const history = await ai.getChat(appId)
    log.debug('history', history)
    if (!history) {
      log.error('no history')
      return
    }
    const l = history.messagesValue.length
    if (l < 2) {
      log.debug('no history')
      return
    }
    prompt = history.messagesValue[l - 2].content
    const code = cleanSource(history.messagesValue[l - 1].content)
    if (prompt.toLowerCase().startsWith('app:')) {
      app.srcdoc = code
    } else {
      directCode = code
    }

    editor.focus()
  })
</script>

<div class="flex flex-col gap-4 overflow-hidden p-4 h-full">
  {#if !$userSettings.go_wild_mode}
    <div
      class="flex items-center justify-between gap-3 px-4 py-4 border-b-2 border-sky-100 dark:border-gray-900 -m-4"
    >
      <div class="flex items-center justify-start text-lg p-1.5 font-semibold">Go Wild</div>

      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        role="button"
        tabindex="0"
        on:click={() => dispatch('close')}
        class="flex items-center gap-2 p-1 text-sky-800/50 rounded-lg hover:bg-sky-100 hover:text-sky-800 group"
      >
        <Icon name="sidebar.right" class="group-hover:!hidden" size="20px" />
        <Icon name="close" class="hidden group-hover:!block" size="20px" />
      </div>
    </div>
  {/if}
  <!-- <div class="header">
    <div class="title">
      <Icon name="sparkles" size="28px" />
      <h1>Go wild</h1>
    </div>
  </div> -->

  {#if !fetching && prompt}
    <button on:click={handleClear} class="clear-btn"> Clear </button>
  {/if}

  <div class="content">
    {#if fetching}
      <div class="app-prompt">
        <div class="message">
          <Icon name="spinner" />
          {#if $activeToolTab === 'app'}
            <p>Creating an app...</p>
          {:else}
            <p>Running...</p>
          {/if}
        </div>
      </div>
    {/if}
    {#if prompt}
      <div class="app-prompt">
        <div class="message">
          <Icon name="message" size="20px" />
          <p>{prompt}</p>
          {#if directCode !== ''}
            <button title="Run again" class="rerun-btn" on:click={handleCodeRerun}>
              <Icon name="reload" />
            </button>
          {/if}
        </div>
      </div>
    {/if}

    <iframe
      title="App"
      id={appId}
      frameborder="0"
      sandbox="allow-scripts allow-forms"
      bind:this={app}
    ></iframe>
  </div>

  <form on:submit|preventDefault={handlePromptSubmit} class="prompt">
    {#if !fetching}
      <div class="tool-tabs">
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div
          on:click={() => changeToolTab('page')}
          class="tab"
          class:active={$activeToolTab === 'page'}
        >
          Modify Page
        </div>
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div
          on:click={() => changeToolTab('app')}
          class="tab"
          class:active={$activeToolTab === 'app'}
        >
          Create App
        </div>
      </div>
    {/if}

    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="editor-wrapper" on:keydown={handleInputKeydown}>
      <Editor
        bind:this={editor}
        bind:content={inputValue}
        bind:focused={editorFocused}
        autofocus={false}
        submitOnEnter
        placeholder="Tell me what you want…"
      />
    </div>

    {#if (inputValue && inputValue !== '<p></p>') || delayedEditorFocus}
      <button
        type="submit"
        transition:slide={{ duration: 150 }}
        disabled={fetching || inputValue === '<p></p>'}
        class:filled={!fetching && inputValue && inputValue !== '<p></p>'}
      >
        {#if fetching}
          {#if $activeToolTab === 'app'}
            <div>Creating…</div>
          {:else}
            <div>Running…</div>
          {/if}
          <Icon name="spinner" />
        {:else if $activeToolTab === 'app'}
          <div>Create</div>
          <Icon name="arrow.right" />
        {:else}
          <div>Run</div>
          <Icon name="arrow.right" />
        {/if}
      </button>
    {/if}
  </form>
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: hidden;
    padding-top: 2rem;
    height: 100%;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    overflow: auto;
  }

  .tool-tabs {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;

    .tab {
      padding: 0.5rem 1rem;
      border-radius: 8px;

      transition: background 0.2s;
      background: #fff;
      color: #3f3f3f;
      border: 1px solid transparent;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
      font-size: 0.9rem;

      &.active {
        background: #f73b95;
        color: #fff;
      }

      &:hover {
        opacity: 0.85;
      }
    }
  }

  .app-prompt {
    padding: 15px;
    background: rgb(255, 255, 255);
    border-radius: 8px;
    font-size: 1.1rem;
    color: #3f3f3f;
    display: flex;
    flex-direction: row;
    gap: 10px;
    overflow: hidden;

    :global(.dark) & {
      background: #1e1e1e;
      color: #fff;
    }
  }

  .message {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    width: 100%;

    svg {
      flex-shrink: 0;
    }

    p {
      flex: 1;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }

  .app-prompt button {
    flex-shrink: 0;
    border: none;
    height: 40px;
    width: 40px;
    border-radius: 8px;
    background: #fff;
    color: #353535;

    font-size: 1rem;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    transition: background 0.2s;

    :global(.dark) & {
      background: #1e1e1e;
      color: #fff;
    }

    &.rerun-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: auto;
      background: none;
      box-shadow: none;

      &:hover {
        background: #f6f5ef;
      }
    }

    &:hover {
      background: #f6f5ef;
    }
  }

  .prompt {
    padding: 0.5rem;
    flex-shrink: 0;
    // border-top: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    padding: 1rem 0;
    font-family: inherit;

    .editor-wrapper {
      flex: 1;
      background: #fff;
      border: 1px solid #eeece0;
      border-radius: 12px;
      padding: 0.75rem;
      font-size: 1rem;
      font-family: inherit;
      resize: vertical;
      min-height: 80px;

      :global(.dark) & {
        background: #1e1e1e;
        border-color: #2e2e2e;
      }
    }

    button {
      appearance: none;
      padding: 0.75rem;
      border: none;
      border-radius: 8px;

      transition: background-color 0.2s;
      height: min-content;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: #fd1bdf40;
      color: white;
      margin-top: 1rem;

      div {
        font-size: 1rem;
      }

      &:hover {
        background: #fd1bdf69;
      }

      &.filled {
        background: #f73b95;

        &:hover {
          background: #f92d90;
        }
      }

      &:active {
        background: #f73b95;
      }
    }
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    button {
      flex-shrink: 0;
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      background: #fff;
      color: #353535;

      font-size: 1rem;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      transition: background 0.2s;

      &:hover {
        background: #f6f5ef;
      }
    }
  }

  .title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #2b2715;
    white-space: nowrap;

    h1 {
      font-size: 1.5rem;
      font-weight: 500;
    }
  }

  .clear-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: auto;
    border: none;
    background: none;
    color: #616179;

    font-size: 1rem;

    &:hover {
      color: #2b2b3d;
    }
  }

  iframe {
    border: none;
    height: 100%;
    width: 90%;
    margin: 1rem;
  }
</style>
