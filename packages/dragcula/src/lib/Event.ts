import {
  DragItem,
  type DragData,
  type DragOperation,
  type DragZone,
  type DropEffect
} from "./index.js";
import type { DropPosition } from "./types.type.js";
import { assert } from "./utils/internal.js";

export type DragEventType =
  | "DragStart"
  | "Drag"
  | "DragEnter"
  | "DragTargetEnter"
  | "DragOver"
  | "DragLeave"
  | "DragTargetLeave"
  | "Drop"
  | "DragEnd";

interface IProps extends Omit<DragOperation, "isNative"> {
  bubbles?: boolean;
  event?: DragEvent;

  index?: number | null;
  dropPosition?: DropPosition | null;

  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export class DragculaDragEvent<
  DataTypes extends { [key: string]: any } = { [key: string]: any }
> extends Event {
  readonly id: string;

  readonly from: DragZone | null;
  readonly to: DragZone | null;

  readonly item: DragItem<DataTypes> | null; // DragItem, null it native drag from outside
  readonly dataTransfer: DataTransfer | null; // DataTransfer, if custom drag, still original event dataTransfer

  readonly index: number | null = null; // index used e.g. by AxisDragZone
  readonly dropPosition: DropPosition | null = null; // Fine-grained position relative to drop target

  readonly event?: DragEvent; // DragEvent passthrough from HTML... controllers.

  readonly stoppedPropagation = false;
  stopPropagation() {
    (this.stoppedPropagation as boolean) = true;
  }

  protected _dispatchPromise: Promise<void>;
  #status: "pending" | "accepted" | "rejected" = "pending";
  get isContinued(): boolean {
    return this.#status === "accepted";
  }
  get isAborted(): boolean {
    return this.#status === "rejected";
  }
  // @ts-ignore - this is ok as we assign it in the promise constructor
  continue: () => void;
  // @ts-ignore - this is ok as we assign it in the promise constructor
  abort: () => void;

  // === Mouse State passthrough
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;

  protected constructor(type: DragEventType, props: IProps) {
    super(type, { bubbles: props.bubbles ?? true });

    this.id = props.id;
    this.from = props.from;
    this.to = props.to;

    this.item = props.item ?? null;
    this.dataTransfer = props.dataTransfer ?? null;

    /*if (props.item instanceof DataTransfer) {
			this.#dataTransfer = props.item;
			this.item = null;
		} else if (props.item instanceof DragItem) {
			this.item = props.item;
		} else {
			throw new Error("Constructing DragculaDragEvent with invalid item type!");
		}*/

    this._dispatchPromise = new Promise((resolve, reject) => {
      this.continue = () => {
        this.#status = "accepted";
        resolve();
      };
      this.abort = () => {
        this.#status = "rejected";
        reject();
      };
    });

    this.event = props.event;
    this.index = props.index ?? null;
    this.dropPosition = props.dropPosition ?? null;

    // Mouse passthrough
    this.metaKey = props.metaKey ?? false;
    this.ctrlKey = props.ctrlKey ?? false;
    this.shiftKey = props.shiftKey ?? false;
    this.altKey = props.altKey ?? false;
  }

  static new(type: DragEventType, props: IProps): [DragculaDragEvent, Promise<void>] {
    const e = new this(type, props);

    // NOTE: These cannot be awaited as they have to be sync in order for e.preventDefault() to work
    if (["DragEnter"].includes(type)) e.continue();

    return [e, e._dispatchPromise];
  }

  static dispatch(
    type: DragEventType,
    target: EventTarget,
    props: IProps
  ): [DragculaDragEvent, Promise<void>] {
    const [e, p] = this.new(type, props);
    target.dispatchEvent(e);
    return [e, p];
  }

  get isNative(): boolean {
    return this.item === null && this.dataTransfer !== undefined;
  }

  get data(): DragData<DataTypes> | null {
    if (this.isNative) {
      return null;
    } else {
      assert(this.item !== null, "Custom drag event without item! This should not happen!");
      return this.item?.data;
    }
  }

  get effect(): DropEffect {
    if (this.isNative) {
      assert(
        this.dataTransfer !== undefined,
        "Native drag event without dataTransfer! This should not happen!"
      );
      return this.dataTransfer!.dropEffect as DropEffect;
    } else {
      assert(this.item !== null, "Custom drag event without item! This should not happen!");
      return this.item!.dropEffect;
    }
  }
}
