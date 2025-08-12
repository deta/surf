<script lang="ts">
  import { Icon, IconConfirmation } from '@deta/icons'
  import { copyToClipboard, formatCodeLanguage, tooltip, useLogScope, wait } from '@deta/utils'
  import { afterUpdate, onMount } from 'svelte'
  import type { WebviewTag } from 'electron'
  import { writable } from 'svelte/store'

  let copyIcon: IconConfirmation
  let saveIcon: IconConfirmation

  let elem: HTMLPreElement
  let appContainer: HTMLDivElement

  let language: string = ''
  let isHTML: boolean = false
  let isJS: boolean = false
  let isHTMLComplete: boolean = false
  let showPreview: boolean = false
  let codeContent: string = ''
  let jsOutput: string = ''
  let isExecuting: boolean = false

  const log = useLogScope('CodeBlock')

  const appName = writable('')
  const appIsLoading = writable(false)

  const getCode = () => {
    const codeElem = elem?.querySelector('code')
    if (!codeElem) return ''
    codeContent = codeElem.textContent || ''
    return codeContent
  }

  const makeCodeEditable = () => {
    const codeElem = elem?.querySelector('code')
    if (!codeElem) return

    codeElem.setAttribute('contenteditable', 'true')
    codeElem.setAttribute('spellcheck', 'false')
    codeElem.setAttribute('tabindex', '0')
  }

  const handleCopyClick = () => {
    const code = getCode()
    copyToClipboard(code)
    copyIcon.showConfirmation()
  }

  const handleSaveApp = async () => {
    saveIcon.startLoading()

    await wait(2000)

    saveIcon.showConfirmation()
  }

  const executeJavaScript = async () => {
    const code = getCode()
    if (!code) return

    isExecuting = true
    jsOutput = ''

    // Create a sandboxed iframe for execution
    const sandbox = document.createElement('iframe')
    sandbox.style.display = 'none'
    document.body.appendChild(sandbox)

    try {
      const executePromise = new Promise((resolve, reject) => {
        sandbox.onload = () => {
          const iframeWindow = sandbox.contentWindow
          if (!iframeWindow) {
            reject(new Error('Could not access iframe window'))
            return
          }

          iframeWindow.console = {
            log: (...args: any[]) => {
              const logMessage = args
                .map((arg) =>
                  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                )
                .join(' ')
              jsOutput += (jsOutput ? '\n' : '') + logMessage
            },
            error: (...args: any[]) => {
              const errorMessage = `Error: ${args.join(' ')}`
              jsOutput += (jsOutput ? '\n' : '') + errorMessage
            }
          }

          try {
            const result = iframeWindow.eval(code)
            resolve(result)
          } catch (error: any) {
            reject(error)
          }
        }
      })

      sandbox.srcdoc = `
          <${'script'}>
            ${code}
          <${'/script'}>
    `

      await executePromise
    } catch (error: any) {
      jsOutput = `Error: ${error.message}`
    } finally {
      document.body.removeChild(sandbox)
      isExecuting = false
    }
  }

  const getLanguage = () => {
    const codeElem = elem?.querySelector('code')
    if (!codeElem) return

    const langClass = codeElem.className.split(' ').find((c) => c.startsWith('language-'))
    if (langClass) {
      const lang = langClass.replace('language-', '')
      language = formatCodeLanguage(lang)
      isHTML = lang === 'html'
      isJS = lang === 'javascript' || lang === 'typescript'
    }
  }

  /*
  const renderHTMLPreview = () => {
    if (!isHTML || !appContainer) return

    const code = getCode()
    if (!code) return

    const iframe = document.createElement('iframe')
    iframe.style.width = '100%'
    iframe.style.height = '600px'
    iframe.style.border = 'none'

    appContainer.innerHTML = ''
    appContainer.appendChild(iframe)

    const iframeDoc = iframe.contentWindow?.document
    if (iframeDoc) {
      iframeDoc.open()
      iframeDoc.write(code)
      iframeDoc.close()
    }
  }
  */

  const renderHTMLPreview = () => {
    log.debug('renderHTMLPreview')
    if (!isHTML || !appContainer) return

    const code = getCode()
    if (!code) return

    appContainer.innerHTML = ''

    const webview = document.createElement('webview') as WebviewTag
    // @ts-ignore
    webview.nodeintegration = false
    // @ts-ignore
    webview.webpreferences = 'contextIsolation=true'
    webview.style.width = '100%'
    webview.style.height = '600px'
    webview.style.border = 'none'

    webview.addEventListener('page-title-updated', (e) => {
      $appName = e.title
    })

    webview.addEventListener('did-start-loading', () => appIsLoading.set(true))
    webview.addEventListener('did-stop-loading', () => appIsLoading.set(false))

    appContainer.appendChild(webview)

    // @ts-ignore
    webview.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(code)
  }

  const reloadApp = () => {
    if (isHTML && showPreview) {
      renderHTMLPreview()
    }
  }

  let once = false

  afterUpdate(() => {
    if (!language) {
      getLanguage()
    }

    getCode()

    if (isHTML && codeContent) {
      if (!isHTMLComplete) {
        isHTMLComplete = codeContent.trim().endsWith('</html>')
        showPreview = isHTMLComplete
      }
      if (showPreview) {
        makeCodeEditable()
        if (isHTML && showPreview && codeContent && !once) {
          once = true
          renderHTMLPreview()
        }
      }
    }
  })

  onMount(() => {
    setTimeout(() => {
      if (isHTML && showPreview && codeContent) {
        renderHTMLPreview()
      }
    }, 0)
  })
