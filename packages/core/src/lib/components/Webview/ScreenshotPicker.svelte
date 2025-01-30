<script lang="ts" context="module">
  export type ScreenshotPickerMode = 'inline' | 'sidebar'
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import type { Icons } from '@horizon/icons'
  import { tick } from 'svelte'
  import ChatMessageMarkdown from '../Chat/ChatMessageMarkdown.svelte'
  import { tooltip, truncate, useLogScope } from '@horizon/utils'
  import { Editor } from '@horizon/editor'
  import { debounce } from 'lodash'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { EventContext, ResourceTypes, SaveToOasisEventTrigger } from '@horizon/types'
  import { AIChat, useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { handleQuotaDepletedError } from '@horizon/core/src/lib/service/ai/helpers'
  import { ModelTiers } from '@horizon/types/src/ai.types'
  import { QuotaDepletedError } from '@horizon/backend/types'
  import type { App } from '@horizon/backend/types'
  import { openDialog } from '@horizon/core/src/lib/components/Core/Dialog/Dialog.svelte'

  export let mode: ScreenshotPickerMode = 'inline'
  export let onboarding = false

  export let customTools = writable<App[]>([])

  let tools: App[] = $customTools
  let toolsSearchQuery = ''
  $: tools = $customTools
  $: filteredTools = toolsSearchQuery
    ? tools.filter((tool) => tool.name?.toLowerCase().includes(toolsSearchQuery.toLowerCase()))
    : tools

  const dispatch = createEventDispatcher<{
    save: { rect: { x: number; y: number; width: number; height: number }; loading: boolean }
    copy: { rect: { x: number; y: number; width: number; height: number }; loading: boolean }
    'ask-screenshot': {
      rect: { x: number; y: number; width: number; height: number }
      loading: boolean
      query: string
    }
    askAi: { rect: { x: number; y: number; width: number; height: number }; prompt: string }
    cancel: void
    saveTool: { name: string; prompt: string }
    deleteTool: { id: string }
  }>()

  let startX = 0,
    startY = 0,
    endX = 0,
    endY = 0
  let isSelecting = false
  let isPending = false
  let isResizing = false
  let isDragging = false
  let resizeHandle = ''
  let clientX = 0,
    clientY = 0
  let isCapturing = false
  let prompt = ''
  let pickerElement: HTMLElement
  let pickerRect: DOMRect
  let inputElement: HTMLInputElement
  let selectionElement: HTMLElement
  let aiResponseElement: HTMLElement
  let buttonsElement: HTMLElement
  let lastPrompt = ''
  let editorFocused = false
  let editor: Editor
  let savedChatId = ''
  let activeChat: AIChat | null = null
  let isShiftPressed = false
  let hoverHandle = ''
  let aiResponse: string = ''
  let aiResponseStream: ReadableStream<Uint8Array> | null = null
  let loading = false
  let selectedIndex = -1
  let menuItems = []
  $: menuItems = [
    { name: 'Save...', tooltip: 'Save Screenshot to My Stuff', icon: 'save' as Icons },
    { name: 'Copy', tooltip: 'Copy Screenshot', icon: 'copy' as Icons },
    { name: 'Custom', tooltip: 'Custom Tools', icon: 'sparkles' as Icons }
  ]

  let aiResponseMenuItems = [
    { action: 'Save', tooltip: 'Save', icon: 'save' as Icons },
    { action: 'Copy', tooltip: 'Copy', icon: 'copy' as Icons }
  ]
  let toolName = ''
  let toolPrompt = ''
  let showSaveToolModal = false
  let saveToolComplete = false
  let showCustomTools = false

  let menuElement: HTMLElement
  let inside = false
  let menuWidth = 650
  let menuHeight = mode === 'inline' ? 87 : 35
  let isResizingMenu = false
  let menuResizeStartX = 0
  let autoScrollChat = true

  const MIN_SIZE = 20
  const ai = useAI()
  const resourceManager = useResourceManager()
  const telemetry = resourceManager.telemetry
  const log = useLogScope('ScreenshotPicker')
  const toasts = useToasts()

  function handleMenuMouseDown(event: MouseEvent) {
    if (event.offsetX > menuWidth - 10) {
      isResizingMenu = true
      menuResizeStartX = event.clientX
      event.preventDefault()
      event.stopPropagation()
    }
  }

  function handleMenuMouseMove(event: MouseEvent) {
    if (isResizingMenu) {
      const newWidth = Math.max(400, menuWidth + event.clientX - menuResizeStartX)
      menuWidth = newWidth
      menuResizeStartX = event.clientX
      event.preventDefault()
      event.stopPropagation()
    }
  }

  function handleMenuMouseUp() {
    isResizingMenu = false
  }

  function getCursorForHandle(handle: string) {
    switch (handle) {
      case 'nw':
      case 'se':
        return 'nwse-resize'
      case 'ne':
      case 'sw':
        return 'nesw-resize'
      case 'n':
      case 's':
        return 'ns-resize'
      case 'e':
      case 'w':
        return 'ew-resize'
      default:
        return 'move'
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (isPending && menuElement.contains(event.target as Node)) {
      return
    }

    /*
    if (savedChatId) {
      if (
        !menuElement.contains(event.target as Node) &&
        !selectionElement.contains(event.target as Node)
      ) {
        resetState()
        dispatch('cancel')
      } else {
        return
      }
    }
    */
    pickerRect = pickerElement.getBoundingClientRect()
    const adjustedX = event.clientX - pickerRect.left
    const adjustedY = event.clientY - pickerRect.top

    if (!isPending) {
      isSelecting = true
      startX = endX = adjustedX
      startY = endY = adjustedY
    } else {
      const { x, y, width, height } = rect
      const edgeThreshold = 10

      if (isNearCorner(adjustedX, adjustedY, x, y)) resizeHandle = 'nw'
      else if (isNearCorner(adjustedX, adjustedY, x + width, y)) resizeHandle = 'ne'
      else if (isNearCorner(adjustedX, adjustedY, x + width, y + height)) resizeHandle = 'se'
      else if (isNearCorner(adjustedX, adjustedY, x, y + height)) resizeHandle = 'sw'
      else if (Math.abs(adjustedY - y) <= edgeThreshold) resizeHandle = 'n'
      else if (Math.abs(adjustedY - (y + height)) <= edgeThreshold) resizeHandle = 's'
      else if (Math.abs(adjustedX - x) <= edgeThreshold) resizeHandle = 'w'
      else if (Math.abs(adjustedX - (x + width)) <= edgeThreshold) resizeHandle = 'e'
      else resizeHandle = ''

      if (resizeHandle) {
        isResizing = true
      } else if (
        adjustedX >= x &&
        adjustedX <= x + width &&
        adjustedY >= y &&
        adjustedY <= y + height
      ) {
        isDragging = true
        clientX = adjustedX - x
        clientY = adjustedY - y
      }
      /*
      else {
        if (
          !menuElement.contains(event.target as Node) &&
          !buttonsElement.contains(event.target as Node)
        ) {
          resetState()
          dispatch('cancel')
        }
      }
      */
    }
    event.preventDefault()
    event.stopPropagation()
  }

  function isNearCorner(mouseX: number, mouseY: number, cornerX: number, cornerY: number) {
    const cornerThreshold = 10
    return (
      Math.abs(mouseX - cornerX) <= cornerThreshold && Math.abs(mouseY - cornerY) <= cornerThreshold
    )
  }

  function handleMouseMove(event: MouseEvent) {
    const adjustedX = event.clientX - pickerRect.left
    const adjustedY = event.clientY - pickerRect.top

    if (isSelecting || isResizing || isDragging) {
      if (isSelecting) {
        endX = adjustedX
        endY = adjustedY
      } else if (isResizing) {
        resizeSelection(adjustedX, adjustedY)
      } else if (isDragging) {
        dragSelection(adjustedX, adjustedY)
      }
    } else if (isPending) {
      const { x, y, width, height } = rect
      const edgeThreshold = 10

      if (isNearCorner(adjustedX, adjustedY, x, y)) hoverHandle = 'nw'
      else if (isNearCorner(adjustedX, adjustedY, x + width, y)) hoverHandle = 'ne'
      else if (isNearCorner(adjustedX, adjustedY, x + width, y + height)) hoverHandle = 'se'
      else if (isNearCorner(adjustedX, adjustedY, x, y + height)) hoverHandle = 'sw'
      else if (Math.abs(adjustedY - y) <= edgeThreshold) hoverHandle = 'n'
      else if (Math.abs(adjustedY - (y + height)) <= edgeThreshold) hoverHandle = 's'
      else if (Math.abs(adjustedX - x) <= edgeThreshold) hoverHandle = 'w'
      else if (Math.abs(adjustedX - (x + width)) <= edgeThreshold) hoverHandle = 'e'
      else hoverHandle = ''
    }

    event.preventDefault()
    event.stopPropagation()
  }

  function resizeSelection(adjustedX: number, adjustedY: number) {
    const newRect = { ...rect }
    const aspectRatio = rect.width / rect.height

    function maintainAspectRatio(width: number, height: number) {
      if (isShiftPressed) {
        if (width / height > aspectRatio) {
          width = height * aspectRatio
        } else {
          height = width / aspectRatio
        }
      }
      return { width, height }
    }

    switch (resizeHandle) {
      case 'nw':
        let nwSize = maintainAspectRatio(
          Math.max(rect.x + rect.width - adjustedX, MIN_SIZE),
          Math.max(rect.y + rect.height - adjustedY, MIN_SIZE)
        )
        newRect.width = nwSize.width
        newRect.height = nwSize.height
        newRect.x = rect.x + rect.width - newRect.width
        newRect.y = rect.y + rect.height - newRect.height
        break
      case 'ne':
        let neSize = maintainAspectRatio(
          Math.max(adjustedX - rect.x, MIN_SIZE),
          Math.max(rect.y + rect.height - adjustedY, MIN_SIZE)
        )
        newRect.width = neSize.width
        newRect.height = neSize.height
        newRect.y = rect.y + rect.height - newRect.height
        break
      case 'sw':
        let swSize = maintainAspectRatio(
          Math.max(rect.x + rect.width - adjustedX, MIN_SIZE),
          Math.max(adjustedY - rect.y, MIN_SIZE)
        )
        newRect.width = swSize.width
        newRect.height = swSize.height
        newRect.x = rect.x + rect.width - newRect.width
        break
      case 'se':
        let seSize = maintainAspectRatio(
          Math.max(adjustedX - rect.x, MIN_SIZE),
          Math.max(adjustedY - rect.y, MIN_SIZE)
        )
        newRect.width = seSize.width
        newRect.height = seSize.height
        break
      case 'n':
        if (isShiftPressed) {
          newRect.width = newRect.height * aspectRatio
        }
        newRect.height = Math.max(rect.y + rect.height - adjustedY, MIN_SIZE)
        newRect.y = rect.y + rect.height - newRect.height
        break
      case 's':
        if (isShiftPressed) {
          newRect.width = newRect.height * aspectRatio
        }
        newRect.height = Math.max(adjustedY - rect.y, MIN_SIZE)
        break
      case 'w':
        if (isShiftPressed) {
          newRect.height = newRect.width / aspectRatio
        }
        newRect.width = Math.max(rect.x + rect.width - adjustedX, MIN_SIZE)
        newRect.x = rect.x + rect.width - newRect.width
        break
      case 'e':
        if (isShiftPressed) {
          newRect.height = newRect.width / aspectRatio
        }
        newRect.width = Math.max(adjustedX - rect.x, MIN_SIZE)
        break
    }
    startX = newRect.x
    startY = newRect.y
    endX = newRect.x + newRect.width
    endY = newRect.y + newRect.height
  }

  function dragSelection(adjustedX: number, adjustedY: number) {
    const newX = adjustedX - clientX
    const newY = adjustedY - clientY
    const width = rect.width
    const height = rect.height
    startX = newX
    startY = newY
    endX = newX + width
    endY = newY + height
  }

  function handleMouseUp(event: MouseEvent) {
    if (isSelecting) {
      isSelecting = false
      if (rect.width > 10 && rect.height > 10) {
        isPending = true
        if (inputElement) {
          inputElement.focus()
        }
      }
    }
    isResizing = false
    isDragging = false
    resizeHandle = ''
    event.preventDefault()
    event.stopPropagation()
  }

  async function handleConfirm() {
    isCapturing = true
    isPending = false
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dispatch('save', { rect, loading })
        setTimeout(() => {
          isCapturing = false
        }, 100)
      })
    })
  }

  async function handleCopy() {
    isCapturing = true
    isPending = false
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dispatch('copy', { rect, loading })
        setTimeout(() => {
          isCapturing = false
        }, 100)
      })
    })

    await telemetry.trackCopyScreenshot()
  }

  function handleTakeScreenshotForChat() {
    isCapturing = true
    isPending = false
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dispatch('ask-screenshot', { rect, loading, query: prompt })
        setTimeout(() => {
          isCapturing = false
        }, 100)
      })
    })
  }

  function handleShowCustomTools() {
    showCustomTools = true
  }

  function handleCreateNewTool() {
    showSaveToolModal = true
    showCustomTools = false
  }

  function handleAIMessageCopy() {
    const cleanedAiResponse = aiResponse
      .replace('<sources></sources>', '')
      .replace('<answer>', '')
      .replace('</answer>', '')
    navigator.clipboard.writeText(cleanedAiResponse)
    toasts.success('Copied to clipboard!')
  }

  function saveToolWithName() {
    dispatch('saveTool', {
      name: toolName,
      prompt: toolPrompt
    })
    saveToolComplete = true
  }

  async function deleteTool(id: string, name?: string) {
    // TODO: dialog
    const { closeType: confirmed } = await openDialog({
      title: 'Delete Custom Tool?',
      message: `Are you sure you want to delete '${name}' ?`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit' }
      ]
    })
    if (confirmed) {
      tools = tools.filter((tool) => tool.id !== id)
      dispatch('deleteTool', { id })
    }
  }

  function handleKeydownModal(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      saveToolWithName()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      showSaveToolModal = false
      toolName = ''
      saveToolComplete = false
    }
  }

  const saveResponseOutput = async (response: string) => {
    log.debug('Saving chat response')

    let content: string = ''
    const element = document.getElementById(`chat-message`)
    if (element) {
      content = element.innerHTML
    }

    const resource = await resourceManager.createResourceNote(
      content,
      {
        name: truncate(lastPrompt, 50)
      },
      undefined,
      EventContext.Inline
    )

    log.debug('Saved response', resource)

    toasts.success('Saved to My Stuff!')

    await telemetry.trackSaveToOasis(
      ResourceTypes.DOCUMENT_SPACE_NOTE,
      SaveToOasisEventTrigger.Click,
      false,
      EventContext.Inline,
      'image'
    )
  }

  function scrollToBottom() {
    if (!autoScrollChat) return
    if (aiResponseElement) {
      aiResponseElement.scrollTop = aiResponseElement.scrollHeight
    }
  }

  function handleWheel(e: WheelEvent) {
    autoScrollChat = false
  }

  function chatCallback(chunk: string) {
    aiResponse += chunk
    scrollToBottom()
  }

  async function handleAISubmit() {
    if (prompt.length < 1) {
      return
    }
    if (onboarding) {
      handleAISubmitInline()
    }
    isCapturing = true
    isPending = false
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dispatch('ask-screenshot', { rect, loading, query: prompt })
        setTimeout(() => {
          isCapturing = false
        }, 100)
      })
    })
  }

  async function handleAISubmitInline(tier?: ModelTiers, isRetry = false) {
    if (prompt.length < 1) {
      return
    }

    loading = true

    const correctedRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }

    prompt = prompt.trim().replace('<p>', '').replace('</p>', '')
    const savedInputValue = prompt
    lastPrompt = ''
    autoScrollChat = true

    try {
      let dataUrl: string | null

      if (inside) {
        isCapturing = true
        await tick()
        dataUrl = await window.api.screenshotPage(correctedRect)
        isCapturing = false
        await tick()
      } else {
        dataUrl = await window.api.screenshotPage(correctedRect)
      }

      await telemetry.trackAskInlineAI({
        isFollowUp: savedChatId !== '',
        baseMedia: 'image'
      })

      if (!savedChatId) {
        activeChat = await ai.createChat()
        if (!activeChat) {
          throw new Error('Failed to create chat')
        }

        savedChatId = activeChat.id
      } else {
        activeChat = await ai.getChat(savedChatId)
      }

      if (!activeChat) {
        throw new Error('Failed to create chat')
      }

      const debouncedHeightCheck = debounce(() => {
        updateMenuHeight()
      }, 100)

      const intervalId = setInterval(debouncedHeightCheck, 100)

      aiResponse = ''

      await activeChat.sendMessage(chatCallback, prompt, {
        inlineImages: [dataUrl!],
        general: true,
        tier: tier ?? ModelTiers.Premium
      })

      clearInterval(intervalId)

      loading = false
      prompt = ''
      editor.clear()
      lastPrompt = savedInputValue
    } catch (e: any) {
      log.error('Error getting resources via prompt', e)
      if (e instanceof QuotaDepletedError) {
        const res = handleQuotaDepletedError(e)
        log.error('Quota depleted', res)
        if (
          !isRetry &&
          res.exceededTiers.length === 1 &&
          res.exceededTiers.includes(ModelTiers.Premium)
        ) {
          log.debug('Retrying with standard model')
          prompt = savedInputValue
          editor.setContent(savedInputValue)
          await tick()
          return handleAISubmit(ModelTiers.Standard, true)
        }
      }

      aiResponse = 'Sorry encountered an error: ' + e
      prompt = savedInputValue
      editor.setContent(savedInputValue)
      loading = false
    } finally {
      updateMenuHeight()
      await tick()
      scrollToBottom()
    }
  }

  export function startAIResponseStream(stream: ReadableStream<Uint8Array>) {
    aiResponseStream = stream
    const reader = stream.getReader()
    const decoder = new TextDecoder()

    function readChunk() {
      reader.read().then(({ done, value }) => {
        if (done) {
          return
        }
        const chunk = decoder.decode(value, { stream: true })
        aiResponse += chunk
        readChunk()
      })
    }

    readChunk()
  }

  async function resetState() {
    savedChatId = ''
    isSelecting = false
    isPending = false
    isResizing = false
    isDragging = false
    isCapturing = false
    aiResponse = ''
    startX = startY = endX = endY = 0
    await tick()
    if (inputElement) {
      inputElement.focus()
    }
  }

  function updateMenuHeight() {
    if (menuElement) {
      menuHeight = menuElement.offsetHeight
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (isPending) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        selectedIndex =
          (selectedIndex + (event.key === 'ArrowDown' ? 1 : -1) + menuItems.length) %
          menuItems.length
      } else if (event.metaKey) {
        if (event.key === 's') {
          event.preventDefault()
          handleConfirm()
        } else if (event.key === 'c' && prompt.length < 1) {
          event.preventDefault()
          handleCopy()
        } else if (event.key === 'Backspace') {
          // event.preventDefault()
          // resetState()
        } else if (event.key === 'a' && event.shiftKey) {
          event.preventDefault()
          selectEntireContainer()
        }
      } else if (event.key === 'Enter') {
      }
    }

    if (event.key === 'Shift') {
      isShiftPressed = true
    }
  }

  function handleKeyup(event: KeyboardEvent) {
    if (event.key === 'Shift') {
      isShiftPressed = false
    }
  }

  function selectEntireContainer() {
    pickerRect = pickerElement.getBoundingClientRect()
    startX = 0
    startY = 0
    endX = pickerRect.width
    endY = pickerRect.height
    isPending = true
    if (inputElement) {
      inputElement.focus()
    }
  }

  function handleMenuItemClick(index: number) {
    switch (index) {
      case 0:
        handleConfirm()
        break
      case 1:
        handleCopy()
        break
      case 2:
        handleShowCustomTools()
        break
      /*
        handleTakeScreenshotForChat()
        break
      case 3:
        handleShowCustomTools()
        break
      */
    }
  }

  function handleAIMessageItemClick(action: string) {
    switch (action) {
      case 'Save':
        saveResponseOutput(aiResponse)
        break
      case 'Copy':
        handleAIMessageCopy()
        break
    }
  }

  onMount(() => {
    aiResponse = ''

    const handlePickerMouseMove = (event: MouseEvent) => {
      if (isSelecting || isResizing || isDragging) {
        handleMouseMove(event)
      }
    }

    const handlePickerMouseUp = (event: MouseEvent) => {
      if (isSelecting || isResizing || isDragging) {
        handleMouseUp(event)
      }
    }

    pickerElement.addEventListener('mousemove', handlePickerMouseMove)
    pickerElement.addEventListener('mouseup', handlePickerMouseUp)
    window.addEventListener('mousemove', handleMenuMouseMove)
    window.addEventListener('mouseup', handleMenuMouseUp)

    if (pickerElement) {
      pickerElement.focus()
    }

    return () => {
      pickerElement.removeEventListener('mousemove', handlePickerMouseMove)
      pickerElement.removeEventListener('mouseup', handlePickerMouseUp)
      window.removeEventListener('mousemove', handleMenuMouseMove)
      window.removeEventListener('mouseup', handleMenuMouseUp)
    }
  })

  onDestroy(() => {
    if (aiResponseStream) {
      aiResponseStream.cancel()
    }
  })

  $: menuStyle = `
  left: ${inside ? rect.x + 8 : rect.x}px;
  ${yCoordinate};
  width: ${menuWidth}px;
  min-height: ${menuHeight}px;
  cursor: ${isResizingMenu ? 'ew-resize' : 'auto'};
`

  $: rect = {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY)
  }

  $: cursor =
    isResizing || hoverHandle
      ? getCursorForHandle(isResizing ? resizeHandle : hoverHandle)
      : isDragging
        ? 'grabbing'
        : isPending
          ? hoverHandle
            ? getCursorForHandle(hoverHandle)
            : 'grab'
          : 'crosshair'

  $: isInstructionsVisible = !isSelecting && !isPending && !isCapturing

  $: yCoordinate = (() => {
    updateMenuHeight()
    const bottomEdge = rect.y + rect.height + menuHeight
    if (bottomEdge > window.innerHeight - 1) {
      // we can't place it below selecton bc. no space
      // so first, try to put it at the top, otherwise, it should be inside the selection

      if (rect.y - menuHeight > 1) {
        return `bottom: ${window.innerHeight - rect.y + 8}px`
      }

      inside = true
      return `bottom: ${window.innerHeight - rect.y - rect.height + 8}px`
    } else {
      inside = false
      return `top: ${rect.y + rect.height + 8}px`
    }
  })()
