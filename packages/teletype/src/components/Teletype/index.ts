/* eslint-disable @typescript-eslint/no-misused-promises */
import { getContext, setContext, tick } from 'svelte'
import { type Writable, writable, get } from 'svelte/store'

import type {
  Action,
  ActionPanelOption,
  Confirmation,
  LazyParentAction,
  Notification,
  Options
} from './types'
import { useDebounce } from '../../utils/debounce'
import { useLogScope } from '@deta/utils'
import type { Editor } from '@deta/editor'

class TeletypeCore {
  options?: Options
  defaultActions?: Action[]
  private readonly log = useLogScope('TeletypeCore')

  captureKeys: Writable<boolean>
  isShown: Writable<boolean>
  isOpen: Writable<boolean>
  showActionPanel: Writable<boolean>
  isLoading: Writable<boolean>
  placeholder: Writable<string>
  prefillInput: Writable<string>
  breadcrumb: Writable<{ text: string; icon?: Action['icon'] }>
  iconComponent: Options['iconComponent']
  animations: Writable<boolean>

  notifications: Writable<Notification[]>
  confirmationPrompt: Writable<Confirmation>

  actions: Writable<Action[]>
  currentAction: Writable<Action>
  selectedAction: Writable<Action>
  inputValue: Writable<string>
  editMode: Writable<boolean> = writable(false)

  editorComponent: Editor | undefined

  constructor(opts?: Options, defaultActions?: Action[]) {
    const defaultOpts = {
      show: true,
      open: false,
      loading: false,
      captureKeys: true,
      placeholder: 'Type a command or search',
      nestedSearch: false,
      iconComponent: undefined,
      localSearch: true,
      showHelper: false,
      animations: true
    }

    this.options = Object.assign({}, defaultOpts, opts)
    this.defaultActions = this.flattenActions(defaultActions || [])

    this.captureKeys = writable(this.options.captureKeys)
    this.isShown = writable(this.options.show)
    this.isOpen = writable(this.options.open)
    this.showActionPanel = writable(false)
    this.isLoading = writable(this.options.loading)
    this.placeholder = writable(this.options.placeholder)
    this.prefillInput = writable('')
    this.breadcrumb = writable(null)
    this.iconComponent = this.options.iconComponent
    this.animations = writable(this.options.animations)

    this.notifications = writable([])
    this.confirmationPrompt = writable(null)

    this.actions = writable(this.defaultActions)
    this.currentAction = writable(null)
    this.selectedAction = writable(null)
    this.inputValue = writable(null)
    this.editMode = writable(false)

    this.log.debug('TeletypeCore initialized with options:', opts)
  }

  get editModeValue() {
    return get(this.editMode)
  }

  get prefillInputValue() {
    return get(this.prefillInput)
  }

  attachEditor(editor: Editor) {
    this.editorComponent = editor
  }

  flattenActions(actions: Action[]) {
    const finalActions = []

    const parseActions = (actions: Action[], parent?: string) => {
      actions.forEach((action) => {
        // JS Magic: creates new object from action with added parent and removed childActions property
        const { childActions, ...newAction } = {
          ...action,
          ...(parent ? { parent } : { parent: action.parent || null })
        } as Action

        finalActions.push(newAction)

        if (childActions) {
          parseActions(childActions, action.id)
        }
      })
    }

    parseActions(actions)

    return finalActions as Action[]
  }

  setCaptureKeys(flag: boolean) {
    this.captureKeys.set(flag)
  }

  setIsShow(flag: boolean) {
    this.isShown.set(flag)
  }

  setLoading(flag: boolean) {
    this.isLoading.set(flag)
  }

  setEditMode(flag: boolean) {
    this.editMode.set(flag)
  }

  open() {
    this.isOpen.set(true)
  }

  async openWithText(text: string) {
    this.prefillInput.set(text)
    this.inputValue.set(text)

    if (!get(this.isOpen)) {
      this.isOpen.set(true)
    }
  }