</script>

<div class="relative bg-gray-900 rounded-lg overflow-hidden">
  <div class="flex items-center justify-between px-3 py-2 bg-red-200">
    <div class="flex items-center gap-3">
      <div class="text-sm text-gray-300 font-mono">{$appName || language}</div>
    </div>

    <div class="flex items-center gap-3">
      {#if isHTML}
        <div class="flex items-center bg-gray-800 rounded-md overflow-hidden">
          <button
            class="px-3 py-1 text-sm {!showPreview
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'}"
            on:click={() => (showPreview = false)}
          >
            Code
          </button>
          <button
            class="px-3 py-1 text-sm {showPreview
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'}"
            on:click={() => (showPreview = true)}
            disabled={!isHTMLComplete}
          >
            <div class="flex items-center gap-2">
              Preview
              {#if !isHTMLComplete}
                <Icon name="spinner" size="12px" class="animate-spin" color="white" />
              {/if}
            </div>
          </button>
        </div>
      {/if}

      <div class="flex items-center gap-2">
        {#if isJS}
          <button
            use:tooltip={{ text: 'Execute Code', position: 'left' }}
            class="flex items-center text-gray-500 p-1 rounded-md hover:bg-gray-600 hover:text-white transition-colors"
            on:click={() => executeJavaScript()}
            disabled={isExecuting}
          >
            <div class="flex items-center gap-1">
              <Icon
                name={isExecuting ? 'spinner' : 'play'}
                size="16px"
                class={isExecuting ? 'animate-spin' : ''}
              />
            </div>
          </button>
        {:else if showPreview}
          <button
            use:tooltip={{ text: 'Reload App', position: 'left' }}
            class="flex items-center text-gray-500 p-1 rounded-md hover:bg-gray-600 hover:text-white transition-colors"
            on:click={() => reloadApp()}
          >
            <div class="flex items-center gap-1">
              {#if $appIsLoading}
                <Icon name="spinner" size="16px" />
              {:else}
                <Icon name="reload" size="16px" />
              {/if}
            </div>
          </button>
        {/if}

        <button
          use:tooltip={{ text: 'Copy Code', position: 'left' }}
          class="flex items-center text-gray-500 p-1 rounded-md hover:bg-gray-600 hover:text-white transition-colors"
          on:click={handleCopyClick}
        >
          <IconConfirmation bind:this={copyIcon} name="copy" size="16px" />
        </button>

        <button
          use:tooltip={{ text: 'Save to Stuff', position: 'left' }}
          class="flex items-center text-gray-500 p-1 rounded-md hover:bg-gray-600 hover:text-white transition-colors"
          on:click={handleSaveApp}
        >
          <IconConfirmation bind:this={saveIcon} name="save" size="16px" />
        </button>
      </div>
    </div>
  </div>

  <div class={isHTML && showPreview ? 'hidden' : ''}>
    <pre bind:this={elem}><slot /></pre>
  </div>

  {#if isHTML && showPreview}
    <div bind:this={appContainer} class="bg-white" />
  {/if}

  {#if isJS && jsOutput}
    <div class="border-t border-gray-800">
      <div class="p-4 font-mono text-sm whitespace-pre-wrap">
        {jsOutput}
      </div>
    </div>
  {/if}
</div>
