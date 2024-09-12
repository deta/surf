import type { DragItem, DragZone } from "./index.js";
import { genId, ii_DRAGCULA, log, SUPPORTS_VIEW_TRANSITIONS } from "./utils/internal.js";

/**
 * Global Dragcula Singleton.
 * Holding state & can be used to start a simulated drag etc.
 */
export class Dragcula {
  static readonly #instance = new Dragcula();
  static get() {
    return Dragcula.#instance;
  }
  getClass() {
    return Dragcula;
  }
  readonly transparentImg: HTMLImageElement;

  protected static _useViewTransitions = false;
  static get useViewTransitions() {
    if (!SUPPORTS_VIEW_TRANSITIONS) return false;
    return this._useViewTransitions;
  }
  static set useViewTransitions(v: boolean) {
    this._useViewTransitions = v;
  }

  protected constructor() {
    const img = document.createElement("img");
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    this.transparentImg = img;

    // Reset after native drop
    document.addEventListener("drop", (e) => {
      // NOTE: This will cleanup after a native drop, as it wont have dragend called on any element.
      // TODO: Is this correct?
      if (!Dragcula.get().activeDrag?.isNative) return;
      setTimeout(() => this.cleanupDragOperation());
    });
    /*document.addEventListener("dragenter", (e) => {
					if (this.activeDrag !== null) return
					this.prepareDragOperation()
				});
				document.addEventListener("dragleave", (e) => {
		
					this.cleanupDragOperation()
				});*/

    /*window.addEventListener("dragenter", e => {
			if (e.fromElement !== document.documentElement) return;
			console.log("DRAGENTER")
		});
		window.addEventListener("dragleave", e => {
			if (e.toElement !== document.documentElement) return;
			console.log("DRAGLEAVE")
		});*/

    // @ts-ignore
    window.Dragcula = this;
  }

  activeDrag: DragOperation | null = null;

  /// Callback to update global stuff like body attributes
  public prepareDragOperation() {
    document.body.setAttribute("data-dragging", "true");
  }

  /// Callback to cleanup global stuff like body attributes
  public cleanupDragOperation() {
    log.debug(`${ii_DRAGCULA}\x1B[40;97m === Cleanup Drag`);
    document.body.removeAttribute("data-dragging");

    this.activeDrag = null;
  }
}

export class DragOperation {
  readonly id: string;

  from: DragZone | null;
  to: DragZone | null;
  item: DragItem | null; // DragItem, null it native drag from outside
  dataTransfer: DataTransfer | null; // DataTransfer, if custom drag, still original event dataTransfer

  index: number | null; // Generic index used by e.g. AxisDragZone

  get isNative(): boolean {
    return this.item === null && this.dataTransfer !== null;
  }

  protected constructor(props: {
    id?: string;
    from?: DragZone;
    to?: DragZone;
    item?: DragItem;
    dataTransfer?: DataTransfer;
    index?: number;
  }) {
    this.id = props.id ?? genId();
    this.from = props.from || null;
    this.to = props.to || null;
    this.item = props.item ?? null;
    this.dataTransfer = props.dataTransfer ?? null;
    this.index = props.index ?? null;
  }

  static new(props: {
    id?: string;
    from?: DragZone;
    to?: DragZone;
    item?: DragItem;
    dataTransfer?: DataTransfer;
  }): DragOperation {
    return new this(props);
  }
}

export class DragData<
  T extends { [key: string]: unknown | (() => Promise<unknown>) } = { [key: string]: string }
> {
  #data = new Map<string, () => Promise<unknown> | unknown>();

  constructor(from?: Record<keyof T, unknown>) {
    if (from) {
      for (const [key, value] of Object.entries(from)) {
        this.setData(key, value as any);
      }
    }
  }

  public clearData(key?: keyof T | (string & {})) {
    if (!key) {
      this.#data.clear();
    } else this.#data.delete(key as string);
  }

  public setData<K extends keyof T | (string & {})>(
    key: K,
    value: K extends keyof T ? T[K] : unknown
  ) {
    // @ts-ignore this still works for the returing type and is fine!
    this.#data.set(key as string, value);
  }

  public getData<K extends keyof T | (string & {})>(key: K): K extends keyof T ? T[K] : unknown {
    const value = this.#data.get(key as string);
    return (typeof value === "function" ? value() : value) as K extends keyof T ? T[K] : unknown;
  }

  public hasData(key: keyof T | (string & {})): boolean {
    return this.#data.has(key as string);
  }
}