  showConfirmationPrompt(confirmation: Confirmation) {
    const confirmationPrompt = {
      title: confirmation.title || 'Are you sure you want to do this?',
      message: confirmation.message || 'This action cannot be done.',
      showInput: confirmation.showInput || false,
      inputRequired: confirmation.inputRequired || false,
      placeholder: confirmation.placeholder || '',
      confirmText: confirmation.confirmText || 'Confirm',
      value: confirmation.value || '',
      cancelText: confirmation.cancelText || 'Cancel',
      danger: confirmation.danger || false,
      inputType: confirmation.inputType || 'text',
      error: confirmation.error || '',
      confirmHandler: async (value: string) => {
        const res = await confirmation.confirmHandler(value)
        if (typeof res === 'string' && res) {
          this.confirmationPrompt.update((prompt) => ({ ...prompt, error: res }))
        } else {
          this.hideConfirmation()
        }
      },
      cancelHandler: () => {
        this.hideConfirmation()
        if (confirmation.cancelHandler) {
          confirmation.cancelHandler()
        }
      }
    }

    this.confirmationPrompt.set(confirmationPrompt)
  }

  hideConfirmation() {
    this.confirmationPrompt.set(null)
  }

  showNotification(notification: Notification) {
    const iconTypes = {
      info: 'info',
      success: 'check',
      error: 'close'
    }

    const newNotification: Notification = {
      id: `${new Date().getTime()}-${Math.floor(Math.random() * 9999)}`,
      text: '',
      type: 'plain',
      showDismiss: false,
      actionText: '',
      icon: iconTypes[notification.type],
      removeAfter: 3000,
      ...notification
    }

    this.notifications.update((notifications) => [newNotification, ...notifications])
  }

  showInfo(text: string, onClick?: Notification['onClick'], actionText?: string) {
    this.showNotification({
      text,
      type: 'info',
      onClick,
      actionText,
      removeAfter: 3000
    })
  }

  showSuccess(text: string, onClick?: Notification['onClick'], actionText?: string) {
    this.showNotification({
      text,
      type: 'success',
      onClick,
      actionText,
      removeAfter: 2000
    })
  }

  showError(text: string, onClick?: Notification['onClick'], actionText?: string) {
    this.showNotification({
      text,
      type: 'error',
      onClick,
      actionText,
      removeAfter: 4000
    })
  }

  closeWithSuccess(text: string, onClick?: Notification['onClick'], actionText?: string) {
    this.close()
    this.showSuccess(text, onClick, actionText)
  }

  closeWithError(text: string, onClick?: Notification['onClick'], actionText?: string) {
    this.close()
    this.showError(text, onClick, actionText)
  }

  removeNotification(notificationId: string) {
    this.notifications.update((notifications) =>
      notifications.filter(({ id }) => id !== notificationId)
    )
  }

  clearNotifications() {
    this.notifications.set([])
  }

  showBreadcrumb(text: string, icon?: Action['icon'], ms?: number) {
    this.breadcrumb.set({ text, icon })

    if (ms) {
      setTimeout(() => {
        this.breadcrumb.set(null)
      }, ms)
    }
  }

  closeWithBreadcrumb(text: string, icon?: Action['icon'], ms?: number) {
    this.close()

    this.breadcrumb.set({ text, icon })

    if (ms) {
      setTimeout(() => {
        this.breadcrumb.set(null)
      }, ms)
    }
  }

  clearBreadcrumb() {
    this.breadcrumb.set(null)
  }

  close() {
    this.currentAction.set(null)
    this.selectedAction.set(null)
    this.isOpen.set(false)
    this.prefillInput.set('')
  }

  toggle() {
    if (get(this.isOpen)) {
      this.close()
    } else {
      this.open()
    }
  }

  /** Change the placeholder text */
  setPlaceholder(text: string) {
    this.placeholder.set(text)
  }

  /** Get all stored actions */
  getActions() {
    return get(this.actions)
  }

  /** Get action by its id */
  getActionByID(id: string): Action | undefined {
    const actions = get(this.actions)
    if (!actions) return
    return actions.find((action) => action.id === id)
  }

  /** Add a single action to the existing ones */
  addAction(action: Action) {
    this.log.debug('Adding single action:', action.name)
    this.addActions([action])
  }

  /** Adds multiple actions */
  addActions(actions: Action[]) {
    this.log.debug('Adding multiple actions:', actions.length)
    const parsedActions = this.flattenActions(actions)
    this.actions.update((actions) => [...actions, ...parsedActions])
  }

  /** Overwrite all stored actions */
  setActions(actions: Action[]) {
    this.log.debug('Setting actions:', actions.length)
    const parsedActions = this.flattenActions(actions)
    this.actions.set(parsedActions)
  }

  /** Use actions in addition to the default ones */
  useActions(actions: Action[]) {
    const parsedActions = this.flattenActions(actions)
    this.actions.set([...parsedActions, ...this.defaultActions])
  }

