<script lang="ts">
  import Fuse from 'fuse.js'
  import { derived } from 'svelte/store'
  import logo from '../../assets/deta.svg'
  import { focus } from 'focus-svelte'

  import type { Action, ActionPanelOption } from './types'
  import { useTeletype } from './index'
  import Breadcrumb from './Breadcrumb.svelte'
  import ActionList from './ActionList.svelte'
  import Icon from './Icon.svelte'
  import ActionPanel from './ActionPanel.svelte'
  import Lazy from './Lazy.svelte'
  import { slide } from 'svelte/transition'
  import { onMount, tick } from 'svelte'

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
  const showHelper = teletype.options.showHelper
  const autoFocus = teletype.autoFocus

  $: isModal =
    $currentAction?.view === 'Modal' ||
    $currentAction?.view === 'ModalLarge' ||
    $currentAction?.view === 'ModalSmall'

  let inputElem
  let filteredActions = $actions

  let showActionPanel = false

  // Focus the input field on open (used when capturing keys)
  const handleOpen = async () => {
    if ($prefillInput) {
      inputValue.set($prefillInput)
      prefillInput.set('')
    }

    await tick()

    if ($autoFocus) {
      inputElem?.focus()
    }

  }

  const handleClose = () => {
    inputValue.set('')
    inputElem?.blur()
    showActionPanel = false
    $selectedAction = null
  }

  // Catch when the menu opens and closes
  open.subscribe(value => {
    if (value) handleOpen()
    else handleClose()
  })

  $: placeholder =
    $currentAction && $currentAction.placeholder
      ? $currentAction.placeholder
      : $placeholderText

  onMount(() => {
    if ($open && $autoFocus) {
      inputElem?.focus()
    }
  })

  const createFuse = (actions: Action[]) =>
    new Fuse(actions, {
      minMatchCharLength: 1,
      ignoreLocation: true,
      keys: [
        'name',
        'section',
        'keywords',
        {
          name: 'childName',
          getFn: action => (action.nestedSearch ? action.name : undefined),
        },
        {
          name: 'childKeywords',
          getFn: action => (action.nestedSearch ? action.keywords : undefined),
        },
        ...(teletype.options.nestedSearch
          ? ['childActions.name', 'childActions.keywords']
          : []),
      ],
      threshold: 0.3,
    })

  const filteredResult = derived(
    [actions, inputValue, currentAction, open],
    ([actions, inputValue, currentAction]) => {
      let result = actions

      // If local search is disabled, skip filtering actions
      if (!teletype.options.localSearch) {
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

        return fuse
          .search(inputValue)
          .map(({ refIndex }) => currentAction?.actionsResult[refIndex])
      }

      // If we're searching, filter the actions
      if (inputValue) {
        const fuse = createFuse(actions)

        result = fuse
          .search(inputValue)
          .map(({ refIndex }) => actions[refIndex])
      }

      const parentActionID = currentAction?.id || null

      // Allow skipping the parent filter if we are searching root actions and nestedSearch is enabled
      const skipParentFilter =
        parentActionID === null && inputValue && teletype.options.nestedSearch

      result = result.filter(action => {
        // skip filter if we are searching and action is allowed to be shown in nested search
        const parentAction =
          action.parent && actions.find(curr => curr.id === action.parent)
        const allowNestedSearch =
          action.nestedSearch || parentAction?.nestedSearch
        if (inputValue && allowNestedSearch && !currentAction?.requireInput)
          return true

        if (skipParentFilter) return true

        return action?.parent === parentActionID
      })

      // Filter out hidden actions
      result = result.filter(val => !val?.hidden && val.id !== '__fallback')

      // Show "hidden" exact match actions
      const exactMatch = actions.find(
        action => action?.activationKey === inputValue
      )
      if (exactMatch) {
        result.push(exactMatch)
      }

      return result
    }
  )

  const closeTeletype = () => teletype.close()
  const openTeletype = () => teletype.open()

  const callAction = async (action: Action) => {
    await teletype.executeAction(action)

    if (action.requireInput) {
      if ($autoFocus) inputElem?.focus()
      inputValue.set('')
      return
    }

    resetActionList()
    if ($autoFocus) inputElem?.focus()
    inputValue.set('')
  }

  let resetActionList
  const handleActionClick = e => {
    const action = e.detail as Action

    callAction(action)
  }

  const handleBackClick = () => {
    teletype.showParentAction()
  }

  const handleInputKey = e => {
    if (e.key === 'Backspace' && $inputValue.length === 0) {
      if ($currentAction?.forceSelection === true) return

      e.preventDefault()
      if ($currentAction) {
        teletype.showParentAction()
        return
      }

      closeTeletype()
    }

    if (e.metaKey && filteredActions) {
      const action = filteredActions.find(action => action.shortcut === e.key)
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

  const handleHelperClick = () => {
    teletype.showAction('teletype-helper')
  }

  $: if (showActionPanel) {
    inputElem?.blur()
  }

  const handleSelectedAction = (e: CustomEvent<Action>) => {
    $selectedAction = e.detail
  }

  const handleActionOptionsKeyUp = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
      showActionPanel = !showActionPanel
    } else if (e.key === 'Backspace') {
      showActionPanel = false
    }
  }

  const handleActionOptionClick = async (e: CustomEvent<ActionPanelOption>) => {
    const option = e.detail
    if (option.handler) {
      const result = await option.handler(option, teletype)
      if (typeof result === 'object' && result.preventClose) {
        showActionPanel = false
        return
      }
      if (result?.afterClose) {
        result.afterClose(teletype)
      }
    } else if (option.action) {
      showActionPanel = false
      callAction(option.action)
    }
  }

  $: if ($selectedAction) {
    showActionPanel = false
    document.addEventListener('keydown', handleActionOptionsKeyUp)
  } else {
    document.removeEventListener('keydown', handleActionOptionsKeyUp)
  }

  $: if (
    ($currentAction?.component || $currentAction?.lazyComponent) &&
    $currentAction?.showActionPanel
  ) {
    $selectedAction = $currentAction
  }

  $: fallbackAction = $actions.find(action => action.id === '__fallback')

  $: isEmpty =
    $filteredResult.length <= 0 &&
    !$currentAction?.component &&
    !$currentAction?.lazyComponent &&
    !$loading &&
    !$currentAction?.requireInput
  $: if (isEmpty) {
    if (fallbackAction) {
      $selectedAction = fallbackAction
    } else {
      $selectedAction = null
    }
  }
