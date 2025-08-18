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
}
