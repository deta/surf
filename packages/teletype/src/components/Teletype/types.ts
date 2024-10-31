import type { SvelteComponent } from 'svelte'
import type { TeletypeSystem } from '.'

export type HandlerReturn = {
  preventClose?: boolean
  afterClose?: (teletype: TeletypeSystem) => void
}

export type Handler = (
  action: Action,
  teletype: TeletypeSystem,
  inputValue?: string
) => HandlerReturn | void | Promise<HandlerReturn | void>

export type OptionHandler = (
  option: ActionPanelOption,
  teletype: TeletypeSystem
) => HandlerReturn | void | Promise<HandlerReturn | void>

export type InputHandler = (
  inputValue: string,
  action: Action,
  teletype: TeletypeSystem
) => Action[] | Promise<Action[]>

export type ActionView = 'Command' | 'Modal' | 'ModalLarge' | 'ModalSmall'

export type ActionPanelOptionBase = {
  /** The unqiue identifier for the action */
  id: string

  /** The name of the action, will be shown in the command list */
  name: string

  /** Icon for the action */
  icon?: typeof SvelteComponent | string
}

export type ActionPanelOption = ActionPanelOptionBase & {
  /**
   * Handler which gets executed when the action is selected
   */
  handler: OptionHandler
  action: never
} & {
  /** Show action when option is called */
  action: Action
  handler: never
}

export enum TagStatus {
  DEFAULT = 'default',
  SUCCESS = 'success',
  WARNING = 'warning',
  FAILED = 'failed',
  ACTIVE = 'active'
}

type ActionBase = {
  /** The unqiue identifier for the action */
  id: string

  /** The name of the action, will be shown in the command list */
  name: string

  /** The ID of the parent action */
  parent?: string

  /** Icon for the action */
  icon?: typeof SvelteComponent | string

  /** Section to group the action in */
  section?: string

  /** Keywords associated with the action */
  keywords?: string[]

  /** Placeholder to show when waiting for user input after the action is selected */
  placeholder?: string

  /** Placeholder to show when loading */
  loadingPlaceholder?: string

  /** Breadcrumb text */
  breadcrumb?: string

  /** Breadcrumb text shown next to the action during searching */
  searchBreadcrumb?: string

  /** Keyboard shortcut to select action */
  shortcut?: string

  /** Action description */
  description?: string

  /** Tag that will be shown when the action is in a list */
  tag?: string
  tagStatus?: TagStatus

  /** Include in nested search */
  nestedSearch?: boolean

  /** How to present the action */
  view?: ActionView
  /** Prevent the action from closing when clicking outside or pressing backspace */
  forceSelection?: boolean

  /** Footer text */
  footerText?: string
  /** Title text */
  titleText?: string

  /** Hide the action from the action list */
  hidden?: boolean
  /** Hidden action will appear when the search matches this key */
  activationKey?: string

  /** Text that will be shown when the action is selected */
  actionText?: string
  actionPanel?: ActionPanelOption[] | (() => Promise<ActionPanelOption[]>)

  /** Hide the action descripton unless the action is selected */
  hideDescriptionUntilSelected?: boolean

  /** Internal  */
  _index?: number // To Do: Don't expose this
}

export type HandlerAction = ActionBase & {
  /**
   * Handler which gets executed when the action is selected
   *
   * Prevent closing teletype by returning false
   */
  handler: Handler
  requireInput?: boolean

  inputHandler?: never
  childActions?: never
  lazyComponent?: never
  component?: never
  componentProps?: never
  loadChildActions?: never
  actionsResult?: never
  showActionPanel?: never
}

export type ReactiveAction = ActionBase & {
  /**
   * Handler which gets executed when the action is selected
   *
   * Prevent closing teletype by returning false
   */
  inputHandler: InputHandler
  actionsResult: Action[]

  lazyComponent?: never
  component?: never
  componentProps?: never
  loadChildActions?: never
  showActionPanel?: never
  requireInput?: never
}

export type InputAction = ActionBase & {
  requireInput: boolean

  lazyComponent?: never
  component?: never
  componentProps?: never
  loadChildActions?: never
  showActionPanel?: never
  inputHandler?: never
  actionsResult?: never
}

export type ComponentAction = ActionBase & {
  /** Show a component when the action is selected */
  component: typeof SvelteComponent
  /** Props to pass to the component */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentProps?: { [key: string]: any }
  showActionPanel?: boolean

  lazyComponent?: never
  inputHandler?: never
  handler?: never
  childActions?: never
  loadChildActions?: never
  actionsResult?: never
  requireInput?: never
}

export type LazyComponentAction = ActionBase & {
  /** Show a component when the action is selected */
  lazyComponent: () => Promise<typeof SvelteComponent>
  /** Props to pass to the component */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentProps?: { [key: string]: any }
  showActionPanel?: boolean

  component?: never
  inputHandler?: never
  handler?: never
  childActions?: never
  loadChildActions?: never
  actionsResult?: never
  requireInput?: never
}

export type ParentAction = ActionBase & {
  /** Nested actions to show once the action is selected */
  childActions: Action[]

  inputHandler?: never
  handler?: never
  lazyComponent?: never
  component?: never
  componentProps?: never
  loadChildActions?: never
  actionsResult?: never
  showActionPanel?: never
  requireInput?: never
}

export type LazyParentAction = ActionBase & {
  /** Function that returns a list of child actions */
  loadChildActions: (
    teletype: TeletypeSystem,
    action: LazyParentAction
  ) => Action[] | Promise<Action[]>
  actionsResult: Action[]

  inputHandler?: never
  handler?: never
  lazyComponent?: never
  component?: never
  componentProps?: never
  showActionPanel?: never
  requireInput?: never
}

export type Action =
  | ParentAction
  | LazyParentAction
  | HandlerAction
  | ReactiveAction
  | ComponentAction
  | LazyComponentAction

export type Options = {
  /**
   * Show Teletype at all
   * @default true
   * */
  show?: boolean
  /**
   * Start Teletype in the open state
   * @default false
   * */
  open?: boolean
  /**
   * Capture all document keypresses and use them as input
   * @default true
   * */
  captureKeys?: boolean
  /**
   * Search child actions
   * @default true
   * */
  nestedSearch?: boolean
  /**
   * Placeholder text for the input
   * */
  placeholder?: string

  /**
   * Component to use for icons
   *
   * Icon name defined in action will be passed to it as `name` prop
   */
  iconComponent?: typeof SvelteComponent

  /**
   * filter actions if enabled
   * @default true
   */
  localSearch?: boolean

  /**
   * Show helper icon in the teletype input
   * */
  showHelper?: boolean

  /**
   * Show loading animation
   * */
  loading?: boolean

  /**
   * Show animations and transitions
   * */
  animations?: boolean

  /**
   * Automatically focus the input when Teletype is opened
   * */
  autoFocus?: boolean
}

export type NotificationType = 'plain' | 'info' | 'success' | 'error'

export type Notification = {
  id?: string
  text: string
  icon?: Action['icon']
  type?: NotificationType
  showDismiss?: boolean
  actionText?: string
  removeAfter?: number
  onClick?: (notification: Notification, teletype: TeletypeSystem) => void
}

export type Confirmation = {
  title?: string
  message?: string
  showInput?: boolean
  placeholder?: string
  inputRequired?: boolean
  value?: string
  error?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  inputType?: string
  confirmHandler: (value?: string) => void | Promise<void | string>
  cancelHandler?: () => void
}
