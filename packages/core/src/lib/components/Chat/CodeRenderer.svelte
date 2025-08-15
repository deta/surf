<script lang="ts">
  import { Icon, IconConfirmation } from '@deta/icons'
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
    useLogScope,
    getFormattedDate,
    cropImageToContent,
    optimisticParseJSON
  } from '@deta/utils'

  import { dataUrltoBlob } from '@horizon/core/src/lib/utils/screenshot'

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
  } from '@deta/types'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import type { Resource } from '@horizon/core/src/lib/service/resources'
  import SaveToStuffButton from '@horizon/core/src/lib/components/Oasis/SaveToStuffButton.svelte'
  import {
    DragTypeNames,
    SpaceEntryOrigin,
    type BookmarkTabState
  } from '@horizon/core/src/lib/types'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { useToasts } from '@deta/ui'
  import type {
    DragTypes,
    ResourceTagsBuiltIn,
    SFFSResourceTag,
    TabResource,
    UserViewPrefsTagValue
  } from '@horizon/core/src/lib/types'
  import { openDialog } from '@horizon/core/src/lib/components/Core/Dialog/Dialog.svelte'
  import { createWebviewExtractor } from '@deta/web-parser'
  import { DragculaDragEvent, HTMLDragItem } from '@horizon/dragcula'
  import { SearchResourceTags, ResourceTag } from '@deta/utils/src/formatting/tags'

  export let resource: Resource | undefined = undefined
  export let tab: TabResource | undefined = undefined
  export let language: string = ''
  export let showPreview: boolean = true
  export let initialCollapsed: boolean | 'auto' = 'auto'
  export let fullSize = false
  export let collapsable = true
  export let saveable = true
  export let showUnLink = false
  export let draggable: boolean = true
  export let resizable: boolean = false
  export let minHeight: string = '200px'
  export let maxHeight: string = '1000px'
  export let initialHeight: string = '400px'
  export let expandable = true
  export let hideHeader = false

  let isResizing = false
  let startY = 0
  let startHeight = 0

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

  let copyIcon: IconConfirmation
  let copyOutputIcon: IconConfirmation

  let preElem: HTMLPreElement
  let appContainer: HTMLDivElement
  let inputElem: HTMLInputElement
  let codeBlockELem: HTMLElement
  let containerHeight = initialHeight
  let webview: WebviewTag | null = null

  let observer: MutationObserver | null = null
  let generatingTimeout: ReturnType<typeof setTimeout> | null = null

  let isHTMLComplete: boolean = false
  let codeContent: string = ''
  let jsOutput: string = ''
  let isExecuting: boolean = false
  let manualGeneratingState = false
  let showHiddenPreview = false
  let collapsed = initialCollapsed === 'auto' ? true : initialCollapsed

  $: isHTML = language === 'html'
  $: isHTMLApp = isHTML && hasHTMLOpening(codeContent)
  $: isJS = language === 'javascript' || language === 'typescript'
  $: formattedLanguage = formatCodeLanguage(language)

  $: generationStatus = getGenerationStatus(codeContent, language)
  $: stillGenerating =
    (!resource && (isHTMLApp || !codeContent) && !isHTMLComplete) || manualGeneratingState

  $: silentResource =
    resource && (resource.tags ?? []).some((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)

  $: if (
    (showPreview || showHiddenPreview) &&
    !collapsed &&
    isHTMLApp &&
    !stillGenerating &&
    expandable
  ) {
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

  // Load saved height from resource tag
  $: if (resource?.tags) {
    const prefs = getUserViewPreferences(resource.tags)
    if (prefs?.blockHeight) {
      containerHeight = prefs.blockHeight
    }

    if (prefs?.blockCollapsed !== undefined) {
      collapsed = prefs.blockCollapsed
    }
  }

  $: updateResourceViewPrefs(containerHeight, collapsed)

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

  const preparingMessages = [
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
    if (language === 'html') {
      if (status === 'scripting') {
        return scriptingMessages[Math.floor(Math.random() * scriptingMessages.length)]
      } else if (status === 'styling') {
        return stylingMessages[Math.floor(Math.random() * stylingMessages.length)]
      } else if (status === 'templating') {
        return templatingMessages[Math.floor(Math.random() * templatingMessages.length)]
      } else {
        return preparingMessages[Math.floor(Math.random() * preparingMessages.length)]
      }
    } else {
      return null
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
    showHiddenPreview = false
    showPreview = false
    collapsed = false
  }

  const showPreviewView = (hidden = false) => {
    if (hidden) {
      showHiddenPreview = true
    } else {
      showPreview = true
    }

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

  const getUserViewPreferences = (tags: SFFSResourceTag[]) => {
    try {
      const prefsTag = tags.find((t) => t.name === ResourceTagsBuiltInKeys.USER_VIEW_PREFS)
      log.debug('User preferences tag', prefsTag)
      if (prefsTag) {
        const prefs = optimisticParseJSON<
          ResourceTagsBuiltIn[ResourceTagsBuiltInKeys.USER_VIEW_PREFS]
        >(prefsTag.value)
        if (!prefs) return null

        return prefs
      }

      return null
    } catch (e) {
      log.error('Failed to parse user preferences:', e)
      return null
    }
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

  const captureWebviewScreenshot = async (): Promise<string | null> => {
    const originalShowPreview = showPreview
    const originalCollapsed = collapsed

    if (!originalShowPreview) {
      showPreviewView(true)
      // when in code mode switch to preview mode to capture the screenshot
      // await tick isn't enough here
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await tick()
    }

    return new Promise((resolve) => {
      if (!appContainer) {
        log.debug('No app container to capture')
        resolve(null)
        return
      }

      webview
        ?.capturePage()
        .then((image) => {
          if (image) {
            const croppedImage = cropImageToContent(image, {
              padding: 0,
              whiteThreshold: 250,
              alphaThreshold: 0
            })

            const screenshotData = croppedImage.toDataURL()
            resolve(screenshotData)
          } else {
            resolve(null)
          }

          if (!originalShowPreview) {
            showCodeView()
            collapsed = originalCollapsed
          }
        })
        .catch(() => {
          resolve(null)
        })
    })
  }

  const updateResourceViewPrefs = useDebounce(async (height: string, collapsed: boolean) => {
    if (!resource?.id) return
    try {
      const prefs = getUserViewPreferences(resource.tags ?? [])

      log.debug('Updating resource view preferences', { height, collapsed }, prefs)

      if (prefs) {
        if (resizable) {
          prefs.blockHeight = height
        }

        if (collapsable) {
          prefs.blockCollapsed = collapsed
        }

        await resourceManager.updateResourceTag(
          resource.id,
          ResourceTagsBuiltInKeys.USER_VIEW_PREFS,
          JSON.stringify(prefs)
        )
      } else {
        const newPrefs = {
          blockHeight: resizable ? height : undefined,
          blockCollapsed: collapsable ? collapsed : undefined
        } as UserViewPrefsTagValue

        await resourceManager.createResourceTag(
          resource.id,
          ResourceTagsBuiltInKeys.USER_VIEW_PREFS,
          JSON.stringify(newPrefs)
        )
      }
    } catch (error) {
      log.error('Failed to update resource height:', error)
    }
  }, 500)

  const saveScreenshot = async (imageData: string): Promise<string> => {
    const blob = dataUrltoBlob(imageData)

    const imageResource = await resourceManager.createResource(
      'image/png',
      blob,
      {
        name: `Screenshot ${getFormattedDate(Date.now())}`
      },
      [ResourceTag.screenshot(), ResourceTag.silent()]
    )

    return imageResource.id
  }

  const saveAppAsResource = async (spaceId?: string, silent = false) => {
    try {
      if (!silent) {
        saveState.set('in_progress')
      }

      const tab = tabsManager?.activeTabValue
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

      let previewImageId: string = ''
      try {
        const screenshotData = await captureWebviewScreenshot()
        if (screenshotData) {
          previewImageId = await saveScreenshot(screenshotData)
        }
      } catch (error) {
        log.error('Error capturing screenshot:', error)
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
          [
            ...conditionalArrayItem(silent, ResourceTag.silent()),
            ...conditionalArrayItem(
              previewImageId !== '',
              ResourceTag.previewImageResource(previewImageId)
            )
          ]
        )

        await oasis.telemetry.trackSaveToOasis(
          resource.type,
          SaveToOasisEventTrigger.Click,
          !!spaceId,
          EventContext.Chat
        )
      } else if (!silent) {
        await resourceManager.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.SILENT)

        const previewImageTag = resource.tags?.find(
          (tag) => tag.name === ResourceTagsBuiltInKeys.PREVIEW_IMAGE_RESOURCE
        )

        if (!previewImageTag && previewImageId) {
          await resourceManager.createResourceTag(
            resource.id,
            ResourceTagsBuiltInKeys.PREVIEW_IMAGE_RESOURCE,
            previewImageId
          )
        } else if (previewImageTag && previewImageId) {
          await resourceManager.updateResourceTag(
            resource.id,
            ResourceTagsBuiltInKeys.PREVIEW_IMAGE_RESOURCE,
            previewImageId
          )
        }
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
    const webview = createWebviewExtractor('about:blank', document, 'inline-js-exec')

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

    webview = document.createElement('webview') as WebviewTag
    // @ts-ignore
    webview.nodeintegration = false
    // @ts-ignore
    webview.webpreferences = 'contextIsolation=true,sandbox=true'
    webview.partition = `persist:horizon`
    webview.style.width = '100%'
    webview.style.height = '100%'
    webview.style.border = 'none'

    webview.addEventListener('page-title-updated', (e) => {
      $generatedName = e.title
    })

    webview.addEventListener('did-start-loading', () => appIsLoading.set(true))
    webview.addEventListener('did-stop-loading', () => appIsLoading.set(false))

    appContainer.appendChild(webview)

    // @ts-ignore
    webview.src = resource
      ? `surflet://${resource?.id}.app.local`
      : `data:text/html;charset=utf-8,${encodeURIComponent(code)}`
  }

  export const reloadApp = async () => {
    if (isHTML && (showPreview || showHiddenPreview)) {
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

    let createSilentResource = true
    if (!resource) {
      const code = await getCode()
      if (!code) return

      const hash = await generateHash(code)
      const type = codeLanguageToMimeType(language)

      const resources = await resourceManager.listResourcesByTags([
        SearchResourceTags.Deleted(false),
        SearchResourceTags.ResourceType(type),
        SearchResourceTags.ContentHash(hash),
        SearchResourceTags.SavedWithAction('generated')
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
        createSilentResource = false
      }
    }
    // always save the resource as a silent resource after output is done
    if (createSilentResource) {
      resource = await saveAppAsResource(undefined, true)
    }
    await tick()
    makeCodeEditable()
  }

  const handleResizeStart = (e: MouseEvent | PointerEvent) => {
    if (!resizable) return

    isResizing = true
    startY = e.clientY
    const container = codeBlockELem?.querySelector('.code-container') as HTMLElement
    startHeight = container?.offsetHeight || parseInt(containerHeight)

    // Capture events on window to prevent losing track during fast movements
    window.addEventListener('mousemove', handleResizeMove, { capture: true })
    window.addEventListener('mouseup', handleResizeEnd, { capture: true })
    window.addEventListener('mouseleave', handleResizeEnd, { capture: true })

    e.preventDefault()
    e.stopPropagation()
  }

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return
    e.preventDefault()
    e.stopPropagation()

    const deltaY = e.clientY - startY
    const newHeight = Math.max(
      parseInt(minHeight),
      Math.min(parseInt(maxHeight), startHeight + deltaY)
    )
    const newHeightPx = `${newHeight}px`
    containerHeight = newHeightPx

    window.getComputedStyle(codeBlockELem).height
  }

  const handleResizeEnd = () => {
    if (!isResizing) return

    isResizing = false
    window.removeEventListener('mousemove', handleResizeMove, { capture: true })
    window.removeEventListener('mouseup', handleResizeEnd, { capture: true })
    window.removeEventListener('mouseleave', handleResizeEnd, { capture: true })
  }

  const handleContentStream = useDebounce(async () => {
    const code = await getCode()
    if (!code || code.trim() === '') return

    if (!language) {
      getLanguage()
    }

    if (!['html', 'javascript', 'typescript'].includes(language)) {
      manualGeneratingState = true

      if (generatingTimeout) {
        clearTimeout(generatingTimeout)
      }

      generatingTimeout = setTimeout(() => {
        manualGeneratingState = false
      }, 1000)
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

  const handleDragStart = async (drag: DragculaDragEvent<DragTypes>) => {
    if (!resource) {
      // unless we create a resource for every code block we have to dynamically create one when the drag is started
      resource = await saveAppAsResource(undefined, true)
    }

    if (resource) {
      const item = drag.item!
      drag.dataTransfer?.setData(DragTypeNames.SURF_RESOURCE_ID, resource.id)
      item.data.setData(DragTypeNames.SURF_RESOURCE, resource)
      item.data.setData(DragTypeNames.SURF_RESOURCE_ID, resource.id)
      drag.continue()
    } else {
      drag.abort()
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

    const lang = getLanguage()
    const code = await getCode()
    if (code) {
      codeContent = code
    }

    if (collapsable) {
      const prefs = getUserViewPreferences(resource?.tags ?? [])
      if (prefs?.blockCollapsed !== undefined && initialCollapsed !== true) {
        initialCollapsed = prefs.blockCollapsed
      } else if (initialCollapsed === 'auto') {
        if (!['html', 'javascript', 'typescript'].includes(lang ?? '')) {
          initialCollapsed = codeContent.trim().split('\n').length > 1
        } else {
          const autoExpanded = checkIfShouldBeExpanded()
          initialCollapsed = !autoExpanded
        }
      }
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
      if (lang !== 'javascript' && lang !== 'typescript') {
        showPreview = false
      }

      if (!initialCollapsed) {
        collapsed = false
      }

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
  class:isResizing
  data-resizable={resizable}
  data-resource={resource ? resource.id : undefined}
  data-language={language}
  data-name={$customName || $generatedName}
  class="relative bg-gray-900 flex flex-col overflow-hidden w-full {fullSize
    ? ''
    : 'rounded-xl'} {fullSize || resizable || collapsed || !isHTML
    ? ''
    : 'h-full max-h-[750px]'} {fullSize ? 'h-full' : ''}"
>
  {#if !hideHeader}
    <header
      class="flex-shrink-0 flex items-center justify-between gap-3 p-2"
      {draggable}
      use:HTMLDragItem.action={{ allowDragStartPropagation: true }}
      on:DragStart={handleDragStart}
    >
      <div class="flex items-center gap-1 w-full">
        {#if collapsable}
          <button
            class="text-sm flex items-center gap-2 p-1 rounded-md hover:bg-gray-500/30 transition-colors opacity-40"
            on:click|stopPropagation={() => (collapsed = !collapsed)}
          >
            {#if stillGenerating}
              <Icon name="spinner" />
            {:else}
              <Icon
                name="chevron.right"
                className="{!collapsed && expandable
                  ? 'rotate-90'
                  : ''} transition-transform duration-75"
              />
            {/if}
          </button>
        {/if}

        <div class="w-full">
          {#if stillGenerating && !manualGeneratingState}
            <div class=" flex-shrink-0">
              {getRandomStatusMessage(generationStatus)}
            </div>
          {:else}
            <input
              bind:this={inputElem}
              on:input={handleInputChange}
              on:keydown={handleInputKeydown}
              on:blur={handleInputBlur}
              on:click|stopPropagation
              value={$customName || $generatedName || language}
              placeholder="Name"
              class="text-base font-medium bg-gray-800 w-full rounded-md p-1 bg-transparent focus:outline-none opacity-60 focus:opacity-100"
            />
          {/if}
        </div>
      </div>

      <div class="flex items-center gap-3">
        {#if (isHTML || isJS) && (!collapsed || stillGenerating) && expandable}
          <div class="preview-group flex items-center rounded-md overflow-hidden">
            <button
              class="no-custom px-3 py-1 text-sm"
              on:click|stopPropagation={() => showPreviewView()}
              class:active={showPreview}
            >
              <div class="flex items-center gap-2">
                {#if isHTML}
                  App
                {:else}
                  Output
                {/if}
              </div>
            </button>
            <button
              class="no-custom px-3 py-1 text-sm"
              on:click|stopPropagation={() => showCodeView()}
              class:active={!showPreview}
            >
              Code
            </button>
          </div>
        {/if}

        {#if !stillGenerating && expandable}
          {#if collapsed}
            <div class="flex items-center gap-1">
              {#if isJS}
                <button
                  use:tooltip={{ text: 'Execute Code', position: 'left' }}
                  class="flex items-center p-1 rounded-md transition-colors"
                  on:click|stopPropagation={() => executeJavaScript()}
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
                  on:click|stopPropagation={handleUnLink}
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
                  {resource}
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
                    on:click|stopPropagation={handleCopyCode}
                  >
                    <IconConfirmation bind:this={copyIcon} name="copy" size="16px" />
                  </button>
                {:else}
                  <button
                    use:tooltip={{ text: 'Copy Output', position: 'left' }}
                    class="flex items-center text-gray-400 p-1 rounded-md transition-colors"
                    on:click|stopPropagation={handleCopyOutput}
                  >
                    <IconConfirmation bind:this={copyOutputIcon} name="copy" size="16px" />
                  </button>
                {/if}
                <button
                  use:tooltip={{ text: 'Execute Code', position: 'left' }}
                  class="flex items-center p-1 rounded-md transition-colors"
                  on:click|stopPropagation={() => executeJavaScript()}
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
                    on:click|stopPropagation={() => reloadApp()}
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
                    on:click|stopPropagation={handleCopyCode}
                  >
                    <IconConfirmation bind:this={copyIcon} name="copy" size="16px" />
                  </button>
                {/if}
              {:else}
                <button
                  use:tooltip={{ text: 'Copy Code', position: 'left' }}
                  class="flex items-center p-1 rounded-md transition-colors"
                  on:click|stopPropagation={handleCopyCode}
                >
                  <IconConfirmation bind:this={copyIcon} name="copy" size="16px" />
                </button>
              {/if}

              {#if !stillGenerating}
                <button
                  use:tooltip={{ text: 'Open as Tab', position: 'left' }}
                  class="flex items-center p-1 rounded-md transition-colors"
                  on:click|stopPropagation={handleOpenAsTab}
                >
                  <Icon name="arrow.up.right" size="16px" />
                </button>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </header>
  {/if}

  <div
    class="code-container w-full flex-grow overflow-hidden {showPreview || collapsed || !expandable
      ? 'hidden'
      : ''} {isHTML && !fullSize && !collapsed && !resizable ? 'h-[750px]' : ''}"
    style={resizable && !fullSize && !collapsed
      ? `height: ${containerHeight}; min-height: ${minHeight}; ${!resizable && !fullSize ? `max-height: ${maxHeight};` : ''}`
      : ''}
  >
    <pre
      bind:this={preElem}
      class="h-full overflow-auto code-wrapper"
      style="color: white;"
      role="none"
      on:input={handleCodeInput}
      on:click|stopPropagation><slot>{codeContent}</slot></pre>
  </div>

  {#if (showPreview || showHiddenPreview) && !collapsed && expandable}
    {#if isHTML}
      <div
        bind:this={appContainer}
        class="bg-white w-full flex-grow overflow-auto {fullSize || resizable || collapsed
          ? ''
          : 'h-[750px]'} {showHiddenPreview ? 'opacity-0' : ''}"
        style={resizable && !fullSize && !collapsed ? `height: ${containerHeight};` : ''}
      />
    {:else if isJS}
      <footer class="p-3 {fullSize && !collapsed ? 'h-full' : ''}">
        <div class="font-mono text-sm whitespace-pre-wrap w-full">
          {#if isExecuting}
            Running code…
          {:else if jsOutput}
            {jsOutput}
          {:else}
            no output, click the play button to run the code
          {/if}
        </div>
      </footer>
    {/if}
  {/if}
  {#if resizable && !collapsed}
    <div
      class="resize-handle"
      role="none"
      on:mousedown|stopPropagation={handleResizeStart}
      on:touchstart|preventDefault={handleResizeStart}
    />
  {/if}
</code-block>

<style lang="scss">
  @use '@horizon/core/src/lib/styles/utils' as utils;

  :global(.code-wrapper code.hljs) {
    overflow: unset;
    outline: none;
  }

  :global(body:has(code-block.isResizing)) {
    cursor: ns-resize;
    user-select: none;
    pointer-events: none;

    code-block.isResizing .resize-handle {
      pointer-events: auto;
    }
  }

  // Prevent drag preview from being too large
  :global(code-block[data-drag-preview]) {
    width: var(--drag-width) !important;
    height: var(--drag-height) !important;
  }

  code-block {
    border: 1px solid light-dark(#bbb, #444);
    position: relative;

    &[data-resizable='true'] {
      .resize-handle {
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 4px;
        cursor: ns-resize;
        background: light-dark(#bbb, #444);
        opacity: 0;
        transition: opacity 0.1s ease;

        &::after {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: 1px;
          width: 32px;
          height: 2px;
          background: currentColor;
          border-radius: 1px;
        }

        &:hover {
          opacity: 1;
        }
      }
    }
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
