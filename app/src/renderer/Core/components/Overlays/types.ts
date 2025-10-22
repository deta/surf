import type { Snippet } from 'svelte'
import type { Rectangle } from 'electron'

export type OverlayProps = {
  /**
   * Disable portalling and render the component inline
   *
   * @defaultValue false
   */
  disabled?: boolean

  /**
   * The children content to render within the portal.
   */
  children?: Snippet

  /**
   * The initial bounds of the overlay.
   */
  bounds?: Rectangle

  /**
   * Whether the overlay should autofocus the first focusable element when opened.
   *
   * @defaultValue false
   */
  autofocus?: boolean
}

export type OverlayPopoverProps = {
  /**
   * Whether the popover is open.
   */
  open?: boolean

  /**
   * The position of the popover relative to the trigger.
   */
  position?: 'top' | 'bottom' | 'left' | 'right'

  /**
   * The children content to render within the portal.
   */
  children?: Snippet

  /**
   * The trigger content to render within the portal.
   */
  trigger?: Snippet

  width?: number
  height?: number

  /**
   * Whether the popover should autofocus the first focusable element when opened.
   *
   * @defaultValue false
   */
  autofocus?: boolean
}
