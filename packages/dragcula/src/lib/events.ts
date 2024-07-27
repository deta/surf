/*import { type DragItem, type DragZone, type DragEffect, type IDragData, type DragOperation, ACTIVE_DRAG } from "./index.js";

abstract class DragculaBaseDragEvent extends Event implements Omit<MouseEvent, 'relatedTarget' | 'layerX' | 'layerY' | 'getModifierState' | 'initMouseEvent' | 'view' | 'which' | 'initUIEvent' | 'detail'> {
	// A random unique id, used e.g. to match source & target view transition elements.
	readonly id: string;

	abstract readonly isNative: boolean;
	abstract readonly dataTransfer: DataTransfer | IDragData;

	// Origin zone.
	// null -> if native drag onto a zone.
	readonly from: DragZone | null;

	// Target zone .
	// null -> if over / drop over no valid zone.
	readonly to: DragZone | null;

	// null -> if native drag.
	readonly item: DragItem | null;

	readonly effect: DragEffect;

	abstract setDataTransfer(data: IDragData): void;

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

	constructor(type: "Drop" | "DragStart" | "DragEnter" | "DragOver" | "DragLeave" | "DragEnd", mouseEvent: MouseEvent, drag: DragOperation) {
		super(type, { bubbles: true, cancelable: true });
		this.id = drag.id;
		this.from = drag.from;
		this.to = drag.to;
		this.item = drag.item;
		this.effect = drag.effect;

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

export class DragculaNativeDragEvent extends DragculaBaseDragEvent {
	readonly isNative = true;
	readonly dataTransfer: DataTransfer;

	constructor(type: "Drop" | "DragStart" | "DragEnter" | "DragOver" | "DragLeave" | "DragEnd", mouseEvent: MouseEvent, drag: DragOperation) {
		super(type, mouseEvent, drag);
		this.dataTransfer = drag.data as DataTransfer;
	}
}
export class DragculaCustomDragEvent extends DragculaBaseDragEvent {
	readonly isNative = false;
	readonly dataTransfer: IDragData;

	constructor(type: "Drop" | "DragStart" | "DragEnter" | "DragOver" | "DragLeave" | "DragEnd", mouseEvent: MouseEvent, drag: DragOperation) {
		super(type, mouseEvent, drag);
		this.dataTransfer = drag.data as IDragData;
	}

	override setDataTransfer(data: IDragData) {
		(this.dataTransfer as IDragData) = data;
		ACTIVE_DRAG.update(v => {
			v!.data = data;
			return v;
		})
	}
}

export type DragculaDragEvent = DragculaNativeDragEvent | DragculaCustomDragEvent;

export class IndexedDragculaNativeDragEvent extends DragculaNativeDragEvent {
	index: number;

	constructor(type: "Drop" | "DragStart" | "DragEnter" | "DragOver" | "DragLeave" | "DragEnd", mouseEvent: MouseEvent, drag: DragOperation, index: number) {
		super(type, mouseEvent, drag);
		this.index = index;
	}
}

export class IndexedDragculaCustomDragEvent extends DragculaCustomDragEvent {
	index: number;

	constructor(type: "Drop" | "DragStart" | "DragEnter" | "DragOver" | "DragLeave" | "DragEnd", mouseEvent: MouseEvent, drag: DragOperation, index: number) {
		super(type, mouseEvent, drag);
		this.index = index;
	}
}

export type IndexedDragculaDragEvent = IndexedDragculaNativeDragEvent | IndexedDragculaCustomDragEvent;
*/

import { DragItem, DragZone, type DragData, type DragEffect } from "./index.js";

type DragculaDragEventType =
  | "DragStart"
  | "Drag"
  | "DragEnter"
  | "DragOver"
  | "DragLeave"
  | "Drop"
  | "DragEnd";

export class DragculaDragEvent extends Event {
  readonly id: string;
  readonly status: "active" | "aborted" | "completed";

  from: DragZone | null;
  to: DragZone | null;

  // TODO: Test if this if reference or copy
  item: DragItem | null;

  index?: number;

  get isNative() {
    return this.item === null;
  }

  #dataTransfer?: DataTransfer; // Store for nativ drag data transfer
  get data(): DragData | DataTransfer {
    if (this.isNative) {
      console.assert(
        this.#dataTransfer !== undefined,
        "Native drag event without dataTransfer! This should not happen!"
      );
      return this.#dataTransfer || new DataTransfer();
    } else {
      return this.item!.data;
    }
  }

  get effect(): DragEffect {
    if (this.isNative) {
      return (this.#dataTransfer?.dropEffect as DragEffect) || "none";
    } else {
      return this.item!.dragEffect;
    }
  }

  constructor(
    type: DragculaDragEventType,
    props: {
      id: string;
      status: "active" | "aborted" | "completed";
      item: DragItem | DataTransfer;
      from?: DragZone;
      to?: DragZone;
      index?: number;
    }
  ) {
    super(type, { bubbles: true, cancelable: true });
    this.id = props.id;
    this.status = props.status;
    this.from = props.from || null;
    this.to = props.to || null;
    this.index = props.index;
    if (props.item instanceof DataTransfer) {
      this.item = null;
      this.#dataTransfer = props.item;
    } else if (props.item instanceof DragItem) {
      this.item = props.item;
    } else {
      throw new Error("Constructing DragculaDragEvent with invalid item type.", props.item);
    }
  }
}
