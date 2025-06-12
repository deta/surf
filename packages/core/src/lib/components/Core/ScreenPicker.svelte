<script lang="ts" context="module">
  import ScreenPicker from './ScreenPicker.svelte'
  import { OnboardingAction } from '../Onboarding/onboardingScripts'
  import { screenPickerSelectionActive } from '../../service/onboarding'

  // Standalone is self contained, where as-input ask user to define area  and capture it for some
  // other action
  export type ScreenPickerMode = 'standalone' | 'as-input'

  // TODO: catch err -> rej
  export function requestUserScreenshot(): Promise<Blob | null> {
    return new Promise((res, _) => {
      const picker = new ScreenPicker({
        target: document.body,
        props: {
          mode: 'as-input'
        }
      })
      picker.$on('close', (e: CustomEvent<Blob | null>) => {
        picker?.$destroy()
        res(e.detail)
      })
    })
  }
</script>

<script lang="ts">
  /**
   * TODO:
   * @maxu: Add layout check for super small rect at bottom of screen, if space above -> move toolbox
   *        above rect, not inside.
   */
  import { onMount } from 'svelte'

  import { dist, isInsideRect, useLogScope, wait } from '@horizon/utils'
  import { createEventDispatcher, onDestroy, tick } from 'svelte'
  import { derived, get, readable, writable } from 'svelte/store'
  import { useToasts } from '../../service/toast'
  import { AIChat, useAI, type ChatPrompt } from '../../service/ai/ai'
  import { Icon } from '@horizon/icons'
  import { hasParent, startingClass } from '../../utils/dom'
  import Chat from '../Chat/Chat.svelte'
  import ChatOld from '../Chat/ChatOld.svelte'
  import { captureScreenshot } from '../../utils/screenshot'
  import { CompletionEventID } from '../Onboarding/onboardingScripts'
  import {
    EventContext,
    PageChatMessageSentEventTrigger,
    PromptType,
    type App
  } from '@horizon/types'
  import { useTelemetry } from '../../service/telemetry'
  import ChatInput from '../Chat/ChatInput.svelte'
  import { SelectDropdown, SelectDropdownItem, type SelectItem } from '../Atoms/SelectDropdown'
  import { quartOut } from 'svelte/easing'
  import CreateAiToolDialog from '../Chat/CreateAiToolDialog.svelte'
  import { fade } from 'svelte/transition'
  import { contextMenu } from './ContextMenu.svelte'
  import { openDialog } from './Dialog/Dialog.svelte'
  import ChatTitle from '@horizon/core/src/lib/components/Chat/ChatTitle.svelte'
  import NoteTitle from '@horizon/core/src/lib/components/Chat/Notes/NoteTitle.svelte'
  import { SmartNote, useSmartNotes } from '@horizon/core/src/lib/service/ai/note'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import AppBarButton from '@horizon/core/src/lib/components/Browser/AppBarButton.svelte'

  type Rect = { x: number; y: number; width: number; height: number }
  type Direction = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  const DIRECTION_CURSORS: Record<Direction, string> = {
    nw: 'nwse',
    se: 'nwse',
    ne: 'nesw',
    sw: 'nesw',
    n: 'ns',
    e: 'ew',
    s: 'ns',
    w: 'ew'
  }

  const addPromptItem = {
    id: 'addprompt',
    label: 'Add Prompt',
    icon: 'add'
  } as SelectItem

  export let mode: ScreenPickerMode = 'standalone'
  export let fromTty: boolean = false
  // TODO: impl as-input

  const dispatch = createEventDispatcher<{
    close: Blob | null // Task implementor of this component to close it (blob: screenshot, false: cancelled / issue)
    'open-chat-in-sidebar': { chat: AIChat }
    'open-note-in-sidebar': { note: SmartNote }
    'save-screenshot': {
      rect: { x: number; y: number; width: number; height: number }
    }
    'use-screenshot-in-chat': Blob
  }>()

  const log = useLogScope('ScreenPicker')
  const toasts = useToasts()
  const telemetry = useTelemetry()
  const tabsManager = useTabsManager()
  const ai = useAI()
  const smartNotes = useSmartNotes()
  const config = useConfig()

  $: customAiApps = ai?.customAIApps

  const userConfigSettings = config.settings
  const selectedModel = ai.selectedModel

  const THRESHOLD = 18
  const state = writable<any>({
    isMouseInRect: false,

    isLocked: false, // Prevent all move / resizes
    isCapturing: false, // Used to hide UI, so it doesnt show up on screenshots
    isSelecting: false,
    isResizing: false,
    resizeDirection: undefined,
    isMovingRect: false,
    isChatExpanded: false,
    chatLocation: 'left',

    insetTools: false
  })

  const selectionRect = writable<Rect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  })

  let backdropEl: HTMLElement
  let pickerEl: HTMLElement
  let toolboxEl: HTMLElement
  let chatboxEl: HTMLElement
  let appsEl: HTMLElement
  let addPromptEl: HTMLElement | undefined
  let chatComponent: Chat | ChatOld

  let showAddPromptDialog = false

  const appModalContent = writable<App | null>(null)
  const note = writable<SmartNote | null>(null)
  const activeChat = writable<AIChat | null>(null)
  const promptSelectorOpen = writable(false)

  $: chatStatusStore = $activeChat?.status
  $: chatStatus = $chatStatusStore ?? 'idle'

  $: responses = $activeChat?.responses ? $activeChat.responses : readable([])
  $: if (($note || $responses?.length > 0) && !$state.isChatExpanded) {
    document.startViewTransition(async () => {
      $state.isChatExpanded = true
      await tick()
    })
  }

  const promptItems = derived([ai?.customAIApps ?? readable([])], ([customAiApps]) => {
    return customAiApps.map(
      (app) =>
        ({
          id: app.id,
          label: app.name,
          icon: app.icon
        }) as SelectItem
    )
  })

  // RAF STATE
  let raf: number | null = null
  const _selectionRect = writable<Rect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  })

  // Reactive State
  $: validRectSelection = $selectionRect.width * $selectionRect.height >= 900

  // Set the global state when component is mounted/unmounted
  onMount(() => {
    screenPickerSelectionActive.set(true)
  })

  onDestroy(() => {
    screenPickerSelectionActive.set(false)
  })

  function rafCbk() {
    _selectionRect.update((v) => {
      v = $selectionRect
      return v
    })

    // Get center point
    const centerX = $selectionRect.x + $selectionRect.width / 2
    $state.chatLocation = centerX > window.innerWidth / 2 ? 'left' : 'right'

    if ($selectionRect.y + $selectionRect.height > window.innerHeight - 100) {
      $state.insetTools = true
    } else {
      $state.insetTools = false
    }

    raf = null
  }

  // Selection Utils

  function handleRectMouseDown(e: MouseEvent) {
    if ($state.isLocked) return
    if (
      hasParent(e.target, toolboxEl) ||
      hasParent(e.target, chatboxEl) ||
      hasParent(e.target, appsEl) ||
      showAddPromptDialog
    )
      return
    if ($state.isResizing || $state.isSelecting) return
    if (
      !isInsideRect(
        { x: e.clientX, y: e.clientY },
        {
          x: $selectionRect.x + THRESHOLD,
          y: $selectionRect.y + THRESHOLD,
          width: $selectionRect.width - THRESHOLD * 2,
          height: $selectionRect.height - THRESHOLD * 2
        }
      )
    )
      return
    e.preventDefault()
    e.stopPropagation()

    const handleMove = (e: MouseEvent) => {
      selectionRect.update((v) => {
        v.x += e.movementX
        v.y += e.movementY

        v.x = Math.min(Math.max(v.x, 0), innerWidth - v.width)
        v.y = Math.min(Math.max(v.y, 0), innerHeight - v.height)

        return v
      })

      if (raf === null) raf = requestAnimationFrame(rafCbk)
    }
    const handleUp = (e: MouseEvent) => {
      window.removeEventListener('mousemove', handleMove)
      $state.isMovingRect = false
      if (raf !== null) cancelAnimationFrame(raf)
    }

    $state.isMovingRect = true

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp, { once: true })
  }

  function handleWindowMouseMove(e: MouseEvent) {
    function reset() {
      pickerEl.style.removeProperty('cursor')
      backdropEl.style.removeProperty('cursor')
    }

    if ($state.isLocked) {
      $state.resizeDirection = undefined
      reset()
    }

    if (
      isInsideRect(
        { x: e.clientX, y: e.clientY },
        {
          x: $selectionRect.x + THRESHOLD,
          y: $selectionRect.y + THRESHOLD,
          width: $selectionRect.width - THRESHOLD * 2,
          height: $selectionRect.height - THRESHOLD * 2
        }
      ) ||
      hasParent(e.target, toolboxEl) ||
      hasParent(e.target, chatboxEl) ||
      hasParent(e.target, appsEl) ||
      showAddPromptDialog
    ) {
      $state.resizeDirection = undefined
      reset()
      return
    }

    if ($state.isLocked || $state.isSelecting || $state.isResizing !== false) return

    let resizeEdge: Direction | undefined = undefined
    const vM = { x: e.clientX, y: e.clientY }
    const vNW = { x: $selectionRect.x, y: $selectionRect.y }
    const vNE = { x: $selectionRect.x + $selectionRect.width, y: $selectionRect.y }
    const vSE = {
      x: $selectionRect.x + $selectionRect.width,
      y: $selectionRect.y + $selectionRect.height
    }
    const vSW = { x: $selectionRect.x, y: $selectionRect.y + $selectionRect.height }

    if (dist(vM, vNW, THRESHOLD)) resizeEdge = 'nw'
    else if (dist(vM, vNE, THRESHOLD)) resizeEdge = 'ne'
    else if (dist(vM, vSE, THRESHOLD)) resizeEdge = 'se'
    else if (dist(vM, vSW, THRESHOLD)) resizeEdge = 'sw'
    else if (
      Math.abs(e.clientX - $selectionRect.x) <= THRESHOLD &&
      e.clientY >= $selectionRect.y &&
      e.clientY <= $selectionRect.y + $selectionRect.height
    )
      resizeEdge = 'w'
    else if (
      Math.abs(e.clientX - ($selectionRect.x + $selectionRect.width)) <= THRESHOLD &&
      e.clientY >= $selectionRect.y &&
      e.clientY <= $selectionRect.y + $selectionRect.height
    )
      resizeEdge = 'e'
    else if (
      Math.abs(e.clientY - $selectionRect.y) <= THRESHOLD &&
      e.clientX >= $selectionRect.x &&
      e.clientX <= $selectionRect.x + $selectionRect.width
    )
      resizeEdge = 'n'
    else if (
      Math.abs(e.clientY - ($selectionRect.y + $selectionRect.height)) <= THRESHOLD &&
      e.clientX >= $selectionRect.x &&
      e.clientX <= $selectionRect.x + $selectionRect.width
    )
      resizeEdge = 's'

    if (resizeEdge) {
      $state.resizeDirection = resizeEdge
      pickerEl.style.setProperty('cursor', `${DIRECTION_CURSORS[resizeEdge]}-resize`, 'important')
      backdropEl.style.setProperty('cursor', `${DIRECTION_CURSORS[resizeEdge]}-resize`, 'important')
    } else {
      $state.resizeDirection = undefined
      reset()
    }
  }

  function handleWindowMouseDown(e: MouseEvent) {
    if ($state.isLocked) return
    if (
      hasParent(e.target, toolboxEl) ||
      hasParent(e.target, chatboxEl) ||
      hasParent(e.target, appsEl) ||
      showAddPromptDialog
    )
      return
    if (
      isInsideRect(
        { x: e.clientX, y: e.clientY },
        {
          x: $selectionRect.x + THRESHOLD,
          y: $selectionRect.y + THRESHOLD,
          width: $selectionRect.width - THRESHOLD * 2,
          height: $selectionRect.height - THRESHOLD * 2
        }
      )
    )
      return
    e.preventDefault()
    e.stopPropagation()

    if ($state.isResizing === false && $state.resizeDirection !== undefined) {
      $state.isResizing = true

      const p0 = { x: $selectionRect.x, y: $selectionRect.y }
      const p1 = {
        x: $selectionRect.x + $selectionRect.width,
        y: $selectionRect.y + $selectionRect.height
      }
      const DIR = $state.resizeDirection as Direction

      const handleMove = (e: MouseEvent) => {
        if (['nw', 'sw', 'w'].includes(DIR)) {
          p0.x += e.movementX
        }
        if (['nw', 'ne', 'n'].includes(DIR)) {
          p0.y += e.movementY
        }
        if (['se', 'ne', 'e'].includes(DIR)) {
          p1.x += e.movementX
        }
        if (['se', 'sw', 's'].includes(DIR)) {
          p1.y += e.movementY
        }

        // Apply rect from points
        const minX = Math.min(p0.x, p1.x)
        const minY = Math.min(p0.y, p1.y)
        const maxX = Math.max(p0.x, p1.x)
        const maxY = Math.max(p0.y, p1.y)
        const width = maxX - minX
        const height = maxY - minY

        selectionRect.update((v) => {
          v.x = minX
          v.y = minY
          v.width = width
          v.height = height
          return v
        })

        if (raf === null) raf = requestAnimationFrame(rafCbk)
      }

      const handleUp = async (e: MouseEvent) => {
        $state.isResizing = false
        $state.resizeDirection = undefined
        pickerEl.style.removeProperty('cursor')
        window.removeEventListener('mousemove', handleMove, { capture: true })

        if (raf !== null) cancelAnimationFrame(raf)

        await tick()
        if (!validRectSelection) {
          selectionRect.set({ x: 0, y: 0, width: 0, height: 0 })
          raf = requestAnimationFrame(rafCbk)
        }
      }

      window.addEventListener('mousemove', handleMove, { capture: true })
      window.addEventListener('mouseup', handleUp, { capture: true, once: true })
      return
    }

    // Is not resizing -> select new area
    else {
      if (isInsideRect({ x: e.clientX, y: e.clientY }, $selectionRect)) return
      $state.isSelecting = true

      const pSelStart = { x: e.clientX, y: e.clientY }
      let pSelEnd = { x: e.clientX, y: e.clientY }

      const handleMove = (e: MouseEvent) => {
        pSelEnd = { x: e.clientX, y: e.clientY }

        // Apply rect from points
        const minX = Math.min(pSelStart.x, pSelEnd.x)
        const minY = Math.min(pSelStart.y, pSelEnd.y)
        const maxX = Math.max(pSelStart.x, pSelEnd.x)
        const maxY = Math.max(pSelStart.y, pSelEnd.y)
        const width = maxX - minX
        const height = maxY - minY

        selectionRect.update((v) => {
          v.x = minX
          v.y = minY
          v.width = width
          v.height = height
          return v
        })

        if (raf === null) raf = requestAnimationFrame(rafCbk)
      }

      const handleUp = async (e: MouseEvent) => {
        window.removeEventListener('mousemove', handleMove)
        $state.isSelecting = false
        if (raf !== null) cancelAnimationFrame(raf)

        await tick()
        if ($selectionRect.width <= 2 || $selectionRect.height <= 2) {
          dispatch('close')
          return
        }

        document.dispatchEvent(new CustomEvent(CompletionEventID.VisionSelected, { bubbles: true }))

        if (!validRectSelection) {
          selectionRect.set({ x: 0, y: 0, width: 0, height: 0 })
          raf = requestAnimationFrame(rafCbk)
        }
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp, { once: true, capture: true })
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      dispatch('close', null)
    }
  }

  // Chatting Utils

  function handleClose() {
    // TODO: @maxi abort chat completion, if running (not possible rn?)
    dispatch('close', null)
  }

  async function handleExpandChat() {
    dispatch('close', null)
    if ($userConfigSettings.experimental_notes_chat_sidebar) {
      if (!$note) return

      dispatch('open-note-in-sidebar', {
        note: $note
      })
    } else {
      if (!$activeChat) return

      dispatch('open-chat-in-sidebar', {
        chat: $activeChat
      })
    }

    document.dispatchEvent(
      new CustomEvent(CompletionEventID.OpenVisionNoteInSidebar, { bubbles: true })
    )
  }

  function handleOpenAsTab() {
    if (!$note) return

    tabsManager.openResourcFromContextAsPageTab($note.id)
    dispatch('close', null)
  }

  async function handleAcceptAsInput() {
    $state.isCapturing = true
    await tick()
    await new Promise((r) => setTimeout(r, 100))

    try {
      const blob = await captureScreenshot($selectionRect)
      dispatch('close', blob)
    } catch (e) {
      log.error('Failed to create screenshot as input:', e)
      toasts.error('Failed to create screenshot as input')

      dispatch('close', null)
    }
  }

  async function handleSaveScreenshot() {
    $state.isCapturing = true
    await new Promise((r) => setTimeout(r, 100))
    dispatch('save-screenshot', { rect: $selectionRect })
    dispatch('close', null)
  }

  async function handleCopyScreenshot() {
    $state.isCapturing = true
    await tick()
    await new Promise((r) => setTimeout(r, 100))

    try {
      const blob = await captureScreenshot($selectionRect)
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      toasts.success('Screenshot copied to clipboard!')
      telemetry.trackCopyScreenshot()
      dispatch('close', blob)
    } catch (e) {
      log.error('Failed to copy screenshot to clipboard:', e)
      toasts.error('Failed to copy screenshot to clipboard')
      dispatch('close', null)
    }
  }

  async function handleUseInChat() {
    $state.isCapturing = true
    await tick()
    await new Promise((r) => setTimeout(r, 100))

    try {
      const blob = await captureScreenshot($selectionRect)
      dispatch('use-screenshot-in-chat', blob)
      dispatch('close', blob)
    } catch (e) {
      log.error('Failed to create screenshot for chat:', e)
      toasts.error('Failed to create screenshot for chat')

      dispatch('close', null)
    }
  }

  // Make handlePromptInputSubmit accessible to the module context
  export async function handlePromptInputSubmit(input: string) {
    if (input.length < 1 || $state.isCapturing === true) {
      return
    }

    $state.isLocked = true
    $state.isCapturing = true
    await tick()
    await new Promise((r) => setTimeout(r, 100))

    document.dispatchEvent(new CustomEvent(CompletionEventID.VisionSend, { bubbles: true }))

    const blob = await captureScreenshot($selectionRect)
    $state.isCapturing = false

    if ($userConfigSettings.experimental_notes_chat_sidebar) {
      $note = await smartNotes.createNote('')
      $note.contextManager.addScreenshot(blob)

      await wait(500)

      await chatComponent.createChatCompletion(
        input,
        undefined,
        PageChatMessageSentEventTrigger.InlineAI,
        { showPrompt: true, focusInput: true }
      )
    } else {
      const contextManager = ai.createContextManager()
      contextManager.addScreenshot(blob)

      if (!$activeChat) {
        $activeChat = await ai.createChat({ contextManager, automaticTitleGeneration: true })
      }

      // WARN: Telemetry
      $activeChat?.createChatCompletion(input, {
        trigger: PageChatMessageSentEventTrigger.InlineAI,
        //useContext: true
        skipScreenshot: true
        //... TODO:: @maxi use others props // what do we need here?
      })
    }
  }

  async function handleRunPrompt(prompt: ChatPrompt) {
    $state.isLocked = true
    $state.isCapturing = true
    await tick()
    await new Promise((r) => setTimeout(r, 100))

    const blob = await captureScreenshot($selectionRect)
    $state.isCapturing = false

    if ($userConfigSettings.experimental_notes_chat_sidebar) {
      $note = await smartNotes.createNote('')
      $note.contextManager.addScreenshot(blob)

      await wait(800)

      await chatComponent.createChatCompletion(
        prompt.prompt,
        undefined,
        PageChatMessageSentEventTrigger.InlineAI,
        { showPrompt: true, focusInput: true }
      )
    } else {
      const contextManager = ai.createContextManager()
      contextManager.addScreenshot(blob)

      if (!$activeChat) {
        $activeChat = await ai.createChat({ contextManager, automaticTitleGeneration: true })
      }

      $activeChat?.createChatCompletion(prompt.prompt, {
        trigger: PageChatMessageSentEventTrigger.InlineAI,
        skipScreenshot: true,
        role: 'user',
        query: prompt.label,
        useContext: true
      })
    }

    telemetry.trackUsePrompt(PromptType.Custom, EventContext.Inline)
  }

  onMount(() => {
    if (document.body.classList.contains('onboarding')) {
      document.dispatchEvent(new CustomEvent(CompletionEventID.UseVision, { bubbles: true }))
    }
  })
