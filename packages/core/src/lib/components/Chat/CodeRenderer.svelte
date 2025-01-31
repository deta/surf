<script lang="ts">
  import { Icon, IconConfirmation } from '@horizon/icons'
  import {
    codeLanguageToMimeType,
    conditionalArrayItem,
    copyToClipboard,
    formatCodeLanguage,
    generateHash,
    generateID,
    isModKeyPressed,
    parseUrlIntoCanonical,
    tooltip,
    useDebounce,
    useLogScope
  } from '@horizon/utils'
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import type { WebviewTag } from 'electron'
  import { all, createLowlight } from 'lowlight'
  import { toHtml } from 'hast-util-to-html'
  import { writable } from 'svelte/store'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'
  import {
    AddResourceToSpaceEventTrigger,
    EventContext,
    ResourceTagsBuiltInKeys,
    SaveToOasisEventTrigger
  } from '@horizon/types'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { ResourceTag } from '@horizon/core/src/lib/service/resources'
  import type { Resource } from '@horizon/core/src/lib/service/resources'
  import SaveToStuffButton from '@horizon/core/src/lib/components/Oasis/SaveToStuffButton.svelte'
  import { SpaceEntryOrigin, type BookmarkTabState } from '@horizon/core/src/lib/types'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { ResourceManager } from '@horizon/core/src/lib/service/resources'
  import type { TabResource } from '@horizon/core/src/lib/types'
  import { openDialog } from '@horizon/core/src/lib/components/Core/Dialog/Dialog.svelte'
  import { createWebviewExtractor } from '@horizon/web-parser'

  export let resource: Resource | undefined = undefined
  export let tab: TabResource | undefined = undefined
  export let language: string = ''
  export let showPreview: boolean = true
  export let initialCollapsed: boolean | 'auto' = 'auto'
  export let fullSize = false
  export let collapsable = true
  export let saveable = true
  export let showUnLink = false

  const log = useLogScope('CodeBlock')
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const oasis = useOasis()
  const toasts = useToasts()

  const dispatch = createEventDispatcher<{ 'link-removed': void }>()

  const generatedName = writable('')
  const customName = writable('')
  const appIsLoading = writable(false)
  const saveState = writable<BookmarkTabState>('idle')

  const id = generateID()
  const WEBVIEW_PARTITION = 'code-preview'

  let copyIcon: IconConfirmation
  let saveIcon: IconConfirmation
  let copyOutputIcon: IconConfirmation

  let preElem: HTMLPreElement
  let appContainer: HTMLDivElement
  let inputElem: HTMLInputElement
  let codeBlockELem: HTMLElement

  let observer: MutationObserver | null = null

  let isHTMLComplete: boolean = false
  let codeContent: string = ''
  let jsOutput: string = ''
  let isExecuting: boolean = false
  let noResourceFound = false
  let collapsed = initialCollapsed === 'auto' ? true : initialCollapsed

  $: isHTML = language === 'html'
  $: isHTMLApp = isHTML && hasHTMLOpening(codeContent)
  $: isJS = language === 'javascript' || language === 'typescript'
  $: formattedLanguage = formatCodeLanguage(language)

  $: generationStatus = getGenerationStatus(codeContent, language)
  $: stillGenerating = !resource && (isHTMLApp || !codeContent) && !isHTMLComplete

  $: silentResource =
    resource && (resource.tags ?? []).some((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)

  $: if (showPreview && !collapsed && isHTMLApp && !stillGenerating) {
    renderHTMLPreview()
  } else if (!collapsed && resource) {
    highlightCode()
  }

  $: if (tab && tab.title !== $customName) {
    customName.set(tab.title)
  }

  $: if (resource && !silentResource && $saveState === 'idle') {
    saveState.set('saved')
  }

  $: if (stillGenerating) {
    collapsed = true
  }

  // funny messages for the user
  const scriptingMessages = [
    'Writing the logic…',
    'Wiring things up…',
    'Adding interactivity…',
    'Creating the brain…',
    'Making it smart…',
    'Adding some magic…'
  ]

  const stylingMessages = [
    'Styling the artifact…',
    'Making it pretty…',
    'Designing the look…',
    'Creating the visuals…',
    'Painting the pixels…',
    'Adding some flair…'
  ]

  const templatingMessages = [
    'Creating the UI…',
    'Building the layout…',
    'Designing the structure…',
    'Placing the elements…'
  ]

  const generatingMessages = [
    'Preparing the environment…',
    'Setting up the workspace…',
    'Getting things ready…',
    'Starting the magic…',
    'Planning the creation…'
  ]

  const getGenerationStatus = (raw: string, language: string) => {
    if (language !== 'html') return 'complete'

    const code = raw.trim()
    if (code === '') return 'empty'

    const hasStartTag = (tag: string) => code.includes(`<${tag}>`)
    const hasEndTag = (tag: string) => code.includes(`</${tag}>`)

    if (code.endsWith('</html>')) return 'complete'
    if (hasStartTag('script') && !hasEndTag('script')) return 'scripting'
    if (hasEndTag('script') && hasEndTag('style')) return 'templating'
    if (hasEndTag('style') && !hasStartTag('script')) return 'templating'
    if (hasStartTag('style') && !hasEndTag('style')) return 'styling'

    return 'incomplete'
  }

  const getRandomStatusMessage = (status: string) => {
    if (status === 'scripting') {
      return scriptingMessages[Math.floor(Math.random() * scriptingMessages.length)]
    } else if (status === 'styling') {
      return stylingMessages[Math.floor(Math.random() * stylingMessages.length)]
    } else if (status === 'templating') {
      return templatingMessages[Math.floor(Math.random() * templatingMessages.length)]
    } else {
      return generatingMessages[Math.floor(Math.random() * generatingMessages.length)]
    }
  }

  const hasHTMLOpening = (raw: string) => {
    const code = raw.trim().toLowerCase()

    // check if it starts with the html doctype or an html tag
    // we also check the other way around because the code might still be generating
    return (
      code.startsWith('<!doctype html>') ||
      '<!doctype html>'.startsWith(code) ||
      '<html '.startsWith(code)
    )
  }

  const showCodeView = () => {
    showPreview = false
    collapsed = false
  }

  const showPreviewView = () => {
    showPreview = true

    if (stillGenerating) {
      collapsed = true
    } else if (isHTML) {
      renderHTMLPreview()
    } else if (isJS) {
      if (jsOutput) {
        collapsed = false
      } else {
        executeJavaScript()
      }
    }
  }

  const getResourceCode = async () => {
    try {
      if (!resource) return null

      $customName = resource?.metadata?.name || ''

      const blob = await resource.getData()
      if (!blob) return null

      const text = await blob.text()

      return text || null
    } catch (error: any) {
      log.error('Error getting resource code', error)
      return null
    }
  }

  const getInlineCode = () => {
    const codeElem = preElem?.querySelector('code')
    if (!codeElem) return null
    return codeElem.textContent || null
  }

  const getCode = async () => {
    let content: string | null = null
    if (resource) {
      if (codeContent) return codeContent
      content = await getResourceCode()
      makeCodeEditable()
    } else {
      content = getInlineCode()
    }

    if (content) {
      if (language === 'html') {
        // parse title from HTML
        const titleMatch = content.match(/<title>(.*?)<\/title>/)
        if (titleMatch) {
          $generatedName = titleMatch[1]
        } else {
          // parse first h1 as fallback
          const h1Match = content.match(/<h1>(.*?)<\/h1>/)
          if (h1Match) {
            $generatedName = h1Match[1]
          } else {
            $generatedName = `${formatCodeLanguage(language)} Snippet`
          }
        }
      } else {
        $generatedName = `${formatCodeLanguage(language)} Snippet`
      }
    }

    // codeContent = content || ''

    return content
  }

  const isEndOfOutput = (code: string) => {
    return code.trim().endsWith('</html>')
  }

  const lowlight = createLowlight(all)
  const highlightCode = () => {
    log.debug('highlightCode', { language, codeContent, preElem })
    if (!preElem || !codeContent || !language) return

    try {
      const tree = lowlight.highlight(language, codeContent)
      const code = document.createElement('code')
      code.className = `hljs language-${language}`
      code.setAttribute('contenteditable', 'true')
      code.setAttribute('spellcheck', 'false')
      code.setAttribute('tabindex', '0')
      code.innerHTML = toHtml(tree)
      preElem.innerHTML = ''
      preElem.appendChild(code)
    } catch (error) {
      preElem.textContent = codeContent
    }
  }

  const makeCodeEditable = () => {
    const codeElem = preElem?.querySelector('code')
    if (!codeElem) return

    codeElem.setAttribute('contenteditable', 'true')
    codeElem.setAttribute('spellcheck', 'false')
    codeElem.setAttribute('tabindex', '0')
  }

  const handleCopyCode = async () => {
    const code = await getCode()
    copyToClipboard(code)
    copyIcon.showConfirmation()
  }

  const handleCopyOutput = () => {
    copyToClipboard(jsOutput)
    copyOutputIcon.showConfirmation()
  }

  const changeResourceName = useDebounce(async (name: string) => {
    if (!resource) return
    await resourceManager.updateResourceMetadata(resource.id, { name })
    tabsManager.updateResourceTabs(resource.id, { title: name })
  }, 300)

  const saveAppAsResource = async (spaceId?: string, silent = false) => {
    try {
      if (!silent) {
        saveState.set('in_progress')
      }

      const tab = tabsManager.activeTabValue
      const rawUrl = tab?.type === 'page' ? tab.currentLocation || tab.initialLocation : undefined
      const url = (rawUrl ? parseUrlIntoCanonical(rawUrl) : undefined) || undefined

      const code = await getCode()
      if (!code) {
        log.debug('No code to save')
        if (!silent) {
          saveState.set('idle')
        }
        return
      }

      if (!resource) {
        log.debug('Saving app', language, url, { code })

        resource = await resourceManager.createCodeResource(
          {
            code,
            name: $generatedName || formattedLanguage,
            language,
            url: url
          },
          undefined,
          [...conditionalArrayItem(silent, ResourceTag.silent())]
        )

        await oasis.telemetry.trackSaveToOasis(
          resource.type,
          SaveToOasisEventTrigger.Click,
          !!spaceId,
          EventContext.Chat
        )
      } else if (!silent) {
        await resourceManager.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.SILENT)
      }

      log.debug('Saved app', resource)

      if (!resource) {
        if (!silent) {
          saveState.set('error')
        }
        return
      }

      if (spaceId) {
        await oasis.addResourcesToSpace(spaceId, [resource.id], SpaceEntryOrigin.ManuallyAdded)
        await oasis.telemetry.trackAddResourceToSpace(
          resource.type,
          AddResourceToSpaceEventTrigger.Chat
        )
      }

      if (!silent) {
        saveState.set('saved')
        toasts.success(spaceId ? 'Saved to Context!' : 'Saved to Stuff!')
      }

      return resource
    } catch (error: any) {
      log.error('Error saving app', error)

      if (!silent) {
        saveState.set('error')
      }
    }
  }

  const handleOpenAsTab = async (e: MouseEvent) => {
    if (resource) {
      tabsManager.openResourceAsTab(resource, {
        active: !isModKeyPressed(e)
      })
    } else {
      resource = await saveAppAsResource(undefined, true)
      if (resource) {
        tabsManager.openResourceAsTab(resource, {
          active: !isModKeyPressed(e)
        })
      }
    }
  }

  const handleUnLink = async () => {
    const tab = tabsManager.activeTabValue
    const rawUrl = tab?.type === 'page' ? tab.currentLocation || tab.initialLocation : undefined
    const url = (rawUrl ? parseUrlIntoCanonical(rawUrl) : undefined) || undefined

    if (!url || !resource) return

    const confirmed = await openDialog({
      title: 'Remove Link with Current Page',
      message: `Are you sure you want to remove the link between "${$customName}" and the currently open page?`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Remove Link', type: 'submit', kind: 'danger' }
      ]
    })

    if (!confirmed) {
      log.debug('Unlink canceled')
      return
    }

    const matchingTags = (resource.tags ?? []).filter(
      (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL && tag.value === url
    )

    if (matchingTags.length === 0) return

    log.debug('Deleting resource tags to unlink it', resource, matchingTags)
    for await (const tag of matchingTags) {
      if (tag.id) {
        await resourceManager.deleteResourceTagByID(resource.id, tag.id)
      }
    }

    dispatch('link-removed')
  }

  const executeJavaScript = async () => {
    const webview = createWebviewExtractor('about:blank', document, WEBVIEW_PARTITION)

    try {
      const code = await getCode()
      if (!code) return

      showPreview = true
      collapsed = false

      isExecuting = true
      jsOutput = ''

      await webview.initializeWebview(5000)

      const output = await webview.executeJavaScript(code)
      const messages = await webview.getConsoleMessages()

      const consoleOutput = messages.join('\n')

      log.debug('JavaScript output', output)
      log.debug('Console output', consoleOutput)

      jsOutput = output || consoleOutput
    } catch (error: any) {
      jsOutput = `Error: ${error.message}`
    } finally {
      isExecuting = false
      webview.destroyWebview()
    }
  }

  const getLanguage = () => {
    if (language) return language

    const codeElem = preElem?.querySelector('code')
    if (!codeElem) return

    const langClass = codeElem.className.split(' ').find((c) => c.startsWith('language-'))
    if (langClass) {
      const lang = langClass.replace('language-', '')
      language = lang
      return language
    }
  }

  const renderHTMLPreview = async () => {
    await tick()
    if (!isHTML || !appContainer) {
      log.debug('Not HTML or no app container')
      return
    }

    const code = await getCode()
    if (!code) {
      log.debug('No code')
      return
    }

    log.debug('Rendering HTML preview', language, { code })

    appContainer.innerHTML = ''

    const webview = document.createElement('webview') as WebviewTag
    // @ts-ignore
    webview.nodeintegration = false
    // @ts-ignore
    webview.webpreferences = 'contextIsolation=true, sandbox=true'
    webview.style.width = '100%'
    webview.style.height = '100%'
    webview.style.border = 'none'
    webview.partition = WEBVIEW_PARTITION

    webview.addEventListener('page-title-updated', (e) => {
      $generatedName = e.title
    })

    webview.addEventListener('did-start-loading', () => appIsLoading.set(true))
    webview.addEventListener('did-stop-loading', () => appIsLoading.set(false))

    appContainer.appendChild(webview)

    // @ts-ignore
    webview.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(code)
  }

  const reloadApp = async () => {
    if (isHTML && showPreview) {
      if (resource) {
        const code = await getResourceCode()
        if (code) {
          codeContent = code
        }
      }

      renderHTMLPreview()
    }
  }

  const handleInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement

    if (target.value === $customName) return

    if (target.value === '') {
      customName.set('')
      changeResourceName($generatedName)
      return
    }

    customName.set(target.value)
    changeResourceName(target.value)
  }

  const handleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      inputElem.blur()
    }
  }

  const handleInputBlur = (event: Event) => {
    const target = event.target as HTMLInputElement
    const value = target.value
    log.debug('Input blur', { value, customName: $customName, generatedName: $generatedName })
    if (value === '') {
      customName.set($generatedName)
      inputElem.value = $generatedName
    }
  }

  const handleEndOfOutput = async () => {
    log.debug('End of output')
    isHTMLComplete = true
    showPreview = true

    if (!initialCollapsed) {
      collapsed = false
    }

    if (!resource && !noResourceFound) {
      const code = await getCode()
      if (!code) return

      const hash = await generateHash(code)
      const type = codeLanguageToMimeType(language)

      const resources = await resourceManager.listResourcesByTags([
        ResourceManager.SearchTagDeleted(false),
        ResourceManager.SearchTagResourceType(type),
        ResourceManager.SearchTagContentHash(hash),
        ResourceManager.SearchTagSavedWithAction('generated')
      ])

      log.debug('Found resources by hash', resources)

      if (resources.length > 0) {
        resource = resources[0]

        if (resource.metadata?.name) {
          customName.set(resource.metadata.name)
        }

        const isSilent = (resource.tags ?? []).some(
          (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
        )
        if (!isSilent) {
          saveState.set('saved')
        }
      } else {
        noResourceFound = true
      }
    }

    await tick()
    makeCodeEditable()
  }

  const handleContentStream = useDebounce(async () => {
    const code = await getCode()
    if (!code || code.trim() === '') return

    if (!language) {
      getLanguage()
    }

    // if (code === codeContent) {
    //   log.debug('Code content did not change', {code, codeContent})
    //   return
    // }

    if (language === 'html' && !isHTMLComplete) {
      isHTMLComplete = isEndOfOutput(code)
      if (isHTMLComplete) {
        log.debug('HTML is complete, switching to preview')
        observer?.disconnect()
        observer = null
        handleEndOfOutput()
      } else if (!hasHTMLOpening(code)) {
        log.debug('code is not an html app, switching to code view')
        if (showPreview) {
          showCodeView()
        }

        makeCodeEditable()
      }
    } else {
      makeCodeEditable()
    }

    codeContent = code
  }, 15)

  const updateResourceContent = useDebounce(async (value: string) => {
    if (!resource) return

    log.debug('Updating resource content', { value })

    const blob = new Blob([value], { type: resource.type })
    await resource.updateData(blob, true)
  })

  const handleCodeInput = (e: Event) => {
    const target = e.target as HTMLElement
    const code = target.textContent

    if (!code) return

    codeContent = code

    if (resource) {
      updateResourceContent(code)
    }
  }

  const findResponsesWrapper = () => {
    let parent = codeBlockELem.parentElement
    while (parent) {
      if (parent.id.startsWith('chat-responses-')) {
        return parent
      }
      parent = parent.parentElement
    }

    return null
  }

  const checkIfShouldBeExpanded = () => {
    // walk up the tree from codeBlockElem until you find the chat response wrapper with an id that starts with chat-responses-
    const wrapper = findResponsesWrapper()

    log.debug('wrapper', wrapper)
    if (!wrapper) return false

    // get all the code blocks in the wrapper
    const codeBlocks = wrapper?.querySelectorAll('code-block')
    log.debug('codeBlocks', codeBlocks)
    if (!codeBlocks) return false

    // check what index this code block is in the list of code blocks
    const index = Array.from(codeBlocks).indexOf(codeBlockELem)

    // if we are the last code block, we should be expanded
    return index === codeBlocks.length - 1
  }

  onMount(async () => {
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          handleContentStream()
        }
      })
    })

    observer.observe(preElem, { childList: true, subtree: true })

    if (initialCollapsed === 'auto') {
      const autoExpanded = checkIfShouldBeExpanded()
      log.debug('autoExpanded', autoExpanded)
      initialCollapsed = !autoExpanded
    }

    const lang = getLanguage()

    const code = await getCode()
    if (code) {
      codeContent = code
    }

    if (
      resource &&
      !(resource.tags ?? []).some((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)
    ) {
      saveState.set('saved')
    }

    log.debug('CodeRenderer mounted', { lang, showPreview, code, resource, initialCollapsed })

    if (lang === 'html' && code) {
      if (isEndOfOutput(code)) {
        handleEndOfOutput()

        if (showPreview) {
          renderHTMLPreview()
        }
      } else if (initialCollapsed) {
        collapsed = true
      } else if (!hasHTMLOpening(code)) {
        showCodeView()
        makeCodeEditable()
      }
    } else if (code) {
      highlightCode()
    }
  })

  onDestroy(() => {
    if (observer) {
      observer.disconnect()
    }
  })
