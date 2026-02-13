<script lang="ts">
  import { fade, slide } from 'svelte/transition'
  import { writable, derived } from 'svelte/store'
  import { focus } from 'focus-svelte'

  import type { Action, ActionPanelOption } from './types'
  import { useTeletype } from './index'
  import Breadcrumb from './Breadcrumb.svelte'
  import ActionList from './ActionList.svelte'
  import { DynamicIcon, Icon } from '@deta/icons'
  import ActionPanel from './ActionPanel.svelte'
  import { onMount, tick, createEventDispatcher, type Snippet } from 'svelte'
  import { isDev, isMac } from '@deta/utils/system'
  import { Editor, type MentionItem } from '@deta/editor'
  import { createRemoteMentionsFetcher } from '@deta/services/ai'
  import { Button } from '@deta/ui'
  import { ShortcutVisualizer } from '@deta/ui'
  import '@deta/editor/src/editor.scss'
  import { parseStringIntoBrowserLocation } from '@deta/utils/formatting'

  const dispatch = createEventDispatcher<{
    clear: void
    ask: { query: string; mentions: MentionItem[] }
    'create-note': { content: string }
    input: { query: string; mentions: MentionItem[] }
    'search-web': { query: string }
    'actions-rendered': boolean
  }>()

  let {
    tools,
    key,
    preferredActionIndex = null,
    hideNavigation = false
  }: {
    tools: Snippet
    key?: string | undefined
    preferredActionIndex?: number | null
    hideNavigation?: boolean
  } = $props()

  const teletype = useTeletype(key)

  const open = teletype.isOpen
  const loading = teletype.isLoading
  const actions = teletype.actions
  const prefillInput = teletype.prefillInput
  const placeholderText = teletype.placeholder
  const inputValue = teletype.inputValue
  const breadcrumb = teletype.breadcrumb
  const currentAction = teletype.currentAction
  const selectedAction = teletype.selectedAction
  const animations = teletype.animations
  const showHelper = teletype.options?.showHelper
  const showActionPanel = teletype.showActionPanel
  const editMode = teletype.editMode

  const localIsMac = isMac()

  let showModalOverlay = false
  let mentions: MentionItem[] = []
  let modalContent: Action | null = null
  const inputValueWithoutMentions = writable('')

  $effect(() => {
    if (!mentions || mentions.length === 0 || !$inputValue) {
      inputValueWithoutMentions.set($inputValue || '')
      return
    }

    let cleanedValue = $inputValue

    mentions.forEach((mention) => {
      const mentionPattern = new RegExp(`@${mention.label}\\s*`, 'g')
      cleanedValue = cleanedValue.replace(mentionPattern, '')
    })

    inputValueWithoutMentions.set(cleanedValue.trim())
  })

  const isModal = $derived(
    $currentAction?.view === 'Modal' ||
      $currentAction?.view === 'ModalLarge' ||
      $currentAction?.view === 'ModalSmall'
  )

  let editorComponent: Editor
  let hasMentions = $state(false)
  let isInMentionMode = $state(false)

  // Focus the input field on open (used when capturing keys)
  const handleOpen = async () => {
    if ($prefillInput) {
      inputValue.set($prefillInput)
      prefillInput.set('')
    }

    await tick()

    editorComponent?.focus()
  }

  const handleClose = () => {
    inputValue.set('')
    editorComponent?.blur()
    $showActionPanel = false
    showModalOverlay = false
    modalContent = null
    selectedAction.set(null)
  }

  // Catch when the menu opens and closes
  open.subscribe((value) => {
    if (value) handleOpen()
    else handleClose()
  })

  const placeholder = $derived(
    hideNavigation ? 'Ask a question...' : 'Search the web, enter a URL or ask a question...'
    // $currentAction && $currentAction.placeholder ? $currentAction.placeholder : $placeholderText
  )

  // Since providers handle filtering, we just pass through the actions
  const filteredResult = derived([actions, currentAction], ([actions, currentAction]) => {
    // If we have a current action with results, use those
    if (currentAction && currentAction.actionsResult) {
      return currentAction.actionsResult
    }

    // Otherwise, filter out hidden actions and fallback actions
    return actions.filter((action) => !action?.hidden && action.id !== '__fallback')
  })

  const closeTeletype = () => {
    teletype.close()
    showModalOverlay = false
    modalContent = null
  }

  const openTeletype = () => teletype.open()

  const clearTeletype = () => {
    dispatch('clear')
    editorComponent?.setContent('')
  }

  const handleModalClose = () => {
    if (!$currentAction?.forceSelection) {
      closeTeletype()
    }
  }

  const callAction = async (action: Action) => {
    const isModalView =
      action.view === 'Modal' || action.view === 'ModalLarge' || action.view === 'ModalSmall'

    if (isModalView) {
      teletype.showAction(action)
      return
    }

    await teletype.executeAction(action)

    clearTeletype()

    if (action.requireInput) {
      editorComponent?.focus()
      inputValue.set('')
      return
    }

    if (resetActionList) resetActionList()
    editorComponent?.focus()
    inputValue.set('')
  }

  let resetActionList: () => void
  const handleActionClick = (e: CustomEvent<Action>) => {
    const action = e.detail as Action

    callAction(action)
  }

  const handleBackClick = async () => {
    teletype.showParentAction()
    await tick()
    editorComponent?.focus()
  }

  const handleInputKey = async (e: KeyboardEvent) => {
    if (e.key === 'Backspace' && $inputValue.length === 0) {
      if ($currentAction?.forceSelection === true) return

      e.preventDefault()
      if ($currentAction) {
        teletype.showParentAction()
        return
      }
    }

    if (e.metaKey && $filteredResult) {
      const action = $filteredResult.find((action) => action.shortcut === e.key)
      if (!action) return

      e.preventDefault()

      callAction(action)
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      if ($currentAction?.requireInput) {
        e.preventDefault()
        callAction($currentAction)
      } else if (isEmpty && fallbackAction) {
        e.preventDefault()
        e.stopPropagation()
        callAction(fallbackAction)
      }
    }
  }

  const handleEditorUpdate = (content: string) => {
    const mentionInProgressPattern = /@[\w\s]*$/

    // Check if content contains mentions using the editor's mention detection
    if (editorComponent) {
      const data = editorComponent.getParsedEditorContent()
      const hasMultipleLines = data.text.trim().includes('\n')
      mentions = data.mentions || []
      hasMentions = mentions && mentions.length > 0
      isInMentionMode = mentionInProgressPattern.test(data.text.trim()) || hasMultipleLines
    } else {
      // Fallback to simple pattern matching
      const mentionPattern = /@\w+/g
      const hasMultipleLines = content.includes('\n')
      hasMentions = mentionPattern.test(content)

      // Check if currently in mention selection mode (@ followed by text but not completed)
      isInMentionMode = mentionInProgressPattern.test(content.trim()) || hasMultipleLines
    }

    if (isInMentionMode) {
      selectedAction.set(null)
    }

    dispatch('input', { query: content, mentions })
  }

  // const handleAskClick = (e: MouseEvent) => {
  //   e.stopPropagation()
  //   if ($selectedAction?.id === 'search' && $inputValue) {
  //     dispatch('ask', $inputValue)
  //   }
  // }

  const handleHelperClick = () => {
    teletype.showAction('teletype-helper')
  }

  type ActionType = 'ask' | 'create-note' | 'search-web' | 'selected' | 'navigate'

  let ttyActions = $derived.by(() => {
    let actions: { primary: ActionType | null; secondary: ActionType | null } = {
      primary: null,
      secondary: null
    }

    if (hideNavigation) {
      const canNavigate =
        $inputValue &&
        $inputValue.trim().length > 0 &&
        !!parseStringIntoBrowserLocation($inputValue)
      if (canNavigate) {
        actions.primary = 'navigate'
        actions.secondary = 'ask'

        return actions
      }

      actions.primary = 'ask'

      if ($inputValue && $inputValue.length > 0) {
        actions.secondary = 'create-note'
      }

      return actions
    }

    if (!$selectedAction || $selectedAction?.id === 'ask-action') {
      actions.primary = 'ask'
    } else {
      actions.primary = 'selected'
    }

    if (isInMentionMode || hasMentions) {
      actions.secondary = null
    } else if (!$selectedAction || $selectedAction?.id === 'ask-action') {
      actions.secondary = 'search-web'
    } else if (
      ($selectedAction as any)?.providerId === 'search' ||
      ($selectedAction as any)?.providerId === 'current-query'
    ) {
      actions.secondary = 'ask'
    } /* else if (($selectedAction as any)?.providerId === 'navigation' || ($selectedAction as any)?.providerId === 'hostname-search') {
      actions.secondary = 'search-web'
    }*/

    return actions
  })

  const executeAction = (actionType: ActionType | null) => {
    if (!actionType) return

    if (actionType === 'ask') {
      const providerId = $selectedAction
        ? (($selectedAction as any).providerId as string)
        : undefined
      if (providerId === 'search' || providerId === 'current-query') {
        handleAsk($selectedAction.name)
      } else {
        handleAsk()
      }
    } else if (actionType === 'create-note') {
      handleCreateNote()
    } else if (actionType === 'search-web') {
      handleSearchWeb()
    } else if (actionType === 'selected' && $selectedAction) {
      callAction($selectedAction)
    } else if (actionType === 'navigate') {
      dispatch('search-web', { query: $inputValue })
    } else {
      console.warn('No action defined', actionType)
    }
  }

  const handleSubmit = (modKeyPressed: boolean) => {
    if (!$inputValue || $inputValue.length === 0) return

    if (modKeyPressed && ttyActions.secondary) {
      executeAction(ttyActions.secondary)
    } else if (ttyActions.primary) {
      executeAction(ttyActions.primary)
    } else {
      console.warn('No primary action defined')
    }
  }

  const handleAsk = (query?: string) => {
    mentions = editorComponent.getMentions()
    dispatch('ask', { query: query || $inputValue, mentions })
    clearTeletype()
  }

  const handleCreateNote = () => {
    const content = editorComponent.getParsedEditorContent()
    dispatch('create-note', { content: content.html ?? content.text })
    clearTeletype()
  }

  const handleSearchWeb = () => {
    if (!$inputValue || $inputValue.length === 0) return
    dispatch('search-web', { query: $inputValue })
    clearTeletype()
  }

  $effect(() => {
    if ($showActionPanel) {
      editorComponent?.blur()
    }
  })

  const handleSelectedAction = (e: CustomEvent<Action>) => {
    selectedAction.set(e.detail)
  }

  const handleActionOptionsKeyDown = (e: KeyboardEvent) => {
    // Only handle shortcuts when an action is actually selected
    if (!$selectedAction) return
    if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
      $showActionPanel = !$showActionPanel
    } else if (e.key === 'Backspace') {
      $showActionPanel = false
    }
  }

  const handleActionOptionClick = async (e: CustomEvent<ActionPanelOption>) => {
    const option = e.detail

    if (option.handler) {
      const result = await option.handler(option, teletype)
      if (typeof result === 'object' && result.preventClose) {
        $showActionPanel = false
        return
      }
      if (result?.afterClose) {
        result.afterClose(teletype)
      }
    } else if (option.action) {
      $showActionPanel = false
      callAction(option.action)
    }
  }

  // NOTE: Actions panel CMD + X breaks page in infinite loop with this when trying to cut text
  //onMount(() => {
  //  $showActionPanel = false
  //  const handler = (e: KeyboardEvent) => handleActionOptionsKeyDown(e)
  //  document.addEventListener('keydown', handler)
  //  return () => document.removeEventListener('keydown', handler)
  //})

  const fallbackAction = $derived($actions.find((action) => action.id === '__fallback'))

  const isEmpty = $derived(
    (!$filteredResult || !Array.isArray($filteredResult) || $filteredResult.length <= 0) &&
      !$currentAction?.component &&
      !$currentAction?.lazyComponent &&
      !$loading &&
      !$currentAction?.requireInput
  )

  const navigationMode = $derived(
    $selectedAction &&
      ($selectedAction?.id.startsWith('hostname-') ||
        $selectedAction?.id.startsWith('navigation-') ||
        !(
          $selectedAction?.providerId === 'search' ||
          $selectedAction?.providerId === 'current-query'
        ))
  )

  const mentionItemsFetcher = createRemoteMentionsFetcher()

  $effect(() => {
    dispatch('actions-rendered', $currentAction ? true : false)
  })

  $effect(() => {
    if (isEmpty) {
      if (fallbackAction) {
        selectedAction.set(fallbackAction)
      } else {
        selectedAction.set(null)
      }
    }
  })

  $effect(() => {
    if (
      ($currentAction?.component || $currentAction?.lazyComponent) &&
      $currentAction?.showActionPanel
    ) {
      selectedAction.set($currentAction)
    }
  })

  $effect(() => {
    if (editorComponent && !teletype.editorComponent) {
      teletype.attachEditor(editorComponent)
    }
  })

  onMount(() => {
    if ($open) {
      editorComponent?.focus()
    }

    if (editorComponent && isDev) {
      // @ts-ignore
      window.editor = editorComponent
    }
  })