</script>

<div
  id="tty-{key || 'default'}"
  class="tty-core"
  class:open={$open}
  class:loading={$loading}
>
  {#if $currentAction && ($currentAction.breadcrumb || $breadcrumb || (!$currentAction.component && !$currentAction.lazyComponent))}
    <div class="breadcrumbs">
      {#if !$currentAction.component && !$currentAction.lazyComponent}
        <div on:click={handleBackClick} class="back-btn">←</div>
      {/if}
      {#if $currentAction.breadcrumb || $breadcrumb}
        <Breadcrumb
          text={$currentAction?.breadcrumb || $breadcrumb.text}
          icon={$currentAction?.icon || $breadcrumb?.icon}
        />
      {/if}
    </div>
  {/if}
  <div class="box">
    {#if $open}
      {#if $currentAction?.titleText && !$loading}
        <div class="title">{$currentAction.titleText}</div>
      {/if}
      {#if $filteredResult && $filteredResult.length > 0}
        <ActionList
          actions={$filteredResult}
          bind:resetActiveIndex={resetActionList}
          on:execute={handleActionClick}
          on:selected={handleSelectedAction}
          freeze={showActionPanel}
          animations={$animations}
        />
      {/if}
      {#if $filteredResult.length <= 0}
        {#if $currentAction?.component}
          <div
            class="component-wrapper"
            use:focus={$currentAction?.view === 'ModalLarge'}
          >
            <svelte:component
              this={$currentAction.component}
              action={$currentAction}
              {teletype}
              teletypeInputValue={inputValue}
              {...$currentAction.componentProps}
            />
          </div>
        {:else if $currentAction?.lazyComponent}
          <div
            class="component-wrapper"
            use:focus={$currentAction?.view === 'ModalLarge'}
          >
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
        {:else if !$currentAction?.requireInput}
          <div transition:slide class="empty">
            {fallbackAction?.placeholder
              ? fallbackAction.placeholder
              : 'Nothing found, try another search'}
          </div>
        {/if}
      {/if}
    {/if}
    <div
      class="footer"
      on:click={() => !isModal && openTeletype()}
      tabindex={-1}
    >
      <!-- svelte-ignore a11y-missing-attribute -->
      <img src={logo} alt="Deta Icon" />
      {#if isModal}
        <p>{$currentAction.footerText || 'Teletype'}</p>
        <div class="close" on:click|stopPropagation={closeTeletype}>Close</div>
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
            on:paste={e => e.stopPropagation()}
            {placeholder}
          />
        {/if}

        <!-- {JSON.stringify($selectedAction)} -->

        {#if $open && $selectedAction}
          {#if showActionPanel}
            <ActionPanel
              options={$selectedAction.actionPanel}
              action={$selectedAction}
              on:execute={handleActionOptionClick}
              on:default={() => callAction($selectedAction)}
            />
          {/if}
          <div class="selected-actions">
            {#if showActionPanel || !$currentAction || $currentAction.showActionPanel || ($filteredResult && $filteredResult.length > 0)}
              <div
                on:click|stopPropagation={() => callAction($selectedAction)}
                class="selected-option"
              >
                {showActionPanel
                  ? 'Select'
                  : $selectedAction.actionText || 'Open'}
                <div class="shortcut">⏎</div>
              </div>
            {/if}

            {#if $selectedAction.actionPanel}
              <div class="separator" />
              <div
                on:click|stopPropagation={() =>
                  (showActionPanel = !showActionPanel)}
                class="selected-option"
                class:active-option={showActionPanel}
              >
                {showActionPanel ? 'Close' : 'Actions'}
                <div class="shortcut">
                  {navigator.platform &&
                  navigator.platform.toUpperCase().indexOf('MAC') >= 0
                    ? '⌘'
                    : 'Ctrl'}
                </div>
                <div class="shortcut">X</div>
              </div>
            {/if}
          </div>

          <!-- {:else if $open && isEmpty && fallbackAction}
          <div class="selected-actions">
            <div
              on:click|stopPropagation={() => callAction(fallbackAction)}
              class="selected-option"
            >
              {fallbackAction ? fallbackAction.actionText : 'Open'}
              <div class="shortcut">⏎</div>
            </div>
          </div>-->
        {/if}

        {#if showHelper && !$open}
          <div on:click|stopPropagation={handleHelperClick} class="helper">
            <Icon name="beaker" />
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .box {
    max-height: min(calc(75vh - 6rem), 600px);
    background: var(--background-dark);
    color: var(--text);
    border: var(--border-width) solid var(--border-color);
    border-radius: var(--border-radius);
    outline: 4px solid var(--outline-color);
    display: flex;
    flex-direction: column;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    // overflow: auto;
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
      border: 3px solid #ef39a97a;
      animation: clippath 2s infinite linear;
      border-radius: var(--border-radius);
    }

    &::after {
      border: 3px solid #bd399c76;
      animation: clippath 3s infinite -0.6s linear;
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
  }

  input::placeholder {
    color: var(--text-light) !important;
  }

  .footer {
    padding: 0.6rem;
    display: flex;
    align-items: center;
    position: relative;

    & img {
      width: 24px;
      margin-right: 0.25rem;
    }

    & input,
    .forced-footer {
      appearance: none;
      background: none;
      border: 0;
      outline: 0;
      padding: 0.25rem;
      color: var(--text);
      font-size: 0.9rem;
      font-family: inherit;
      width: 100%;
      height: 100%;
    }

    .selected-actions {
      flex-shrink: 0;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-light);

      .selected-option {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        cursor: pointer;
        transition: transform 0.3s ease;
      }

      .selected-option:active {
        transform: scale(0.9);
      }

      .separator {
        width: 2px;
        height: 25px;
        background: var(--border-color);
      }

      .shortcut {
        padding: 4px 7px;
        border-radius: var(--border-radius);
        background: var(--background-accent);
      }
    }

    & .helper {
      margin-left: auto;
      cursor: pointer;
      opacity: 0.8;

      :global(svg) {
        width: 20px;
        height: 20px;
        color: var(--text-light);
      }
    }

    & p {
      margin: 0;
      margin-left: 0.25rem;
      font-size: 0.9rem;
      font-weight: 500;
    }

    & .close {
      margin-left: auto;
      font-size: 0.9rem;
      color: var(--text-light);
      cursor: pointer;
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
    cursor: pointer;
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
