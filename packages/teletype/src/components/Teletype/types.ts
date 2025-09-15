import type { SvelteComponent } from 'svelte'
import type { TeletypeSystem } from '.'
import type { TeletypeAction } from '@deta/services/teletype'

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

export type ActionView =
  | 'Command'
  | 'Modal'
  | 'ModalLarge'
  | 'ModalSmall'
  | 'Inline'
  | 'InlineReplace'

export type ActionShortcutType = 'primary' | 'secondary' | 'tertiary'

export type ActionPanelOptionBase = {
  /** The unqiue identifier for the action */
  id: string

  /** The name of the action, will be shown in the command list */
  name: string

  /** How the action can be activated */
  shortcutType?: ActionShortcutType

  /** Icon for the action */
  icon?: typeof SvelteComponent | string
}

export type ActionPanelOptionHandler = ActionPanelOptionBase & {
  type: 'handler'
  /** Handler which gets executed when the action is selected */
  handler: OptionHandler
}

export type ActionPanelOptionAction = ActionPanelOptionBase & {
  type: 'action'
  /** Action to show when the option is selected */
  action: Action
}

export type ActionPanelOption = ActionPanelOptionHandler | ActionPanelOptionAction

export enum TagStatus {
  DEFAULT = 'default',
  SUCCESS = 'success',
  WARNING = 'warning',
  FAILED = 'failed',
  ACTIVE = 'active'
}

export enum ActionSelectPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  HIGHEST = 3
}

export enum ActionDisplayPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  HIGHEST = 3
}

export type ActionBase = {
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

  /** How the action can be activated */
  shortcutType?: ActionShortcutType

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

  /** Sets the priority, if the element should be the default selected action */
  selectPriority?: ActionSelectPriority

  /** Sets the order in which actions are sorted */
  displayPriority?: ActionDisplayPriority

  /** Footer text */
  footerText?: string
  /** Title text */
  titleText?: string

  /** Hide the action from the action list */
  hidden?: boolean
  /** Hidden action will appear when the search matches this key */
  activationKey?: string

  /** Text that will be shown when the action is selected */
  actionIcon?: string
  actionText?: string
  actionPanel?: ActionPanelOption[] | (() => Promise<ActionPanelOption[]>)

  /** Text to display in the send button (overrides action name) */
  buttonText?: string

  payload?: any

  /** Hide the action descripton unless the action is selected */
  hideDescriptionUntilSelected?: boolean

  /** Items to be displayed in a horizontal list within this action */
  horizontalItems?: Action[]
  horizontalParentAction?: TeletypeAction

  /* Hide the elements on initial state*/
  hiddenOnRoot?: boolean

  /** Internal  */
  _index?: number // To Do: Don't expose this
}

export type HandlerAction = ActionBase & {
  type: 'handler'
  /**
   * Handler which gets executed when the action is selected
   *
   * Prevent closing teletype by returning false
   */
  handler: Handler
  requireInput?: boolean
}

export type ReactiveAction = ActionBase & {
  type: 'reactive'
  /**
   * Handler which gets executed when the action is selected
   *
   * Prevent closing teletype by returning false
   */
  inputHandler: InputHandler
  actionsResult: Action[]
}

export type InputAction = ActionBase & {
  type: 'input'
  requireInput: boolean
}

export type ComponentAction = ActionBase & {
  type: 'component'
  /** Show a component when the action is selected */
  component: typeof SvelteComponent
  /** Props to pass to the component */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentProps?: { [key: string]: any }
  showActionPanel?: boolean
}

export type LazyComponentAction = ActionBase & {
  type: 'lazyComponent'
  /** Show a component when the action is selected */
  lazyComponent: () => Promise<typeof SvelteComponent>
  /** Props to pass to the component */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentProps?: { [key: string]: any }
  showActionPanel?: boolean
}

export type ParentAction = ActionBase & {
  type: 'parent'
  /** Nested actions to show once the action is selected */
  childActions: Action[]
}

export type LazyParentAction = ActionBase & {
  type: 'lazyParent'
  /** Function that returns a list of child actions */
  loadChildActions: (
    teletype: TeletypeSystem,
    action: LazyParentAction
  ) => Action[] | Promise<Action[]>
  actionsResult: Action[]
}

export type Action =
  | ParentAction
  | LazyParentAction
  | HandlerAction
  | ReactiveAction
  | ComponentAction
  | LazyComponentAction
  | InputAction

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
}

export type HorizontalAction = {
  type: 'horizontal'
  /** The unique identifier for the action */
  id: string

  /** The name of the action, will be shown in command list */
  name: string

  /** Icon for the action */
  icon?: string | typeof SvelteComponent

  /** Section to group the action in */
  section?: string

  /** Description of the action */
  description?: string

  /** Keywords associated with the action */
  keywords?: string[]

  /** The parent action ID */
  parent?: string

  /** Items to be displayed in horizontal list */
  horizontalItems: Action[]
  horizontalParentAction?: TeletypeAction

  payload?: any

  /** Internal */
  _index?: number

  view?: ActionView
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
