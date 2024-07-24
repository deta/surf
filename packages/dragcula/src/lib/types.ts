import type { DragItem, DragZone } from "./index.js";

export interface ViewTransition {
  finished: Promise<void>;
  updateCallbackDone: Promise<void>;
  ready: Promise<void>;
}

/**
 * ghost: Shows a picture of the element like the native drag and drop.
 * clone: Clones the element to the root of the document.
 * hoist: "Moves" the element to the root of the document by css magic.
 *
 * hoist vs. clone: Hoist is "faster" / doesnt need to re-mount the element,
 * so it might be better for (perceived) performance or when the element
 * needs to retain more complex state & logic during the drag.
 */
export type ItemPreviewMode = "clone" | "hoist";
export type DragEffect = "move" | "copy" | "link" | "none";

/**
 * Object passed to the drag event listeners through the DragOperation.
 * It is similar to the DataTransfer object, but we use a simple object
 * as it is a bit more flexible / easy for most use-cases as it can contain
 * object references for easy internal page transfers.
 */
export interface IDragData {
  [key: string]: unknown;

  getDataTransfer: () => DataTransfer;
}
export type RawDragData = Omit<IDragData, "getDataTransfer">;

export interface DragOperation {
  // A random id, used e.g. to match source & target view transition elements.
  readonly id: string;

  // Origin zone.
  // null -> if native drag onto a zone.
  from: DragZone | null;

  // Target zone.
  // null -> if not over / drop over no valid zone.
  to: DragZone | null;

  // null -> if native drag.
  item: null | DragItem;

  data: DataTransfer | IDragData;

  effect: DragEffect;
}

export interface IndexedDragOperation extends DragOperation {
  /// The index at which the item should be inserted.
  index: number;
}
