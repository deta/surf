<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { useLogScope } from '../../utils/log'
  import { SFFS } from '../../service/sffs'

  export let tabContext: string
  export let sffs: SFFS
  export let appId: string

  let fetching = false
  let prompt = ''
  let directCode = ''
  let inputValue = ''
  let app: HTMLIFrameElement

  const log = useLogScope('AppsSidebar')

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
    try {
      const appCode = await sffs.createAIApp(appId, inputValue, { contexts: [tabContext] })
      if (!appCode) {
        throw new Error('no app code returned from backend call')
      }
      if (appCode.toLowerCase().startsWith('error code: 400')) {
        throw new Error('Page content is unfortunately too long')
      }

      const clean = cleanSource(appCode)
      log.info('got source code:', clean)
      prompt = inputValue
      if (inputValue.toLowerCase().startsWith('app:')) {
        app.srcdoc = clean
        return
      }
      directCode = clean
      dispatch('executeAppSidebarCode', { appId: appId, code: clean })
    } catch (error) {
      log.error('Failed to create app:', error)
      alert(error)
    } finally {
      fetching = false
    }
  }

  const handleCodeRerun = async () => {
    dispatch('executeAppSidebarCode', { appId: appId, code: directCode })
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
  })

  onDestroy(async () => {
    window.removeEventListener('message', handleMessageEvent)
  })
</script>

<div class="wrapper">
  <div class="header">
    <div class="title">
      <Icon name="sparkles" size="28px" />
      <h1>Go wild</h1>
    </div>

    {#if !fetching}
      <button
        on:click={() => {
          prompt = ''
          app.srcdoc = ''
          dispatch('clearAppSidebar', {})
        }}
      >
        Clear
      </button>
    {/if}
  </div>

  <div class="content">
    {#if prompt}
      <div class="app-prompt">
        <p>{prompt}</p>
        {#if directCode !== ''}
          <button title="Run again" class="rerun-btn" on:click={handleCodeRerun}>
            <Icon name="reload" />
          </button>
        {/if}
      </div>
    {/if}
    <iframe title="App" id={appId} frameborder="0" bind:this={app}></iframe>
  </div>

  <form on:submit|preventDefault={handlePromptSubmit} class="prompt">
    <input bind:value={inputValue} placeholder="Tell me what you want.." />

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
    background: #f6f5ef;
    border-radius: 8px;
    font-size: 1.1rem;
    color: #3f3f3f;
    display: flex;
    flex-direction: row;
    gap: 10px;
  }

  .rerun-btn {
    margin-left: auto;
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

  iframe {
    border: none;
    height: 100%;
    width: 90%;
    margin: 1rem;
  }
</style>