  /**
   * Show a specific action
   * @param action Action object or action id
   */
  showAction(action: Action | string) {
    if (typeof action === 'string') {
      action = get(this.actions).find((val) => val.id === action)
      if (!action) return // To Do: throw error
    }

    this.currentAction.set(action)

    // this.storedActions.set(get(this.actions))
    // this.actions.set([])

    this.isOpen.set(true)
  }

  /**
   * Show all stored actions
   */
  showParentAction() {
    const currentAction = get(this.currentAction)
    if (currentAction.parent) {
      const parent = get(this.actions).find((val) => val?.id === currentAction.parent)
      this.currentAction.set(parent)
    } else {
      this.currentAction.set(null)
    }
    this.inputValue.set('')
    // this.actions.set(get(this.storedActions))
  }

  /**
   * Show all stored actions
   */
  showRootActions() {
    this.currentAction.set(null)
    this.inputValue.set('')
    // this.actions.set(get(this.storedActions))
  }

  addToCurrentActionPanel(actionPanel: ActionPanelOption[]) {
    if (!get(this.currentAction)) return
    this.currentAction.update((action) => ({
      ...action,
      actionPanel: [
        ...(Array.isArray(action.actionPanel) ? action.actionPanel : []),
        ...actionPanel
      ]
    }))
  }

  /**
   *
   * @param action Action object or action id
   * @returns true if teletype closed itself afterwards
   */
  async executeAction(action: Action | string) {
    if (typeof action === 'string') {
      action = get(this.actions).find((val) => val.id === action)
      if (!action) {
        this.log.error('Action not found. Unable to execute action:', action)
        throw new Error('Action not found. Unable to execute action.')
      }
    }

    this.log.debug('Executing action:', action.name, action.id)

    if (action.handler) {
      if (action.requireInput) {
        if (get(this.currentAction)?.id !== action.id || !get(this.inputValue)) {
          this.showAction(action)
          this.selectedAction.set(action)
          return false
        }
      }

      const handlerReturn = await action.handler(action, this, get(this.inputValue))

      if (handlerReturn instanceof Object) {
        if (handlerReturn.preventClose) {
          this.currentAction.set(null)
          return false
        }

        this.close()

        if (handlerReturn.afterClose) {
          handlerReturn.afterClose(this)
        }
      } else {
        this.close()
      }

      return true
    } else if (action.inputHandler) {
      this.showAction(action)

      const debouncedInputHandler = useDebounce(async (value) => {
        const actions = await (action as Action).inputHandler(value, action as Action, this)

        if (actions !== undefined) {
          this.currentAction.update((action) => {
            if (!action) return
            action.actionsResult = actions

            return action
          })
        }
      }, 150)

      const unsubscribeInput = this.inputValue.subscribe(debouncedInputHandler)
      const unsubscribeAction = this.currentAction.subscribe((current) => {
        if (!current || current?.id !== (action as Action)?.id) {
          unsubscribeInput()
          unsubscribeAction()
        }
      })

      // Make sure the handler runs at least once as the inputValue might not change immediately
      debouncedInputHandler(get(this.inputValue))
    } else if ((action as LazyParentAction).loadChildActions) {
      const a = action as LazyParentAction
      this.setLoading(true)
      const actions = await a.loadChildActions(this, action)

      a.actionsResult = actions

      this.setLoading(false)

      this.showAction(a)
    } else {
      this.log.warn('No action handler', action)
      this.showAction(action)
      return false
    }
  }
}

/*
<TeletypeProvider actions={defaultActions} let:show={show}>
    {#if show}
        <Teletype />
    {/if}
</TeletypeProvider>
*/

export const provideTeletype = (options: Options, actions: Action[], key?: string) => {
  const teletype = new TeletypeCore(options, actions)
  setContext(key ? `teletype-${key}` : 'teletype', teletype)

  return teletype
}

export const useTeletype = (key?: string): TeletypeCore => {
  return getContext(key ? `teletype-${key}` : 'teletype')
}

export type TeletypeSystem = TeletypeCore
export { default as Teletype } from './Teletype.svelte'
export { default as TeletypeProvider } from './TeletypeProvider.svelte'
export { default as TeletypeCore } from './TeletypeCore.svelte'
export { default as TeletypeInstance } from './TeletypeInstance.svelte'

export type * from './types'
