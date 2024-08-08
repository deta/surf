<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import { useLogScope } from '../../utils/log'
  import { SFFS } from '../../service/sffs'
  import { useTelemetry } from '../../service/telemetry'

  export let tabContext: string
  export let sffs: SFFS
  export let appId: string

  let fetching = false
  let prompt = ''
  let directCode = ''
  let inputValue = ''
  let app: HTMLIFrameElement
  let inputElem: HTMLInputElement

  const log = useLogScope('AppsSidebar')
  const telemetry = useTelemetry()

  const activeToolTab = writable<'app' | 'page'>('page')

  $: if (inputValue.startsWith('app:')) {
    activeToolTab.set('app')
  }

  const changeToolTab = (tab: 'app' | 'page') => {
    activeToolTab.set(tab)
    inputElem.focus()
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

  tabContext = cleanContext(tabContext)
  log.info('tabContext', tabContext)

  const dispatch = createEventDispatcher<{
    clearAppSidebar: {}
    executeAppSidebarCode: { appId: string; code: string }
  }>()

  const handleMessageEvent = (e: any) => {
    if (e.source.frameElement.id !== appId) {
      return
    }
    // TODO: figure out why debouncing is required, multiple messages are being sent
    dispatch('executeAppSidebarCode', { appId: appId, code: cleanSource(e.data.data) })
  }

  window.addEventListener('message', handleMessageEvent)

  const handlePromptSubmit = async () => {
    fetching = true
    if (!inputValue) return
    let savedInputValue = inputValue
    try {
      inputValue = ''

      const createApp = savedInputValue.toLowerCase().startsWith('app:') || $activeToolTab === 'app'
      log.debug(
        createApp ? 'Creating app with input:' : 'Modifying page with input',
        savedInputValue,
        appId
      )

      const appCode = await sffs.createAIApp(appId, savedInputValue, { contexts: [tabContext] })
      if (!appCode) {
        throw new Error('no app code returned from backend call')
      }

      const clean = cleanSource(appCode)
      log.info('got source code:', clean)
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
      dispatch('executeAppSidebarCode', { appId: appId, code: clean })

      await telemetry.trackGoWildModifyPage()
    } catch (error) {
      log.error('Failed to create app:', error)
      inputValue = savedInputValue
      alert(error)
    } finally {
      fetching = false
    }
  }

  const handleCodeRerun = async () => {
    dispatch('executeAppSidebarCode', { appId: appId, code: directCode })

    await telemetry.trackGoWildRerun()
  }

  const handleClear = async () => {
    prompt = ''
    app.srcdoc = ''
    dispatch('clearAppSidebar', {})

    await telemetry.trackGoWildClear()
  }

  onMount(async () => {
    if (!appId) {
      log.error('no app id')
      alert('No app id')
    }
    const history = await sffs.getAIChat(appId)
    log.debug('history', history)
    if (!history) {
      log.error('no history')
      return
    }
    const l = history.messages.length
    if (l < 2) {
      log.debug('no history')
      return
    }
    prompt = history.messages[l - 2].content
    const code = cleanSource(history.messages[l - 1].content)
    if (prompt.toLowerCase().startsWith('app:')) {
      app.srcdoc = code
    } else {
      directCode = code
    }

    inputElem.focus()
  })

  onDestroy(async () => {
    window.removeEventListener('message', handleMessageEvent)
  })
</script>

<div class="flex flex-col gap-4 overflow-hidden p-4 h-full">
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
    {#if prompt}
      <div class="app-prompt">
        <div class="message">
          <Icon name="message" />
          <p>{prompt}</p>
        </div>
        {#if directCode !== ''}
          <button title="Run again" class="rerun-btn" on:click={handleCodeRerun}>
            <Icon name="reload" />
          </button>
        {/if}
      </div>
    {:else if fetching}
      <div class="app-prompt">
        <div class="message">
          <Icon name="spinner" />
          <p>Generating...</p>
        </div>
      </div>
    {/if}

    <iframe title="App" id={appId} frameborder="0" bind:this={app}></iframe>
  </div>

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

  <form on:submit|preventDefault={handlePromptSubmit} class="prompt">
    <input
      bind:this={inputElem}
      bind:value={inputValue}
      autofocus
      placeholder="Tell me what you want.."
    />

    <button disabled={fetching} class="" type="submit">
      {#if fetching}
        <Icon name="spinner" />
      {:else}
        <Icon name="arrow.right" />
      {/if}
    </button>
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

    .tab {
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
      background: #fff;
      color: #3f3f3f;
      border: 1px solid transparent;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
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

  .prompt {
    padding: 0.5rem;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
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
  }

  .message {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;

    p {
      margin: 0;
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
    cursor: pointer;
    font-size: 1rem;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    transition: background 0.2s;

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

  .prompt button {
    appearance: none;
    border: none;
    background: #f73b95;
    color: #fff;
    border-radius: 8px;
    padding: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
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
      cursor: pointer;
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

  input {
    width: 100%;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 5px;
    font-size: 1rem;
    background-color: #fff;
    color: #3f3f3f;

    &:hover {
      background: #eeece0;
    }

    &:focus {
      outline: none;
      border-color: #f73b95;
      color: #000;
      background-color: #ffffff;
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
    cursor: pointer;
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