</script>

<svelte:window
  on:mousedown|capture={handleWindowMouseDown}
  on:mousemove={handleWindowMouseMove}
  on:keydown={handleKeyDown}
/>

<!-- DEBUG
<div
  style="position: fixed; background: #000;color:#fff;top: 0; width:25ch;right: 0;padding:0.5rem;z-index: 999999999999999999999;"
>
  isMouseInRect: {$state.isMouseInRect}<br />
  isLocked: {$state.isLocked}<br />
  isCapturing: {$state.isCapturing}<br />
  isSelecting: {$state.isSelecting}<br />
  isResizing: {$state.isResizing}<br />
  resizeDirection: {$state.resizeDirection}<br />
  isMovingRect: {$state.isMovingRect}<br />
</div>-->

{#if !$state.isCapturing}
  <div
    bind:this={backdropEl}
    id="screen-picker-backdrop"
    class="no-drag"
    data-tooltip-anchor="screen-picker"
    class:disabled={$state.isLocked}
    style="view-transition-name: screen-picker-backdrop;"
    style:--rect-x={$_selectionRect.x + 'px'}
    style:--rect-y={$_selectionRect.y + 'px'}
    style:--rect-w={$_selectionRect.width + 'px'}
    style:--rect-h={$_selectionRect.height + 'px'}
    class:blurred={!fromTty || $_selectionRect.width + $_selectionRect.height > 2}
  >
    {#if !validRectSelection}
      <div class="instructions" class:edge={!fromTty} use:startingClass={{}}>
        <div class="icon"><Icon name="face.animated" size="0.5rem" /></div>
        Click and drag to use Vision
      </div>
    {/if}
  </div>
  {#if !$state.isLocked}
    <div
      id="screen-picker-frame"
      style:--rect-x={$_selectionRect.x + 'px'}
      style:--rect-y={$_selectionRect.y + 'px'}
      style:--rect-w={$_selectionRect.width + 'px'}
      style:--rect-h={$_selectionRect.height + 'px'}
    ></div>
  {/if}
  <div
    bind:this={pickerEl}
    id="screen-picker"
    style="view-transition-name: screen-picker;"
    class="mode-{mode}"
    class:insetTools={$state.insetTools}
    class:isLocked={$state.isLocked}
    class:isMouseInside={$state.isMouseInRect}
    class:isResizing={$state.isResizing !== false}
    class:isMovingRect={$state.isMovingRect}
    style:--rect-x={$_selectionRect.x + 'px'}
    style:--rect-y={$_selectionRect.y + 'px'}
    style:--rect-w={$_selectionRect.width + 'px'}
    style:--rect-h={$_selectionRect.height + 'px'}
    on:mousedown={handleRectMouseDown}
    on:mouseenter={() => {
      if ($state.isSelecting || $state.isLocked) return
      $state.isMouseInRect = true
    }}
    on:mouseleave={() => {
      if ($state.isSelecting || $state.isLocked) return
      $state.isMouseInRect = false
    }}
    role="none"
  >
    {#if showAddPromptDialog}
      <div
        id="tool-dialog"
        class="fixed inset-0 z-50 flex items-center justify-center"
        style="background: rgba(0 0 0 / 0.2);"
        transition:fade={{ duration: 133, easing: quartOut }}
      >
        <CreateAiToolDialog
          bind:el={addPromptEl}
          bind:show={showAddPromptDialog}
          app={appModalContent}
        />
      </div>
    {/if}
    {#if validRectSelection}
      <div
        class="toolbox mode-{mode}"
        style="view-transition-name: screen-picker-toolbox;"
        class:chatExpanded={$state.isChatExpanded}
        class:insetTools={$state.insetTools}
        bind:this={toolboxEl}
      >
        <ul>
          <li>
            <ul class="buttonGroup">
              {#if mode === 'standalone'}
                <!--<li>
                  <button on:click={handleSaveScreenshot}
                    ><Icon name="save" size="16px" /> Save</button
                  >
                </li>
                <li>
                  <button on:click={handleCopyScreenshot}
                    ><Icon name="copy" size="16px" /> Copy</button
                  >
                </li>-->
                <li>
                  <button on:click={handleSaveScreenshot}><Icon name="save" size="16px" /> </button>
                </li>
                <li>
                  <button on:click={handleCopyScreenshot}><Icon name="copy" size="16px" /> </button>
                </li>

                <li>
                  <button on:click={handleUseInChat}
                    ><Icon name="chat" size="16px" /> Use in Chat</button
                  >
                </li>
                {#if !$state.isChatExpanded}
                  <li>
                    <SelectDropdown
                      items={promptItems}
                      search="disabled"
                      selected={null}
                      footerItem={addPromptItem}
                      open={promptSelectorOpen}
                      side="right"
                      closeOnMouseLeave={false}
                      keepHeightWhileSearching
                      on:select={(e) => {
                        if (e.detail === addPromptItem.id) {
                          showAddPromptDialog = true
                          return
                        }
                        const app = get(ai.customAIApps).find((app) => app.id === e.detail)
                        if (!app) return
                        handleRunPrompt({
                          label: app.name ?? '',
                          prompt: (app.content || app.name) ?? ''
                        })
                      }}
                    >
                      <button class:active={$promptSelectorOpen}
                        ><Icon name="sparkles" /> Prompts</button
                      >

                      <div
                        slot="item"
                        class="w-full"
                        let:item
                        use:contextMenu={{
                          canOpen: item?.data,
                          items: [
                            {
                              type: 'action',
                              text: 'Edit',
                              icon: 'edit',
                              action: () => {
                                if (!item) return
                                const app = $customAiApps.find((app) => app.id === item.id)
                                if (!app) return
                                appModalContent.set(app)
                                showAddPromptDialog = true
                              }
                            },
                            {
                              type: 'action',
                              kind: 'danger',
                              text: 'Delete',
                              icon: 'trash',
                              action: async () => {
                                if (!item) return
                                const { closeType: confirmed } = await openDialog({
                                  message: `Are you sure you want to delete the prompt "${item.label}"?`
                                })
                                if (confirmed) ai.deleteCustomAiApp(item.id)
                                promptSelectorOpen.set(true)
                              }
                            }
                          ]
                        }}
                      >
                        <SelectDropdownItem {item} />
                      </div>
                    </SelectDropdown>
                  </li>
                {/if}
              {:else if mode === 'as-input'}
                <li>
                  <button on:click={handleAcceptAsInput}
                    ><Icon name="check" size="16px" /> Accept</button
                  >
                </li>
                <li>
                  <button on:click={handleClose}><Icon name="close" size="16px" /> Cancel</button>
                </li>
              {/if}
            </ul>
          </li>
        </ul>
        {#if mode === 'standalone' && !$state.isChatExpanded}
          <ChatInput
            loading={chatStatus && chatStatus === 'running'}
            on:submit={(e) => handlePromptInputSubmit(e.detail)}
            viewTransitionName={`chat-${$activeChat?.id || $note?.id}-input`}
          />
        {/if}

        {#if mode === 'standalone' && !$selectedModel.vision && !$state.isChatExpanded}
          <div class="vision-disclaimer">
            <div class="vison-disclaimer-icon">
              <Icon name="vision.off" size="19px" />
            </div>
            Vision not supported by {$selectedModel.label}.<br /> Switch models to use this screenshot
            in the chat.
          </div>
        {/if}
      </div>
      {#if mode === 'standalone' && ($note || $activeChat)}
        <!--{#if !$state.isChatExpanded}
          <div bind:this={appsEl} class="apps-wrapper flex flex-wrap gap-2 justify-center">
            <button
              on:click={() => (showAllApps = !showAllApps)}
              class="flex-shrink-0 max-w-64 flex items-center justify-center gap-2 px-2 py-1 w-fit rounded-xl transition-colors text-sky-800 bg-neutral-50 border-neutral-300 hover:bg-neutral-100 border-[1px] select-none overflow-hidden"
            >
              <!--<button
              class="text-sky-800 dark:text-gray-100 hover:bg-sky-300/60 p-[0.15em] rounded-md -ml-1"
              on:click|stopPropagation={() => (showCreateToolModal = true)}
            >
              <Icon name="add" />
            </button>--

              <div class="text-sky-800 w-full truncate font-medium">Show All Apps</div>
            </button>
            {#each $aiApps.slice(0, showAllApps ? Number.POSITIVE_INFINITY : 3) as app (app.id)}
              <PromptItem
                on:click={() =>
                  handleRunPrompt({
                    prompt: (app.content || app.name) ?? '',
                    label: app.name ?? ''
                  })}
                label={app.icon ? undefined : (app.name ?? '')}
                icon={app.icon}
              />
            {/each}
          </div>
        {/if}-->
        {#if $state.isChatExpanded}
          <div
            bind:this={chatboxEl}
            class="chatWrapper location-{$state.chatLocation}"
            class:expanded={$state.isChatExpanded}
          >
            <div
              class="messageBox"
              class:expanded={$state.isChatExpanded}
              data-tooltip-safearea="message-box"
              style="view-transition-name: screen-picker-chat;"
            >
              <header>
                <div class="messageBoxHeaderLeft">
                  <AppBarButton on:click={handleClose} data-tooltip-disable>
                    <Icon name="close" size="1rem" />
                  </AppBarButton>

                  {#if $userConfigSettings.experimental_notes_chat_sidebar}
                    {#if $note}
                      <NoteTitle note={$note} fallback="Vision Chat" small />
                    {/if}
                  {:else if $activeChat}
                    <ChatTitle chat={$activeChat} fallback="Vision Chat" small />
                  {/if}
                </div>

                <div class="messageBoxHeaderRight">
                  {#if $userConfigSettings.experimental_notes_chat_sidebar}
                    <AppBarButton on:click={handleOpenAsTab} data-tooltip-disable>
                      <Icon name="arrow.diagonal" size="1rem" />
                    </AppBarButton>
                  {/if}

                  <AppBarButton
                    on:click={handleExpandChat}
                    data-tooltip-target="open-in-sidebar-button"
                    data-tooltip-action={OnboardingAction.OpenNoteInSidebar}
                  >
                    <Icon name="sidebar.right" size="1rem" />
                  </AppBarButton>
                </div>
              </header>

              {#if $userConfigSettings.experimental_notes_chat_sidebar}
                {#if $note}
                  <Chat
                    bind:this={chatComponent}
                    note={$note}
                    inputOnly={!$state.isChatExpanded}
                    on:clear-chat={() => {}}
                    on:clear-errors={() => {}}
                    on:close-chat
                    on:open-context-item
                    on:process-context-item
                    on:highlightWebviewText
                    on:seekToTimestamp
                  />
                {/if}
              {:else if $activeChat}
                <ChatOld
                  bind:this={chatComponent}
                  chat={$activeChat}
                  contextItemErrors={[]}
                  preparingTabs={false}
                  inputOnly={!$state.isChatExpanded}
                  showContextBar={false}
                  on:clear-chat={() => {}}
                  on:clear-errors={() => {}}
                  on:close-chat
                  on:open-context-item
                  on:process-context-item
                  on:highlightWebviewText
                  on:seekToTimestamp
                />
              {/if}
            </div>
          </div>
        {/if}
      {/if}
    {/if}
  </div>
{/if}

<style lang="scss">
  $transition-timing: 82ms;
  $transition-easing: cubic-bezier(0.19, 1, 0.22, 1);

  :global(body) {
    &:has(#screen-picker.isMouseInside:not(.isLocked)) #screen-picker {
      cursor: grab !important;
    }
    &:has(#screen-picker.isMovingRect) #screen-picker {
      cursor: grabbing !important;
    }
  }
  :global(body:has(#screen-picker) webview) {
    pointer-events: none !important;
  }
  :global(body:has(#screen-picker) #screen-picker .chatWrapper webview) {
    pointer-events: all !important;
  }

  #screen-picker-backdrop {
    position: fixed;
    inset: 0;
    isolation: isolate;

    z-index: 99;

    &.blurred {
      //background: rgb(0 0 0 / 0.25);
      backdrop-filter: blur(1.25px);
      background: rgba(0, 0, 0, 0.075);
    }
    //background: linear-gradient(to top, rgba(255, 255, 255, 2) 10%, rgba(255, 255, 255, 0) 100%);
    //background: radial-gradient(
    //  circle at 50% 109%,
    //  rgb(190 205 212 / 67%) 20%,
    //  rgba(255, 255, 255, 0) 70%
    //);
    &:not(.disabled) {
      cursor: crosshair;
    }

    clip-path: polygon(
      0% 0%,
      100% 0%,
      100% 100%,
      0% 100%,
      0% var(--rect-y),
      var(--rect-x) var(--rect-y),
      var(--rect-x) calc(var(--rect-y) + var(--rect-h)),
      calc(var(--rect-x) + var(--rect-w)) calc(var(--rect-y) + var(--rect-h)),
      calc(var(--rect-x) + var(--rect-w)) var(--rect-y),
      var(--rect-x) var(--rect-y),
      0% var(--rect-y)
    );
    margin-top: -3px;
    margin-left: -3px;

    .instructions {
      transition-property: opacity, transform;
      transition-duration: 145ms;
      transition-delay: 123ms;
      transition-timing-function: ease-out;
      --offsetY: 0px;

      position: fixed;
      bottom: 11.5rem;
      &.edge {
        bottom: 1rem;
      }
      left: 50%;
      transform: translateX(-50%) translateY(var(--offsetY, 0px));
      background: #222;
      background: var(--background-dark-p3);
      color: var(--text);
      padding-block: 0.5rem;
      padding-left: 1rem;
      padding-right: 1.25rem;
      font-size: 0.95rem;
      font-weight: 450;
      border-radius: 5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      user-select: none;
      pointer-events: none;
      border: var(--border-width) solid var(--border-color);

      &:global(._starting) {
        opacity: 0;
        --offsetY: 3px;
      }
      opacity: 1;

      .icon {
        margin-top: 1px;
      }
    }
  }

  #screen-picker-frame {
    pointer-events: none;
    box-sizing: content-box;
    position: absolute;
    z-index: 9993231322131232132131231231211240;

    top: var(--rect-y);
    left: var(--rect-x);
    width: var(--rect-w);
    height: var(--rect-h);
    margin-top: -6px;
    margin-left: -6px;

    background: none;
    box-sizing: content-box;
    border: 3px dotted #fff;
    border-radius: 0.75rem;
    // filter: invert(100%);
    mix-blend-mode: difference;

    mix-blend-mode: exclusion;
  }

  #screen-picker {
    position: absolute;
    z-index: 9993231322131232132131231231211240;

    top: var(--rect-y);
    left: var(--rect-x);
    width: var(--rect-w);
    height: var(--rect-h);

    anchor-name: --screen-picker;

    background: none;
    box-sizing: content-box;
    border-radius: 8px;
    //border: 3px dotted #fff;
    //backdrop-filter: invert(100%);
    // filter: invert(100%);
    // mix-blend-mode: exclusion;
    // mix-blend-mode: difference;

    // Makes the border fit outside the screenshot area
    margin-top: -3px;
    margin-left: -3px;
    &.isLocked {
      border: 3px solid #999;
    }

    &.isResizing .toolbox * {
      pointer-events: none !important;
    }

    &.insetTools {
      .toolbox {
        top: unset;
        bottom: calc(anchor(end) + 1em);
      }
      &:has(.expanded) .toolbox {
        bottom: calc(anchor(end) + 0.5em);
      }
      .messageBox {
        top: unset;
        bottom: calc(anchor(end) + 0em) !important;
      }
    }

    .toolbox {
      width: 100%;
      max-width: 44ch;
      pointer-events: all;

      display: flex;
      flex-direction: column;
      align-items: start;

      position: fixed;
      position-anchor: --screen-picker;
      top: calc(anchor(end) + 1em);
      left: calc(anchor(center));
      transform: translateX(-50%);
      z-index: 10;

      transition-property: top, left, bottom;
      transition-duration: $transition-timing;
      transition-timing-function: $transition-easing;

      --radii: 12px;

      &.mode-as-input {
        &:not(.insetTools) {
          ul.buttonGroup {
            border-bottom-left-radius: var(--radii) !important;
            border-bottom-right-radius: var(--radii) !important;
          }
        }
      }

      ul.buttonGroup {
        display: flex;
        align-items: center;
        width: fit-content;
        height: 100%;

        overflow: hidden;
        padding: 0.2em;

        background: light-dark(#fff, rgba(24, 24, 24, 1));
        border-radius: var(--radii);
        border: 1px solid currentColor;
        border-color: light-dark(rgba(0, 0, 0, 0.125), rgba(255, 255, 255, 0.085));

        color: light-dark(#222, #fff);
        font-weight: 450;
        letter-spacing: 0.13px;

        > li {
          --radii: calc(12px - 0.2em);

          display: flex;
          align-items: center;
          height: 100%;
          button {
            height: 100%;
            display: flex;
            align-items: center;
            gap: 0.5ch;
            padding: 0.25em 0.7em;
            letter-spacing: 0.01em;

            transition:
              background 65ms ease-out,
              color 65ms ease-out;

            &:hover,
            &.active {
              background: rgb(from #93c7fd r g b / 0.9);
              color: #222;

              :global(body.custom) & {
                background: var(--base-color);
                color: var(--contrast-color);
              }
            }
          }
        }
      }

      &.chatExpanded,
      &.mode-as-input {
        top: calc(anchor(end) - 0px) !important;
        left: calc(anchor(center) + 0em);
        width: fit-content;

        &:not(.insetTools) ul.buttonGroup {
          border-top-left-radius: 0;
          border-top-right-radius: 0;

          border-top: 0 !important;

          > li {
            button {
            }
          }

          > :first-child {
            border-bottom-left-radius: var(--radii) !important;
            border-bottom-right-radius: 0 !important;
            border-top-right-radius: 0 !important;
            border-top-left-radius: 0 !important;
            overflow: hidden;
          }
          > :last-child {
            border-bottom-right-radius: var(--radii) !important;
            border-bottom-left-radius: 0 !important;
            border-top-right-radius: 0 !important;
            border-top-left-radius: 0 !important;
            overflow: hidden;
          }
        }

        &.insetTools {
          top: unset !important;
          bottom: calc(anchor(end) + 3px) !important;

          ul.buttonGroup {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            border-bottom: 0 !important;

            > :first-child {
              border-top-left-radius: var(--radii) !important;
              border-bottom-right-radius: 0 !important;
              border-top-right-radius: 0 !important;
              border-bottom-left-radius: 0 !important;
              overflow: hidden;
            }
            > :last-child {
              border-top-right-radius: var(--radii) !important;
              border-bottom-left-radius: 0 !important;
              border-bottom-right-radius: 0 !important;
              border-top-left-radius: 0 !important;
              overflow: hidden;
            }
          }
        }
      }

      &:not(.chatExpanded) {
        ul.buttonGroup {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border-bottom: 0 !important;

          > :first-child {
            border-top-left-radius: var(--radii) !important;
            border-bottom-right-radius: 0 !important;
            border-top-right-radius: 0 !important;
            border-bottom-left-radius: 0 !important;
            overflow: hidden;
          }
          > :last-child {
            border-top-right-radius: var(--radii) !important;
            border-bottom-left-radius: 0 !important;
            border-top-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
            overflow: hidden;
          }
        }
      }

      > ul {
        margin-left: 1em;
        display: flex;
        gap: 1ch;
        align-items: center;
        font-size: 0.9em;
        pointer-events: auto;

        .separator {
          height: 20px;
          border-right: 2px solid #fff;
        }
      }
    }

    .apps-wrapper {
      position: fixed;
      position-anchor: --screen-picker;
      top: calc(anchor(end) + 6.5em);
      left: calc(anchor(center));
      position-try-fallbacks: top center;
      transform: translateX(-50%);
      overflow: visible;

      width: 100%;
      max-width: 36ch;

      transition-property: top, left, bottom;
      transition-duration: $transition-timing;
      transition-timing-function: $transition-easing;
    }

    .chatWrapper {
      position: fixed;
      inset: 0;
      position-anchor: --screen-picker;
      min-width: 52ch;

      transition-property: top, left, bottom;
      transition-duration: $transition-timing;
      transition-timing-function: $transition-easing;

      &:not(.expanded) {
        display: contents;
      }

      &.location-left {
        //width: calc(anchor(start));
        right: calc(anchor(start));
        flex-direction: row-reverse;
      }
      &.location-right {
        left: calc(anchor(end));
        flex-direction: row;
      }

      //     background: rgba(0, 0, 123, 0.4);
      display: flex;
      padding: 1em;

      .messageBox {
        width: 100%;
        height: 100%;
        max-width: min(50ch, 45vw);
        max-height: 10ch;
        min-height: 10ch;

        display: flex;
        flex-direction: column;

        background: transparent;
        border-radius: 11px;
        overflow: hidden;

        pointer-events: all;
        cursor: default;

        > header {
          //height: 3em;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1em;
          padding: 0.5em 0.5em;
          width: 100%;

          font-size: 0.9em;

          background: light-dark(#fff, #101827);
          color: #ababab;
          border-bottom: 1px solid light-dark(#eee, #454545);

          .messageBoxHeaderLeft {
            display: flex;
            align-items: center;
            gap: 0.5em;
            width: 100%;
            overflow: hidden;

            > div {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          }

          .messageBoxHeaderRight {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 0.5em;
            overflow: visible;
          }

          button {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 0.4ch;
            padding: 0.25em 0.45em;

            border-radius: 7px;

            transition:
              background 65ms ease-out,
              color 65ms ease-out;

            &:hover {
              background: rgb(from #93c7fd r g b / 0.4);
              color: #222;
            }

            :global(body.custom) & {
              &:hover {
                background: var(--base-color);
                color: var(--contrast-color);
              }
            }
          }
        }

        &.expanded {
          max-width: 57ch;
          max-width: min(60ch, 45vw);
          max-height: 85vh;
          height: 100%;
          margin-block: auto;

          background: light-dark(#f3f3f3, #101827);
        }
        &:not(.expanded) {
          position: fixed;
          position-anchor: --screen-picker;
          bottom: calc(anchor(end) - 6.25em);
          left: calc(anchor(center));
          position-try-fallbacks: top center;
          transform: translateX(-50%);
          overflow: visible;

          transition-property: top, left, bottom;
          transition-duration: $transition-timing;
          transition-timing-function: $transition-easing;
        }
      }
    }
  }

  .vision-disclaimer {
    z-index: 1;
    margin-left: 1em;
    display: flex;
    align-items: center;
    gap: 0.75em;
    width: fit-content;
    height: 100%;

    overflow: hidden;
    padding: 0.45em 0.75em;

    color: rgb(241, 152, 64);
    background: #fff;
    border-radius: var(--radii);
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border-top: 0 !important;

    font-weight: 450;
    letter-spacing: 0.01em;
    font-size: 0.8em;
    pointer-events: auto;
  }

  .vision-disclaimer-icon {
    flex-shrink: 0;
  }

  /* :global(#screen-picker .chatWrapper .chat-input-wrapper) {
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 1.25em;
    --text-color-dark: #222;
  }*/
  :global(#screen-picker .chatWrapper .suggestion-items) {
    padding-inline: -0.25rem;
  }

  :global(#screen-picker .chatWrapper .chat.bg-gradient-to-t) {
    background: none;
    box-shadow: none !important;
  }
  :global(body.custom #screen-picker .chatWrapper .chat .submit-button) {
    background: var(--base-color);
    color: var(--contrast-color);

    &:hover {
      background: color-mix(in hsl, var(--base-color), 15% hsl(0, 0%, 0%));
    }
    :global(body.dark) &:hover {
      background: color-mix(in hsl, var(--base-color), 20% hsl(0, 0%, 100%));
    }
  }

  :global(.prompt-item) {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .icon {
      max-width: 1.25rem;
      max-height: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 1rem;
      font-weight: 400;
    }
  }

  :global(body.onboarding #screen-picker-backdrop .instructions) {
    bottom: 1rem !important;
  }
</style>
