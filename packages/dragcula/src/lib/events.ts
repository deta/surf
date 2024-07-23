import type { DragItem, DragOperation, DragZone, IDragData } from "./index.js";

export class DragculaDragEvent
  extends Event
  implements
    Omit<
      MouseEvent,
      | "relatedTarget"
      | "layerX"
      | "layerY"
      | "getModifierState"
      | "initMouseEvent"
      | "view"
      | "which"
      | "initUIEvent"
      | "detail"
    >
{
  // A random unique id, used e.g. to match source & target view transition elements.
  readonly id: string;

  // Whether the drop event contains just the native DataTransfer or
  // it is custom dragcula stuff.
  readonly isNative: boolean;

  readonly dataTransfer: DataTransfer | IDragData;

  // Origin zone.
  // null -> if native drag onto a zone.
  readonly from: DragZone | null;

  // Target zone (Over -> on DragOver, Dropped -> on Drop).
  // null -> if over / drop over no valid zone.
  readonly to: DragZone | null;

  // null -> if native drag.
  readonly item: DragItem | null;

  readonly effect = "move"; //DragEffect; // fixed effect for now

  //readonly drag: DragOperation;

  /// Properties from DragEvent which are good to have:
  readonly altKey: boolean;
  readonly button: number;
  readonly buttons: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly movementX: number;
  readonly movementY: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly pageX: number;
  readonly pageY: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly shiftKey: boolean;
  readonly x: number;
  readonly y: number;

  constructor(
    type: "Drop" | "DragStart" | "DragEnter" | "DragOver" | "DragLeave" | "DragEnd",
    mouseEvent: MouseEvent,
    drag: DragOperation,
    data: DataTransfer | IDragData
  ) {
    super(type, { bubbles: true }); //, { detail: drag });
    this.id = drag.id;
    this.dataTransfer = data;
    this.isNative = data instanceof DataTransfer;
    this.from = drag.from;
    this.to = drag.to;
    this.item = drag.item;

    //this.drag = drag;

    this.altKey = mouseEvent.altKey;
    this.button = mouseEvent.button;
    this.buttons = mouseEvent.buttons;
    this.clientX = mouseEvent.clientX;
    this.clientY = mouseEvent.clientY;
    this.ctrlKey = mouseEvent.ctrlKey;
    this.metaKey = mouseEvent.metaKey;
    this.movementX = mouseEvent.movementX;
    this.movementY = mouseEvent.movementY;
    this.offsetX = mouseEvent.offsetX;
    this.offsetY = mouseEvent.offsetY;
    this.pageX = mouseEvent.pageX;
    this.pageY = mouseEvent.pageY;
    this.screenX = mouseEvent.screenX;
    this.screenY = mouseEvent.screenY;
    this.shiftKey = mouseEvent.shiftKey;
    this.x = mouseEvent.x;
    this.y = mouseEvent.y;
  }
}

export class IndexedDragculaDragEvent extends DragculaDragEvent {
  readonly index: number;

  constructor(
    type: "Drop" | "DragStart" | "DragEnter" | "DragOver" | "DragLeave" | "DragEnd",
    mouseEvent: MouseEvent,
    drag: DragOperation,
    data: DataTransfer | IDragData,
    index: number
  ) {
    super(type, mouseEvent, drag, data);
    this.index = index;
  }
}