</script>

<div id="tty-{key || 'default'}" class="tty-core" class:open={$open} class:loading={$loading}>
  {#if $currentAction && ($currentAction.breadcrumb || $breadcrumb || (!$currentAction.component && !$currentAction.lazyComponent))}
    <div class="breadcrumbs">
      {#if !$currentAction.component && !$currentAction.lazyComponent}
        <div
          role="button"
          onclick={handleBackClick}
          onkeydown={handleInputKey}
          class="back-btn"
          tabindex="0"
        >
          ←
        </div>
      {/if}
      {#if $currentAction.breadcrumb || $breadcrumb}
        <Breadcrumb
          text={$currentAction?.breadcrumb || $breadcrumb.text}
          icon={$currentAction?.icon || $breadcrumb?.icon}
        />
      {/if}
    </div>
  {/if}
  <div class="box" class:modal-content={isModal}>
    <div class="box-inner">
      <slot name="header" />
      {#if $open}
        {#if $currentAction?.titleText && !$loading}
          <div class="title">{$currentAction.titleText}</div>
        {/if}

        {#if isModal && ($currentAction?.component || $currentAction?.lazyComponent)}
          <div class="modal-component-wrapper" use:focus={$currentAction?.view === 'ModalLarge'}>
            {#if $currentAction?.component}
              <svelte:component
                this={$currentAction.component}
                action={$currentAction}
                {teletype}
                teletypeInputValue={inputValue}
                {...$currentAction.componentProps}
              />
            {:else if $currentAction?.lazyComponent}
              <Lazy
                component={$currentAction.lazyComponent}
                action={$currentAction}
                {teletype}
                teletypeInputValue={inputValue}
                {...$currentAction.componentProps}
              />
            {/if}
          </div>
        {:else}
          <!-- Move content rendering after footer/input -->
        {/if}
      {/if}
      <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
      <div class="footer" onclick={() => !isModal && openTeletype()} role="none">
        <!-- svelte-ignore a11y-missing-attribute -->
        <!--<div class="icon-wrapper">
          {#if $editMode}
            <Icon name="edit" size="20px" color="--(text)" />
          {:else if navigationMode && $selectedAction?.icon && typeof $selectedAction.icon === 'string'}
            <DynamicIcon
              name={$selectedAction.icon.startsWith('favicon') ? 'world' : $selectedAction.icon}
              size="20px"
              color="--(text)"
            />
          {:else if navigationMode}
            <Icon name="search" size="20px" color="--(text)" />
          {:else}
            <Icon name="face" size="20px" color="--(text)" />
          {/if}
        </div>-->
        {#if isModal}
          <p>{$currentAction.footerText || 'Teletype'}</p>
          <div
            role="button"
            class="close"
            onclick={(e) => {
              e.stopPropagation()
              closeTeletype()
            }}
            onkeydown={handleInputKey}
          >
            Close
          </div>
        {:else}
          {#if $currentAction?.footerText}
            <p class="forced-footer">{$currentAction.footerText}</p>
          {:else}
            <Editor
              bind:this={editorComponent}
              bind:content={$inputValue}
              {placeholder}
              placeholderNewLine={placeholder}
              submitOnEnter={true}
              autofocus={true}
              parseMentions={true}
              {mentionItemsFetcher}
              mentionConfig={{
                preventReTrigger: false,
                dismissOnSpace: false,
                allowSpaces: true
              }}
              on:mention-click={(e) => {
                // Handle mention clicks - find and execute the action
                const mentionItem = e.detail.item
                const action = $actions.find((a) => a.id === mentionItem.id)
                if (action) {
                  callAction(action)
                }
              }}
              on:update={(e) => {
                // Extract plain text from HTML content for filtering
                const tempDiv = document.createElement('div')
                tempDiv.innerHTML = e.detail
                const plainText = tempDiv.textContent || tempDiv.innerText || ''
                inputValue.set(plainText)
                handleEditorUpdate(plainText)
              }}
              on:submit={(e) => handleSubmit(e.detail)}
            />
          {/if}

          {#if $open && $selectedAction}
            {#if $showActionPanel}
              <ActionPanel
                options={$selectedAction.actionPanel || []}
                action={$selectedAction}
                on:execute={handleActionOptionClick}
                on:default={() => callAction($selectedAction)}
              />
            {/if}
          {/if}

          {#if $open && $selectedAction}
            {#if $showActionPanel}
              <ActionPanel
                options={$selectedAction.actionPanel || []}
                action={$selectedAction}
                on:execute={handleActionOptionClick}
                on:default={() => callAction($selectedAction)}
              />
            {/if}
          {/if}
        {/if}
      </div>

      <!-- Results section moved below input -->
      <div class="tools-and-send-wrapper">
        <slot
          name="tools"
          disabled={!isInMentionMode && !hasMentions && $selectedAction?.id !== 'ask-action'}
        ></slot>

        <div class="send-button-wrapper" transition:fade={{ duration: 150 }}>
          {#if ttyActions.secondary}
            <Button
              size="md"
              onclick={() => executeAction(ttyActions.secondary)}
              class="secondary-button"
              disabled={$inputValueWithoutMentions.length === 0}
            >
              {#if ttyActions.secondary === 'ask'}
                Ask Surf
              {:else if ttyActions.secondary === 'create-note'}
                Create Note
              {:else if ttyActions.secondary === 'search-web'}
                Search Web
              {:else if ttyActions.secondary === 'selected'}
                {$selectedAction?.buttonText || 'Execute'}
              {/if}

              <ShortcutVisualizer
                shortcut={{ mac: ['cmd', 'return'], win: ['ctrl', 'return'] }}
                size="tiny"
                color="#e4e7ff"
              />
            </Button>
          {/if}

          <Button
            size="md"
            onclick={() => executeAction(ttyActions.primary)}
            class="send-button"
            disabled={$inputValueWithoutMentions.length === 0}
          >
            {#if ttyActions.primary === 'ask'}
              Ask Surf
            {:else if ttyActions.primary === 'create-note'}
              Create Note
            {:else if ttyActions.primary === 'search-web'}
              Search Web
            {:else if ttyActions.primary === 'navigate'}
              Navigate
            {:else if ttyActions.primary === 'selected'}
              {$selectedAction?.buttonText || 'Search'}
            {/if}

            <ShortcutVisualizer shortcut={['return']} size="tiny" color="#6076f4" />
          </Button>
        </div>
      </div>
      {#if $open && !isModal}
        {#if $filteredResult && Array.isArray($filteredResult) && $filteredResult.length > 0 && $inputValue && $inputValue.length > 0 && !hasMentions && !isInMentionMode && !hideNavigation}
          <ActionList
            actions={$filteredResult}
            bind:resetActiveIndex={resetActionList}
            on:execute={handleActionClick}
            on:selected={handleSelectedAction}
            freeze={$showActionPanel}
            {preferredActionIndex}
          />
        {/if}
        {#if !$filteredResult || !Array.isArray($filteredResult) || $filteredResult.length <= 0}
          {#if $currentAction?.component}
            <div class="component-wrapper" use:focus={$currentAction?.view === 'ModalLarge'}>
              <svelte:component
                this={$currentAction.component}
                action={$currentAction}
                {teletype}
                teletypeInputValue={inputValue}
                {...$currentAction.componentProps}
              />
            </div>
          {:else if $currentAction?.lazyComponent}
            <div class="component-wrapper" use:focus={$currentAction?.view === 'ModalLarge'}>
              <Lazy
                component={$currentAction.lazyComponent}
                action={$currentAction}
                {teletype}
                teletypeInputValue={inputValue}
                {...$currentAction.componentProps}
              />
            </div>
          {:else if $loading}
            <div transition:slide class="loading-text">
              {$currentAction?.loadingPlaceholder ||
                fallbackAction?.loadingPlaceholder ||
                'Loading actions...'}
            </div>
          {:else if !$currentAction?.requireInput && $inputValue && $inputValue.length > 0 && $currentAction !== null}
            <div transition:slide class="empty">
              {fallbackAction?.placeholder
                ? fallbackAction.placeholder
                : 'Nothing found, try another search'}
            </div>
          {/if}
        {/if}
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .box {
    font-family: 'Inter';
    //max-height: min(calc(75vh - 6rem), 225px);
    color: var(--text);
    border-radius: var(--border-radius);
    display: flex;
    ////outline: 1px solid rgba(126, 168, 240, 0.05);
    // background: var(--background-dark);
    // background: var(--background-dark-p3);
    ////background: #fbfbff;
    ////background: color(display-p3 0.9843 0.9843 1);
    flex-direction: column;
    ////border: 0.5px solid rgba(0, 0, 0, 0.12);

    ////box-shadow:
    ////  inset 0px 1px 1px -1px white,
    ////  inset 0px -1px 1px -1px white,
    ////  inset 0px 30px 20px -20px rgba(255, 255, 255, 0.15),
    ////  0px 0px 5px 0px rgba(201, 220, 248, 0.3),
    ////  0px 0.25px 1.125px 0.25px rgba(126, 168, 240, 0.4),
    ////  0px 4px 4px 0px rgba(126, 168, 240, 0.05);
    // overflow: auto;

    &.modal-content {
      background: var(--background-dark);
      background: var(--background-dark-p3);
      width: 100%;
      height: 100%;
      max-height: calc(100vh - 4rem);
      display: flex;
      flex-direction: column;
    }
  }

  .box-inner {
    border-radius: 13px;
    margin: 0.5rem;
    ////background: #ffffff;
    flex: 1;
    display: flex;
    flex-direction: column;
    ////box-shadow:
    ////  0 0 0.47px 0 rgba(0, 0, 0, 0.18),
    ////  0 0.941px 2.823px 0 rgba(0, 0, 0, 0.1);
    ////box-shadow:
    ////  0 0 0.47px 0 color(display-p3 0 0 0 / 0.18),
    ////  0 0.941px 2.823px 0 color(display-p3 0 0 0 / 0.1);
  }

  .component-wrapper {
    overflow: auto;
  }

  .loading .box {
    position: relative;
    outline: none !important;
    transition: all 0.3s ease;

    &::before,
    &::after {
      content: '';
      position: absolute;
      top: -4px;
      left: -4px;
      right: -4px;
      bottom: -4px;
      /* border: 3px solid #ef39a97a; */
      /* animation: clippath 2s infinite linear; */
      border-radius: 28px;
    }

    &::after {
      border: 3px solid var(--text);
      animation:
        clippath 3s infinite -0.6s linear,
        fadeIn 0.3s ease-in;
      opacity: 1;
    }

    @keyframes clippath {
      0%,
      100% {
        clip-path: inset(0 95% 0 0);
      }

      25% {
        clip-path: inset(95% 0 0 0);
      }
      50% {
        clip-path: inset(0 0 0 95%);
      }
      75% {
        clip-path: inset(0 0 95% 0);
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  }

  input::placeholder {
    color: var(--text-light) !important;
  }

  .modal-content {
    background: var(--background-dark);
    background: var(--background-dark-p3);
    border-radius: var(--border-radius);
    width: 100%;
    max-width: 800px;
    max-height: calc(100vh - 4rem);
    overflow: hidden;
    display: flex;
    flex-direction: column;

    &:global(.modal-small) {
      max-width: 500px;
    }

    &:global(.modal-large) {
      max-width: 1536px;
      width: 80%;
    }
  }

  .modal-component-wrapper {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
  }

  .footer {
    //margin: 0.55rem;
    padding: 0.15rem 0.65rem 0 0.65rem;
    display: flex;
    align-items: start;
    border-radius: 11px;
    position: relative;
    ////background: #fff;
    //min-height: 125px;

    // no focus outline
    &:focus {
      outline: none;
    }

    & .icon-wrapper {
      margin-left: 0.15rem;
      margin-top: 0.55rem;
      margin-right: 0.2rem;
    }

    & input,
    .forced-footer {
      appearance: none;
      background: none;
      border: 0;
      outline: 0;
      padding: 0.075rem;
      margin-left: 0.25rem;
      color: var(--text);
      font-size: 1.25rem;
      font-family: inherit;
      width: 100%;
      height: 100%;
    }

    & :global(.editor) {
      flex: 1;
      margin-left: 0.25rem;
    }

    & :global(.editor-wrapper) {
      min-height: auto;
      height: auto;
    }

    & :global(.ProseMirror) {
      outline: none !important;
      border: none !important;
      padding: 0.075rem !important;
      font-size: 1rem !important;
      font-family: inherit !important;
      color: var(--text) !important;
      background: transparent !important;
    }

    & :global(.ProseMirror p) {
      margin: 0 !important;
      line-height: 1.85 !important;
    }

    .selected-actions {
      flex-shrink: 0;
      font-size: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-light);

      .selected-option {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        transition: transform 0.3s ease;
      }

      .selected-option:active {
        transform: scale(0.9);
      }

      .separator {
        width: 2px;
        border-radius: 2px;
        height: 25px;
        background: var(--border-color);
      }

      .shortcut {
        font-family: 'Inter';
        font-weight: 500;
        -webkit-font-smoothing: antialiased;
        font-smoothing: antialiased;
        font-size: 0.95rem;
        line-height: 0.925rem;
        height: 24px;
        min-width: 26px;
        text-align: center;
        padding: 6px 6px 7px 6px;
        border-radius: 5px;
        color: rgba(88, 104, 132, 1);
        background: rgba(88, 104, 132, 0.2);
        align-items: center;
        justify-content: center;
      }

      & p {
        margin: 0;
        margin-left: 0.25rem;
        font-size: 1.25rem;
        font-weight: 500;
      }

      & .close {
        margin-left: auto;
        font-size: 1.25rem;
        color: var(--text-light);
      }
    }
  }

  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .back-btn {
    width: fit-content;
    padding: 0.25rem 0.5rem;
    color: var(--text);
    background: var(--background-dark);
    border: 4px solid var(--border-color);
    border-radius: var(--border-radius);
    overflow: hidden;
    font-size: 1rem;
  }

  .title {
    font-weight: 400;
    padding: 0.65rem 0.75rem;
    border-bottom: 4px solid var(--border-color);
  }

  .empty,
  .loading-text {
    padding: 0.5rem;
    font-size: 1rem;
    color: var(--text-light);
    border-bottom: 4px solid var(--border-color);
  }

  .tools-and-send-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.5rem;
  }

  .send-button-wrapper {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  :global(.send-button[data-button-root]) {
    background: light-dark(#8c9dff, #6075f1);
    color: #fff;
    border-radius: 12px;
    padding: 0.25rem 0.33rem 0.25rem 0.5rem;
    min-width: 4.5rem;
    display: flex;
    justify-content: center;
    align-items: center;

    &:hover:not(&:disabled) {
      background: light-dark(#7d8ff3, #7d8ff3);
      color: #fff;
    }

    span.keycap {
      background: rgba(255, 255, 255, 0.265);
      color: #fff;
    }
  }

  :global(.secondary-button[data-button-root]) {
    background: transparent;
    color: var(--text);
    outline: light-dark(0.5px, 0) solid var(--border-color);
    outline-offset: -0.5px;
    border-radius: 12px;
    padding: 0.25rem 0.33rem 0.25rem 0.5rem;
    min-width: 4.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    background: transparent;

    &:hover:not(&:disabled) {
      background: light-dark(rgba(0, 0, 0, 0.033), rgba(255, 255, 255, 0.05));
      color: var(--text);
    }
  }

  span.keycap {
    font-family: 'Inter';
    font-weight: 500;
    -webkit-font-smoothing: antialiased;
    font-smoothing: antialiased;
    font-size: 0.8rem;
    line-height: 1rem;
    height: 20px;
    min-width: 20px;
    text-align: center;
    padding: 0px;
    border-radius: 5px;
    color: light-dark(rgba(88, 104, 132, 1), rgba(129, 146, 200, 1));
    background: light-dark(rgba(88, 104, 132, 0.2), rgba(129, 146, 200, 0.25));
    display: flex;
    align-items: center;
    justify-content: center;

    &:first-child {
      margin-left: 0.25rem;
    }
  }
</style>
