import { DragItem } from "./DragItem.js";
import type { DragZone } from "./index.js";
import { KEY_STATE, MOUSE_POS } from "./internal.js";
import type { DragData, DragEffect, DragOperation } from "./types.js";

export type DragEventType =
  | "DragStart"
  | "Drag"
  | "DragEnter"
  | "DragOver"
  | "DragLeave"
  | "Drop"
  | "DragEnd";

export class DragculaDragEvent extends Event {
  readonly id: string;
  readonly status: "active" | "finalizing" | "aborted" | "done";

  from: DragZone | null;
  to: DragZone | null;

  /// DragItem if custom drag, null if native drag!
  item: DragItem | null;

  get isNative(): boolean {
    return this.item === null;
  }

  #dataTransfer?: DataTransfer; // native drag dataTransfer
  get data(): DragData | DataTransfer {
    if (this.isNative) {
      console.assert(
        this.#dataTransfer !== undefined,
        "Native drag event without dataTransfer! This should not happen!"
      );
      return this.#dataTransfer!;
    } else {
      console.assert(this.item !== null, "Custom drag event without item! This should not happen!");
      return this.item!.data;
    }
  }

  get effect(): DragEffect {
    if (this.isNative) {
      console.assert(
        this.#dataTransfer !== undefined,
        "Native drag event without dataTransfer! This should not happen!"
      );
      return this.#dataTransfer!.dropEffect as DragEffect;
    } else {
      console.assert(this.item !== null, "Custom drag event without item! This should not happen!");
      return this.item!.dragEffect;
    }
  }

  index?: number;

  /// Pass through key states so client can react
  readonly ctrlKey: boolean = false;
  readonly shiftKey: boolean = false;
  readonly altKey: boolean = false;
  readonly metaKey: boolean = false;

  /// Passthrough of mousevent props
  readonly clientX: number = MOUSE_POS.x;
  readonly clientY: number = MOUSE_POS.y;

  protected promise: Promise<void>;
  continue = () => {};
  abort = () => {};

  protected constructor(
    type: DragEventType,
    props: DragOperation & {
      bubbles?: boolean;
    }
  ) {
    super(type, { bubbles: props.bubbles ?? false, cancelable: false });

    this.id = props.id;
    this.status = props.status;
    this.from = props.from;
    this.to = props.to;
    this.index = props.index;
    if (props.item instanceof DataTransfer) {
      this.#dataTransfer = props.item;
      this.item = null;
    } else if (props.item instanceof DragItem) {
      this.item = props.item;
    } else {
      throw new Error("Constructing DragculaDragEvent with invalid item type!");
    }

    this.ctrlKey = KEY_STATE.ctrl;
    this.shiftKey = KEY_STATE.shift;
    this.altKey = KEY_STATE.alt;
    this.metaKey = KEY_STATE.meta;

    this.promise = new Promise((res, rej) => {
      this.continue = res;
      this.abort = rej;
    });
  }

  static new(type: DragEventType, props: any): [DragculaDragEvent, Promise<void>] {
    const e = new this(type, props);
    return [e, e.promise];
  }

  static dispatch(
    type: DragEventType,
    props: DragOperation & { bubbles?: boolean },
    target: EventTarget
  ): Promise<void> {
    const [e, p] = this.new(type, props);
    target.dispatchEvent(e);
    return p;
  }
}