</script>

<code-block
  bind:this={codeBlockELem}
  id="code-block-{id}"
  data-resource={resource ? resource.id : undefined}
  data-language={language}
  data-name={$customName || $generatedName}
  class="relative bg-gray-900 rounded-xl flex flex-col overflow-hidden w-full {fullSize ||
  collapsed ||
  isJS
    ? ''
    : 'h-full max-h-[750px]'} {fullSize ? 'h-full' : ''}"
>
  <header class="flex-shrink-0 flex items-center justify-between gap-3 p-2">
    <div class="flex items-center gap-1 w-full">
      {#if collapsable}
        <button
          class="text-sm flex items-center gap-2 p-1 rounded-md hover:bg-gray-500/30 transition-colors opacity-40"
          on:click={() => (collapsed = !collapsed)}
        >
          {#if stillGenerating}
            <Icon name="spinner" />
          {:else}
            <Icon
              name="chevron.right"
              className="{!collapsed ? 'rotate-90' : ''} transition-transform duration-75"
            />
          {/if}
        </button>
      {/if}

      <div class="w-full">
        {#if stillGenerating}
          <div class=" flex-shrink-0">
            {getRandomStatusMessage(generationStatus)}
          </div>
        {:else}
          <input
            bind:this={inputElem}
            on:input={handleInputChange}
            on:keydown={handleInputKeydown}
            on:blur={handleInputBlur}
            value={$customName || $generatedName || language}
            placeholder="Name"
            class="text-base font-medium bg-gray-800 w-full rounded-md p-1 bg-transparent focus:outline-none opacity-60 focus:opacity-100"
          />
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-3">
      {#if (isHTML || isJS) && (!collapsed || stillGenerating)}
        <div class="preview-group flex items-center rounded-md overflow-hidden">
          <button
            class="no-custom px-3 py-1 text-sm"
            on:click={() => showCodeView()}
            class:active={!showPreview}
          >
            Code
          </button>
          <button
            class="no-custom px-3 py-1 text-sm"
            on:click={() => showPreviewView()}
            class:active={showPreview}
          >
            <div class="flex items-center gap-2">
              {#if isHTML}
                Preview
              {:else}
                Output
              {/if}
            </div>
          </button>
        </div>
      {/if}

      {#if !stillGenerating}
        {#if collapsed}
          <div class="flex items-center gap-1">
            {#if isJS}
              <button
                use:tooltip={{ text: 'Execute Code', position: 'left' }}
                class="flex items-center p-1 rounded-md transition-colors"
                on:click={() => executeJavaScript()}
                disabled={isExecuting}
              >
                <div class="flex items-center gap-1">
                  <Icon
                    name={isExecuting ? 'spinner' : 'play'}
                    size="16px"
                    class={isExecuting ? 'animate-spin' : ''}
                  />

                  <div class="text-sm">Run</div>
                </div>
              </button>
            {:else}
              <div class="p-1 opacity-60">
                {#if language === 'html'}
                  <Icon name="world" />
                {:else}
                  <Icon name="code" />
                {/if}
              </div>
            {/if}
            {#if showUnLink && resource}
              <button
                on:click={handleUnLink}
                use:tooltip={{ text: 'Unlink from page', position: 'left' }}
                class="flex items-center p-1 rounded-md transition-colors"
              >
                <Icon name="close" />
              </button>
            {/if}
          </div>
        {:else}
          <div class="flex items-center gap-2">
            {#if !stillGenerating && saveable}
              <SaveToStuffButton
                state={saveState}
                side="left"
                className="flex items-center  p-1 rounded-md  transition-colors"
                on:save={(e) => saveAppAsResource(e.detail, false)}
              />
            {/if}

            {#if isJS}
              {#if !showPreview}
                <button
                  use:tooltip={{ text: 'Copy Code', position: 'left' }}
                  class="flex items-center p-1 rounded-md transition-colors"
                  on:click={handleCopyCode}
                >
                  <IconConfirmation bind:this={copyIcon} name="copy" size="16px" />
                </button>
              {:else}
                <button
                  use:tooltip={{ text: 'Copy Output', position: 'left' }}
                  class="flex items-center text-gray-400 p-1 rounded-md transition-colors"
                  on:click={handleCopyOutput}
                >
                  <IconConfirmation bind:this={copyOutputIcon} name="copy" size="16px" />
                </button>
              {/if}
              <button
                use:tooltip={{ text: 'Execute Code', position: 'left' }}
                class="flex items-center p-1 rounded-md transition-colors"
                on:click={() => executeJavaScript()}
                disabled={isExecuting}
              >
                <div class="flex items-center gap-1">
                  {#if isExecuting}
                    <Icon name="spinner" size="16px" />
                  {:else if jsOutput && showPreview}
                    <Icon name="reload" size="16px" />
                  {:else}
                    <Icon name="play" size="16px" />
                  {/if}
                </div>
              </button>
            {:else if isHTML}
              {#if showPreview}
                <button
                  use:tooltip={{ text: 'Reload', position: 'left' }}
                  class="flex items-center p-1 rounded-md transition-colors"
                  on:click={() => reloadApp()}
                >
                  <div class="flex items-center gap-1">
                    {#if $appIsLoading || stillGenerating}
                      <Icon name="spinner" size="16px" />
                    {:else}
                      <Icon name="reload" size="16px" />
                    {/if}
                  </div>
                </button>
              {:else}
                <button
                  use:tooltip={{ text: 'Copy Code', position: 'left' }}
                  class="flex items-center p-1 rounded-md transition-colors"
                  on:click={handleCopyCode}
                >
                  <IconConfirmation bind:this={copyIcon} name="copy" size="16px" />
                </button>
              {/if}
            {/if}

            {#if !stillGenerating}
              <button
                use:tooltip={{ text: 'Open as Tab', position: 'left' }}
                class="flex items-center p-1 rounded-md transition-colors"
                on:click={handleOpenAsTab}
              >
                <Icon name="arrow.up.right" size="16px" />
              </button>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  </header>

  <div
    class="w-full flex-grow overflow-hidden {showPreview || collapsed ? 'hidden' : ''} {isHTML &&
    !fullSize &&
    !collapsed
      ? 'h-[750px]'
      : ''}"
  >
    <pre
      bind:this={preElem}
      class="h-full overflow-auto code-wrapper"
      style="color: white;"
      on:input={handleCodeInput}><slot>{codeContent}</slot></pre>
  </div>

  {#if showPreview && !collapsed}
    {#if isHTML}
      <div
        bind:this={appContainer}
        class="bg-white w-full flex-grow overflow-auto {fullSize || collapsed ? '' : 'h-[750px]'}"
      />
    {:else if isJS}
      <footer class="p-3 {fullSize && !collapsed ? 'h-full' : ''}">
        <div class="font-mono text-sm whitespace-pre-wrap w-full">
          {#if isExecuting}
            Running code…
          {:else if jsOutput}
            {jsOutput}
          {:else}
            no output, click run to execute code
          {/if}
        </div>
      </footer>
    {/if}
  {/if}
</code-block>

<style lang="scss">
  :global(.code-wrapper code.hljs) {
    overflow: unset;
    outline: none;
  }

  code-block {
    border: 1px solid light-dark(#bbb, #444);
  }

  header,
  footer {
    color: var(--contrast-color);

    :global(body.custom) & {
      background: var(--fill);
      color: var(--contrast-color);

      border-bottom: 1px solid color-mix(in srgb, var(--base-color), 5% light-dark(black, white));
    }

    :global(button:not(.no-custom):not([data-melt-dropdown-menu-trigger])) {
      color: var(--contrast-color);
      opacity: 0.75;

      &:hover {
        opacity: 1;
        background: light-dark(var(--black-09), var(--white-26)) !important;
      }
    }
  }

  header {
    @include utils.light-dark-custom(
      'background-fill-mix',
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1),
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1)
    );
    @include utils.light-dark-custom(
      'fill',
      #f3faff,
      rgb(29 33 44),
      color-mix(in srgb, var(--base-color), 70% var(--background-fill-mix)),
      color-mix(in srgb, var(--base-color), 40% var(--background-fill-mix))
    );

    background: var(--fill);
  }

  footer {
    @include utils.light-dark-custom(
      'background-fill-mix',
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1),
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1)
    );
    @include utils.light-dark-custom(
      'fill',
      #eaf3fa,
      rgb(29 33 44),
      color-mix(in srgb, var(--base-color), 70% var(--background-fill-mix)),
      color-mix(in srgb, var(--base-color), 40% var(--background-fill-mix))
    );

    background: var(--fill);
  }

  .preview-group {
    @include utils.light-dark-custom(
      'background-fill-mix',
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1),
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1)
    );
    @include utils.light-dark-custom(
      'fill',
      color-mix(in srgb, #f3faff, 7% black),
      color-mix(in srgb, rgb(29 33 44), 8% white),
      color-mix(in srgb, var(--base-color), 40% var(--background-fill-mix)),
      color-mix(in srgb, var(--base-color), 5% var(--background-fill-mix))
    );

    button {
      background: var(--fill);
      color: var(--contrast-color);
      border: none;

      &.active {
        @include utils.light-dark-custom(
          'fill',
          color-mix(in srgb, #f3faff, 15% black),
          color-mix(in srgb, rgb(29 33 44), 15% white),
          color-mix(in srgb, var(--base-color), 5% var(--background-fill-mix)),
          color-mix(in srgb, var(--base-color), 60% var(--background-fill-mix))
        );
      }
    }
  }
</style>
