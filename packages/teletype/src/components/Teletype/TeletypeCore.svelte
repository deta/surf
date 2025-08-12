<script lang="ts">
  import { fade, slide } from 'svelte/transition'
  import Fuse from 'fuse.js'
  import { derived } from 'svelte/store'
  import { focus } from 'focus-svelte'

  import type { Action, ActionPanelOption } from './types'
  import { useTeletype } from './index'
  import Breadcrumb from './Breadcrumb.svelte'
  import ActionList from './ActionList.svelte'
  import { Icon } from '@deta/icons'
  import ActionPanel from './ActionPanel.svelte'
  import Lazy from './Lazy.svelte'
  import { onMount, tick, createEventDispatcher } from 'svelte'
  import { isMac } from '@deta/utils'

  const dispatch = createEventDispatcher()

  export let key: string | undefined = undefined

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
  let modalContent: Action | null = null

  $: isModal =
    $currentAction?.view === 'Modal' ||
    $currentAction?.view === 'ModalLarge' ||
    $currentAction?.view === 'ModalSmall'

  $: dispatch('actions-rendered', $currentAction ? true : false)

  let inputElem: HTMLInputElement
  let filteredActions = $actions

  // Focus the input field on open (used when capturing keys)
  const handleOpen = async () => {
    if ($prefillInput) {
      inputValue.set($prefillInput)
      prefillInput.set('')
    }

    await tick()

    inputElem?.focus()
  }

  const handleClose = () => {
    inputValue.set('')
    inputElem?.blur()
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

  $: placeholder =
    $currentAction && $currentAction.placeholder ? $currentAction.placeholder : $placeholderText

  onMount(() => {
    if ($open) {
      inputElem?.focus()
    }
  })

  const createFuse = (actions: Action[]) => {
    return new Fuse(actions, {
      threshold: 0.4,
      minMatchCharLength: 2,
      ignoreLocation: true,
      findAllMatches: true,
      distance: 100,
      keys: [
        {
          name: 'keywords',
          weight: 2
        },
        {
          name: 'name',
          weight: 1.5
        },
        {
          name: 'section',
          weight: 1
        },
        {
          name: 'horizontalItems.name',
          weight: 1
        },
        {
          name: 'childName',
          getFn: (action) => (action.nestedSearch ? action.name : ''),
          weight: 1
        },
        ...(teletype.options?.nestedSearch
          ? [
              { name: 'childActions.name', weight: 1 },
              { name: 'childActions.keywords', weight: 1.5 }
            ]
          : [])
      ]
    })
  }

  const filteredResult = derived(
    [actions, inputValue, currentAction, open],
    ([actions, inputValue, currentAction]) => {
      let result = actions

      // If local search is disabled, skip filtering actions
      if (!teletype.options?.localSearch) {
        return result
      }

      // If the current action is a ReactiveAction skip filtering and use its result
      if (currentAction && currentAction.inputHandler) {
        return currentAction.actionsResult || []
      }

      if (currentAction && currentAction.loadChildActions) {
        if (!inputValue) {
          return currentAction?.actionsResult
        }

        const fuse = createFuse(currentAction?.actionsResult)
        return fuse.search(inputValue).map(({ refIndex }) => currentAction?.actionsResult[refIndex])
      }

      // If we're searching, filter the actions but respect ignoreFuse
      if (inputValue) {
        const fuse = createFuse(actions)
        result = actions.filter(
          (action) =>
            action.ignoreFuse ||
            fuse.search(inputValue).some((match) => match.refIndex === actions.indexOf(action))
        )
      }

      const parentActionID = currentAction?.id || null

      // Allow skipping the parent filter if we are searching root actions and nestedSearch is enabled
      const skipParentFilter =
        parentActionID === null && inputValue && teletype.options?.nestedSearch

      result = result.filter((action) => {
        // skip filter if we are searching and action is allowed to be shown in nested search
        const parentAction = action.parent && actions.find((curr) => curr.id === action.parent)
        const allowNestedSearch = action?.nestedSearch || parentAction?.nestedSearch
        if (inputValue && allowNestedSearch && !currentAction?.requireInput) return true

        if (skipParentFilter) return true

        return action?.parent === parentActionID
      })

      // Filter out hidden actions
      result = result.filter((val) => !val?.hidden && val.id !== '__fallback')

      // Show "hidden" exact match actions
      const exactMatch = actions.find((action) => action?.activationKey === inputValue)
      if (exactMatch) {
        result.push(exactMatch)
      }

      return result
    }
  )

  const closeTeletype = () => {
    teletype.close()
    showModalOverlay = false
    modalContent = null
  }

  const openTeletype = () => teletype.open()

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

    if (action.requireInput) {
      inputElem?.focus()
      inputValue.set('')
      return
    }

    if (resetActionList) resetActionList()
    inputElem?.focus()
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
    inputElem?.focus()
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

    if (e.metaKey && filteredActions) {
      const action = filteredActions.find((action) => action.shortcut === e.key)
      if (!action) return

      e.preventDefault()

      callAction(action)
    }

    if (e.key === 'Enter') {
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

  const handleKeyUp = (e: KeyboardEvent) => {
    dispatch('input', inputElem.value)
  }

  const handleAskClick = (e: MouseEvent) => {
    e.stopPropagation()
    if ($selectedAction?.id === 'search' && $inputValue) {
      dispatch('ask', $inputValue)
    }
  }

  const handleHelperClick = () => {
    teletype.showAction('teletype-helper')
  }

  $: if ($showActionPanel) {
    inputElem?.blur()
  }

  const handleSelectedAction = (e: CustomEvent<Action>) => {
    selectedAction.set(e.detail)
  }

  const handleActionOptionsKeyUp = (e: KeyboardEvent) => {
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

  $: if ($selectedAction) {
    $showActionPanel = false
    document.addEventListener('keydown', handleActionOptionsKeyUp)
  } else {
    document.removeEventListener('keydown', handleActionOptionsKeyUp)
  }

  $: if (
    ($currentAction?.component || $currentAction?.lazyComponent) &&
    $currentAction?.showActionPanel
  ) {
    selectedAction.set($currentAction)
  }

  $: fallbackAction = $actions.find((action) => action.id === '__fallback')

  $: isEmpty =
    $filteredResult.length <= 0 &&
    !$currentAction?.component &&
    !$currentAction?.lazyComponent &&
    !$loading &&
    !$currentAction?.requireInput
  $: if (isEmpty) {
    if (fallbackAction) {
      selectedAction.set(fallbackAction)
    } else {
      selectedAction.set(null)
    }
  }
</script>

<div id="tty-{key || 'default'}" class="tty-core" class:open={$open} class:loading={$loading}>
  {#if $currentAction && ($currentAction.breadcrumb || $breadcrumb || (!$currentAction.component && !$currentAction.lazyComponent))}
    <div class="breadcrumbs">
      {#if !$currentAction.component && !$currentAction.lazyComponent}
        <div
          role="button"
          on:click={handleBackClick}
          on:keydown={handleInputKey}
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
        {#if $filteredResult && $filteredResult.length > 0}
          <ActionList
            actions={$filteredResult}
            bind:resetActiveIndex={resetActionList}
            on:execute={handleActionClick}
            on:selected={handleSelectedAction}
            freeze={$showActionPanel}
            value={inputValue}
          />
        {/if}
        {#if $filteredResult.length <= 0}
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
          {:else if !$currentAction?.requireInput && $inputValue.length > 0 && $currentAction !== null}
            <div transition:slide class="empty">
              {fallbackAction?.placeholder
                ? fallbackAction.placeholder
                : 'Nothing found, try another search'}
            </div>
          {/if}
        {/if}
      {/if}
    {/if}
    <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
    <div class="footer" on:click={() => !isModal && openTeletype()} tabindex={-1} role="none">
      <!-- svelte-ignore a11y-missing-attribute -->
      <div class="icon-wrapper">
        {#if $editMode}
          <Icon name="edit" size="20" color="--(text)" />
        {:else}
          <Icon name="search" size="24" color="--(text)" />
        {/if}
      </div>
      {#if isModal}
        <p>{$currentAction.footerText || 'Teletype'}</p>
        <div
          role="button"
          class="close"
          on:click|stopPropagation={closeTeletype}
          on:keydown={handleInputKey}
          tabindex="0"
        >
          Close
        </div>
      {:else}
        {#if $currentAction?.footerText}
          <p class="forced-footer">{$currentAction.footerText}</p>
        {:else}
          <input
            id="teletype-input-{key || 'default'}"
            type="text"
            autocomplete="off"
            aria-label="Teletype"
            bind:value={$inputValue}
            bind:this={inputElem}
            on:keydown={handleInputKey}
            on:keyup={handleKeyUp}
            on:paste={(e) => e.stopPropagation()}
            {placeholder}
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
          <div class="selected-actions">
            <div
              role="button"
              on:click|stopPropagation={() => callAction($selectedAction)}
              on:keydown={handleInputKey}
              class="selected-option"
              tabindex="0"
            >
              {$showActionPanel ? 'Select' : $selectedAction.actionText || 'Open'}
              <div class="shortcut">⏎</div>
            </div>

            {#if $selectedAction.id === 'search'}
              <div class="separator"></div>
              <div
                role="button"
                on:click|stopPropagation={handleAskClick}
                on:keydown={handleInputKey}
                class="selected-option"
                tabindex="0"
              >
                Ask
                <div class="shortcut">
                  {localIsMac ? '⌘' : 'Ctrl'}
                </div>
                <div class="shortcut">⏎</div>
              </div>
            {/if}

            {#if $selectedAction.actionPanel}
              <div class="separator"></div>
              <div
                role="button"
                on:click|stopPropagation={() => ($showActionPanel = !$showActionPanel)}
                on:keydown={handleInputKey}
                class="selected-option"
                class:active-option={$showActionPanel}
                tabindex="0"
              >
                {$showActionPanel ? 'Close' : 'Actions'}
                <div class="shortcut">
                  {window.navigator.userAgent.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'}
                </div>
                <div class="shortcut">X</div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- {#if showHelper && !$open}
          <div
            role="button"
            on:click|stopPropagation={handleHelperClick}
            on:keydown={handleInputKey}
            class="helper"
            tabindex="0"
          >
            <Icon name="face" />
          </div>
        {/if} -->
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .box {
    font-family: 'Inter';
    max-height: min(calc(75vh - 6rem), 600px);
    color: var(--text);
    border: var(--border-width) solid var(--border-color);
    border-radius: var(--border-radius);
    display: flex;
    outline: 1px solid rgba(126, 168, 240, 0.05);
    background: var(--background-dark);
    background: var(--background-dark-p3);
    flex-direction: column;
    box-shadow:
      inset 0px 1px 1px -1px white,
      inset 0px -1px 1px -1px white,
      inset 0px 30px 20px -20px rgba(255, 255, 255, 0.15),
      0px 0px 89px 0px rgba(0, 0, 0, 0.18),
      0px 4px 18px 0px rgba(0, 0, 0, 0.18),
      0px 1px 1px 0px rgba(126, 168, 240, 0.3),
      0px 4px 4px 0px rgba(126, 168, 240, 0.15);
    box-shadow:
      inset 0px 1px 4px -1px white,
      inset 0px -1px 1p2 0 white,
      inset 0px 30px 20px -20px color(display-p3 1 1 1 / 0.15),
      0px 0px 89px 0px color(display-p3 0 0 0 / 0.18),
      0px 4px 18px 0px color(display-p3 0 0 0 / 0.18),
      0px 1px 1px 0px color(display-p3 0.5294 0.6549 0.9176 / 0.3),
      0px 4px 4px 0px color(display-p3 0.5294 0.6549 0.9176 / 0.15);
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
    border: var(--border-width) solid var(--border-color);
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
    margin: 0.55rem;
    padding: 0.65rem 0.65rem;
    display: flex;
    border-radius: 11px;
    align-items: center;
    position: relative;
    background: #fff;
    box-shadow:
      0px 13px 4px 0px #003764,
      0px 8px 3px 0px rgba(0, 55, 100, 0.01),
      0px 5px 3px 0px rgba(0, 55, 100, 0.03),
      0px 2px 2px 0px rgba(0, 55, 100, 0.05),
      0px 1px 1px 0px rgba(0, 55, 100, 0.06);
    box-shadow:
      0px 13px 4px 0px color(display-p3 0.0078 0.2118 0.3804 / 0),
      0px 8px 3px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.01),
      0px 5px 3px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.03),
      0px 2px 2px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.05),
      0px 1px 1px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.06);

    //& img {
    //  width: 24px;
    //  margin-right: 0.25rem;
    //}

    & .icon-wrapper {
      margin-right: 0.2rem;
    }

    & input,
    .forced-footer {
      appearance: none;
      background: none;
      border: 0;
      outline: 0;
      padding: 0.25rem;
      color: var(--text);
      font-size: 1.25rem;
      font-family: inherit;
      width: 100%;
      height: 100%;
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
    }

    //& .helper {
    //  margin-left: auto;

    //  opacity: 0.8;

    //  :global(svg) {
    //    width: 20px;
    //    height: 20px;
    //    color: var(--text-light);
    //  }
    //}

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
</style>
