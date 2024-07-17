import type { DragItem, DragZone, DragculaDragEvent } from "./index.js";

/**
 * ghost: Shows a picture of the element like the native drag and drop.
 * clone: Clones the element to the root of the document.
 * hoist: "Moves" the element to the root of the document by css magic.
 *
 * hoist vs. clone: Hoist is "faster" / doesnt need to re-mount the element,
 * so it might be better for (perceived) performance or when the element
 * needs to retain more complex state & logic during the drag.
 */
export type PreviewMode = "clone" | "hoist";
export type DragEffect = "copy" | "move" | "link" | "none";

/**
 * Object passed to the drag event listeners through the DragOperation.
 * It is similar to the DataTransfer object, but we use a simple object
 * as it is a bit more flexible / easy for most use-cases as it can contain
 * object references for easy internal page transfers.
 */
export interface IDragData {
  [key: string]: any;
}

export interface DragOperation {
  // A random id, used e.g. to match source & target view transition
  // elements.
  readonly id: string;

  // Origin zone.
  // null -> if native drag onto a zone.
  from: DragZone | null;

  // Target zone (Over -> on DragOver, Dropped -> on Drop).
  // null -> if over / drop over no valid zone.
  to: DragZone | null;

  // null -> if native drag.
  item: DragItem | null;

  data: IDragData;
  effect: "move"; //DragEffect; // fixed for now
}

export interface IndexedDragOperation extends DragOperation {
  // The index at which the element should be placed
  index: number;
}

export interface DragItemActionProps {
  id: string;
  data: IDragData;
  simulateDragStart?: boolean;
  controller?: DragItem;
}
export interface DragItemActionAttributes {
  // Whether the item can be dragged.
  //dragging: "true" | "false";

  dragpreview?: "clone" | "hoist";
  simulatedragstart?: "true" | "false"; // Use so we can have a min-move before start

  "on:Drag"?: (e: DragculaDragEvent) => void;
  "on:DragStart"?: (e: DragculaDragEvent) => void;
  "on:DragEnter"?: (e: DragculaDragEvent) => void;
  "on:DragLeave"?: (e: DragculaDragEvent) => void;
  "on:DragEnd"?: (e: DragculaDragEvent) => void;
}

export interface DragZoneActionProps {
  id: string;
  controller?: DragZone;

  // Callback used to remove an item from the item collection.
  // This is needed to support the "move" effect.
  removeItem: (item: DragItem) => void;
  //copyItem: (item: DragItem, index: number) => void;
}
export interface DragZoneActionAttributes {
  droppable?: "true" | "false";

  // TODO: Events
  "on:DragEnter": (e: DragculaDragEvent) => void;
  "on:DragOver": (e: DragculaDragEvent) => void;
  "on:DragLeave": (e: DragculaDragEvent) => void;
  "on:Drop": (e: DragculaDragEvent) => void;
}
