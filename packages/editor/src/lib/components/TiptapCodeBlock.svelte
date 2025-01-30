<script lang="ts">
  import { Icon, IconConfirmation } from '@horizon/icons'
  import { copyToClipboard, formatCodeLanguage, tooltip } from '@horizon/utils'
  import { afterUpdate, onMount } from 'svelte'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import { all, createLowlight } from 'lowlight'
  import { toHtml } from 'hast-util-to-html'

  export let node

  let codeElem: HTMLElement
  let copyIcon: Icon
  let appContainer: HTMLDivElement
  let isHTML: boolean = false
  let isJS: boolean = false
  let showPreview: boolean = false
  let jsOutput: string = ''
  let isExecuting: boolean = false

  $: language = node.attrs.language ?? 'plaintext'
  $: codeContent = node.attrs.code ?? ''

  const lowlight = createLowlight(all)
  const highlightCode = () => {
    if (!codeElem || !codeContent || !language) return

    try {
      const tree = lowlight.highlight(language, codeContent)
      codeElem.innerHTML = toHtml(tree)
    } catch (error) {
      codeElem.textContent = codeContent
    }
  }

  const getCode = () => {
    return codeContent
  }

  const handleCopyClick = () => {
    const code = getCode()
    copyToClipboard(code)
    copyIcon.showConfirmation()
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
    isHTML = language === 'html'
    isJS = language === 'javascript' || language === 'typescript'
  }

  const renderHTMLPreview = () => {
    if (!isHTML || !appContainer) return

    const code = getCode()
    if (!code) return

    appContainer.innerHTML = ''

    const webview = document.createElement('webview')
    // @ts-ignore
    webview.nodeintegration = false
    // @ts-ignore
    webview.webpreferences = 'contextIsolation=true'
    webview.style.width = '100%'
    webview.style.height = '600px'
    webview.style.border = 'none'

    appContainer.appendChild(webview)

    // @ts-ignore
    webview.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(code)
  }

  afterUpdate(() => {
    getLanguage()
    highlightCode()

    if (isHTML && showPreview && codeContent) {
      renderHTMLPreview()
    }
  })

  onMount(() => {
    highlightCode()
    setTimeout(() => {
      if (isHTML && showPreview && codeContent) {
        renderHTMLPreview()
      }
    }, 0)
  })
</script>

<NodeViewWrapper>
  <div class="relative bg-gray-900 rounded-xl overflow-hidden">
    <div class="flex items-center justify-between px-3 py-2 bg-gray-950">
      <div class="flex items-center gap-3" contenteditable="false">
        <div class="text-sm text-gray-300 font-mono">{formatCodeLanguage(language)}</div>
        {#if isHTML}
          <div class="flex items-center bg-gray-800 rounded-md overflow-hidden">
            <button
              class="px-3 py-1 text-sm {!showPreview
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-700'}"
              on:click={() => (showPreview = false)}
            >
              Code
            </button>
            <button
              class="px-3 py-1 text-sm {showPreview
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-700'}"
              on:click={() => (showPreview = true)}
            >
              App
            </button>
          </div>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        {#if isJS}
          <button
            use:tooltip={{ text: 'Execute Code', position: 'left' }}
            class="flex items-center text-gray-500 p-1 rounded-md hover:bg-gray-600 hover:text-white transition-colors"
            on:click={executeJavaScript}
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
        {/if}
        <button
          use:tooltip={{ text: 'Copy Code', position: 'left' }}
          class="flex items-center text-gray-500 p-1 rounded-md hover:bg-gray-600 hover:text-white transition-colors"
          on:click={handleCopyClick}
        >
          <IconConfirmation bind:this={copyIcon} name="copy" size="16px" />
        </button>
      </div>
    </div>

    <div class={isHTML && showPreview ? 'hidden' : ''}>
      <pre class="code-block">
        <code bind:this={codeElem} class={language ? `language-${language}` : ''} />
      </pre>
    </div>

    {#if isHTML && showPreview}
      <div bind:this={appContainer} class="bg-white" />
    {/if}

    {#if isJS && jsOutput}
      <div class="border-t border-gray-800">
        <div class="p-4 font-mono text-sm whitespace-pre-wrap text-gray-300">
          {jsOutput}
        </div>
      </div>
    {/if}
  </div>
</NodeViewWrapper>