</script>

<svelte:window on:keydown={handleKeydown} on:keyup={handleKeyup} />

<div
  bind:this={pickerElement}
  class="screenshot-picker fixed inset-0 z-[]"
  class:hidden={isCapturing}
  on:mousedown={handleMouseDown}
  role="button"
  tabindex="0"
  style={`cursor: ${cursor};
  z-index: 9993231322131232132131231231211239;`}
>
  <div
    class="absolute inset-0 backdrop-grayscale bg-black/50 backdrop-blur-[0.5px]"
    style={`clip-path: polygon(
      0% 0%,
      100% 0%,
      100% 100%,
      0% 100%,
      0% ${rect.y}px,
      ${rect.x}px ${rect.y}px,
      ${rect.x}px ${rect.y + rect.height}px,
      ${rect.x + rect.width}px ${rect.y + rect.height}px,
      ${rect.x + rect.width}px ${rect.y}px,
      ${rect.x}px ${rect.y}px,
      0% ${rect.y}px
    );
    border-radius: 10px;`}
  />

  {#if (isSelecting || isPending) && !isCapturing}
    <div
      class="flex items-center gap-2 absolute"
      class:flex-col={rect.height > 64}
      style="left: {rect.x + rect.width + 8}px; top: {rect.y}px;"
      bind:this={buttonsElement}
    >
      {#if !onboarding}
        {#each menuItems as item, index}
          <button
            class="flex gap-2 select-none items-center rounded-lg p-2 text-sm font-medium bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-900 text-gray-800 dark:text-gray-200 disabled:opacity-25 transition-colors"
            on:click={() => handleMenuItemClick(index)}
            use:tooltip={{
              text: item.tooltip,
              position: 'top'
            }}
          >
            <Icon name={item.icon} size="16px" />
          </button>
        {/each}
      {/if}
    </div>
    {#if showCustomTools}
      <div
        class="absolute rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        style="left: {rect.x + rect.width + 40}px; top: {rect.y + 108}px;"
      >
        <div class="p-4">
          <!--
          <div class="mb-4">
            <input
              type="text"
              placeholder="Search tools..."
              bind:value={toolsSearchQuery}
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          -->

          {#each filteredTools as tool}
            <div class="flex justify-between items-center rounded-lg p-2 mb-2">
              <div class="flex items-center justify-between w-full">
                <button
                  class="flex-grow text-left text-lg text-gray-800 dark:text-gray-200 w-[200px] truncate px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  on:click={() => {
                    prompt = tool.content
                    showCustomTools = false
                    handleAISubmit()
                  }}
                >
                  {tool.name}
                </button>
                <button
                  class="ml-4 p-2 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                  on:click={() => deleteTool(tool.id, tool.name)}
                >
                  <Icon name="trash" size="20px" />
                </button>
              </div>
            </div>
          {/each}

          {#if filteredTools.length === 0 && toolsSearchQuery}
            <div class="text-gray-500 dark:text-gray-400 text-center py-4">
              No tools found matching "{toolsSearchQuery}"
            </div>
          {/if}

          <div
            class={filteredTools.length > 0
              ? 'mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'
              : ''}
          >
            <button
              class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:!bg-blue-600 text-white font-medium"
              on:click={handleCreateNewTool}
            >
              <Icon name="add" size="16px" />
              New Tool
            </button>
          </div>
        </div>
      </div>
    {/if}
    <div
      class="selection select-none absolute rounded-xl flex flex-row gap-4 border-2 border-white"
      style="left: {rect.x}px; top: {rect.y}px; width: {rect.width}px; height: {rect.height}px;"
      bind:this={selectionElement}
    >
      {#if isPending && !isCapturing}
        <div class="resize-handles">
          <div class="resize-handle nw"></div>
          <div class="resize-handle ne"></div>
          <div class="resize-handle sw"></div>
          <div class="resize-handle se"></div>
          <div class="resize-handle n"></div>
          <div class="resize-handle e"></div>
          <div class="resize-handle s"></div>
          <div class="resize-handle w"></div>
        </div>
      {/if}
    </div>

    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      bind:this={menuElement}
      class="screenshot-menu absolute rounded-lg flex flex-row gap-2 {mode === 'inline'
        ? 'w-[400px]'
        : 'w-fit'}"
      style={menuStyle}
      on:mousedown={handleMenuMouseDown}
    >
      {#if mode === 'inline'}
        <div class="flex-1 shadow-xl">
          <div
            class="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-t-lg py-1"
          >
            {#if aiResponse}
              <div
                bind:this={aiResponseElement}
                on:wheel|passive={handleWheel}
                class="overflow-y-auto max-h-[32rem] py-4 w-full max-w-4xl overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500 px-4"
              >
                <!--
                {#if lastPrompt}
                  <div
                    class="font-semibold text-gray-800 dark:text-gray-200 pt-2 rounded-xl w-full max-w-3xl mb-4 pl-1"
                  >
                    {@html lastPrompt}
                  </div>
                {/if}
                -->
                <div class="max-w-full p-4">
                  <ChatMessageMarkdown content={aiResponse} sources={[]} inline id="chat-message" />
                </div>

                {#if aiResponse.length > 0 && !loading}
                  <div class="flex flex-row items-center gap-3 my-4 max-w-3xl pl-1">
                    {#each aiResponseMenuItems as item}
                      <button
                        class="flex gap-2 select-none items-center rounded-xl px-3 py-2 text-sm font-medium !ring-0 !ring-transparent transition-colors text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-900 disabled:opacity-25"
                        on:click={() => handleAIMessageItemClick(item.action)}
                        use:tooltip={{
                          text: item.tooltip,
                          position: 'top'
                        }}
                      >
                        <Icon name={item.icon} size="16px" className="!text-gray-500" />
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}

            <form
              class="py-2 flex-1 border-gray-200 dark:border-gray-700 px-3"
              class:border-t={aiResponse}
            >
              <div class="flex-grow overflow-y-auto max-h-24 !text-md">
                <Editor
                  bind:this={editor}
                  bind:content={prompt}
                  bind:focused={editorFocused}
                  on:submit={() => handleAISubmit()}
                  submitOnEnter
                  autofocus={true}
                  placeholder="Ask a question..."
                />
              </div>
            </form>
          </div>

          <div
            class="flex flex-row justify-between items-center text-sm bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-b-lg px-1 py-1"
          >
            <div class="flex items-center gap-2">
              <button
                class="flex gap-2 select-none items-center rounded-lg p-2 text-sm font-medium !ring-0 !ring-transparent transition-colors bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:hover:text-gray-100"
                on:click={() => {
                  if (prompt.length > 0 && !loading) {
                    handleAISubmit()
                  } else {
                    dispatch('cancel')
                  }
                }}
                disabled={prompt.length > 0 && loading}
              >
                {#if prompt.length > 0 && !loading}
                  <!-- <kbd class="text-gray-500">↵</kbd> -->
                  <span>Ask</span>
                {:else if loading}
                  <div>
                    <span
                      class="w-1.5 h-1.5 ml-1.5 rounded-full bg-gray-400 inline-block animate-flash"
                    ></span>
                    <span
                      class="w-1.5 h-1.5 ml-1.5 rounded-full bg-gray-400 inline-block animate-flash [animation-delay:0.2s]"
                    ></span>
                    <span
                      class="w-1.5 h-1.5 ml-1.5 rounded-full bg-gray-400 inline-block animate-flash [animation-delay:0.4s]"
                    ></span>
                  </div>
                {:else}
                  <!-- <kbd class="text-gray-500 text-xs">ESC</kbd> -->
                  <span>Cancel</span>
                {/if}
              </button>

              <!-- {#if savedChatId && !loading}
              <button
                class="flex gap-2 select-none items-center rounded-xl p-2 text-sm font-medium !ring-0 !ring-transparent transition-colors"
                on:click={() => {
                  resetState()
                }}
                disabled={prompt.length > 0 && loading}
              >
                <kbd class="text-gray-500 text-xs">
                  {#if navigator.userAgent.includes('Macintosh')}
                    <kbd>⌘+⌫ </kbd>
                  {:else}
                    <kbd>Ctrl+⌫</kbd>
                  {/if}
                </kbd>
                <span>Reset</span>
              </button>
            {/if} -->
            </div>
          </div>
        </div>
      {:else}
        <button
          class="flex gap-2 select-none items-center h-fit rounded-lg p-2 text-base font-medium !ring-0 !ring-transparent transition-colors text-white/75 bg-blue-500 hover:!bg-blue-600"
          on:click={handleTakeScreenshotForChat}
        >
          <Icon name="message" className="!text-gray-500" />
          Use in Chat
        </button>
      {/if}
    </div>
  {/if}
</div>

{#if isInstructionsVisible}
  <div
    class="instructions fixed bottom-5 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-5 py-2.5 rounded-full text-lg flex items-center gap-2 select-none pointer-events-none hover:opacity-0"
    style="z-index: 9993231322131232132131231231211240;"
  >
    <Icon name="cursor-arrow-rays" size="22px" />
    Click and drag anywhere to select a region
  </div>
{/if}

{#if showSaveToolModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999999999]">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
      <div class="p-6">
        <h3 class="text-lg font-semibold text-gray-900">Create New Tool</h3>
        <p class="text-sm text-gray-500">Create a new tool to quickly use it later.</p>
        <div class="mt-4">
          <input
            id="toolName"
            type="text"
            bind:value={toolName}
            on:keydown={handleKeydownModal}
            disabled={saveToolComplete}
            class="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            placeholder="Name..."
          />
        </div>
        <div class="mt-4">
          <input
            id="toolPrompt"
            type="text"
            bind:value={toolPrompt}
            on:keydown={handleKeydownModal}
            disabled={saveToolComplete}
            class="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            placeholder="Prompt..."
          />
        </div>
        {#if saveToolComplete}
          <p class="mt-2 text-sm text-green-600">Saved!</p>
        {/if}
        <div class="mt-6 flex justify-end gap-3">
          <button
            class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            on:click={() => {
              showSaveToolModal = false
              saveToolComplete = false
              toolName = ''
            }}
          >
            Close
          </button>
          <button
            class="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:!bg-blue-700"
            on:click={saveToolWithName}
            hidden={saveToolComplete}
            disabled={!toolName}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .selection {
    border: 3px solid white;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.1);
  }

  button {
    &:hover,
    &[aria-current='true'] {
      @apply bg-gray-200;
    }
  }
</style>
