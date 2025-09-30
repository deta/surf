import { get, writable } from "svelte/store";
import { HTMLDragArea, HTMLDragZone, type DragItem, type DragZone } from "./index.js";
import type { DropPosition } from "./types.type.js";
import {
  genId,
  getParentArea,
  getParentZone,
  ii_DRAGCULA,
  log,
  SUPPORTS_VIEW_TRANSITIONS
} from "./utils/internal.js";

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

  // Workarounds for native drag shittyness
  targetDomElement = writable<HTMLElement | null>(null);

  // Listener bindings
  private _listenerBindings: Map<EventTarget, [string, (<E extends Event>(e: E) => void)[]][]>;

  protected constructor() {
    const img = document.createElement("img");
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    this.transparentImg = img;

    this._listenerBindings = new Map();

    // This should probably live somewhere else lol
    function handleDragUpdate(e: DragEvent) {
      const els = document
        .elementsFromPoint(e.clientX, e.clientY)
        .filter((e) => e.getAttribute("data-dragcula-ignore") === null);
      const el = els.at(0);

      if (e.isTrusted && Dragcula.get().activeDrag === null) {
        Dragcula.get().activeDrag = DragOperation.new({
          dataTransfer: e.dataTransfer ?? new DataTransfer()
        });
        Dragcula.get().prepareDragOperation();
        Dragcula.get().callHandlers("dragstart", Dragcula.get().activeDrag);
      }

      const activeDrag = Dragcula.get().activeDrag;
      if (activeDrag === null) {
        console.warn("handling drag event without activeDrag! This should not happen!");
        return;
      }
      if (get(Dragcula.get().targetDomElement) === el) return;
      Dragcula.get().targetDomElement.set(el as HTMLElement);

      const overArea = getParentArea(el as HTMLElement);
      const newAreaId = overArea?.id ?? null;
      const oldAreaId = activeDrag.area?.id ?? null;
      if (newAreaId !== oldAreaId) {
        if (oldAreaId !== null) {
          const evt = new DragEvent("dragleave", {
            dataTransfer: activeDrag.dataTransfer,
            relatedTarget: el,
            bubbles: true,
            cancelable: true
          });
          activeDrag.area?._handleDragLeave(evt);
        }
        if (newAreaId !== null) {
          const evt = new DragEvent("dragenter", {
            dataTransfer: activeDrag.dataTransfer,
            relatedTarget: activeDrag.area?.element ?? undefined,
            bubbles: true,
            cancelable: true
          });
          overArea?._handleDragEnter(evt);
        }
      }

      const overZone = getParentZone(el as HTMLElement);
      const newTargetId = overZone?.id ?? null;
      const oldTargetId = activeDrag.to?.id ?? null;

      if (newTargetId !== oldTargetId) {
        if (oldTargetId !== null) {
          const evt = new DragEvent("dragleave", {
            dataTransfer: activeDrag.dataTransfer,
            relatedTarget: el,
            bubbles: true,
            cancelable: true
          });
          activeDrag.to?._handleDragLeave(evt);
        }
        if (newTargetId !== null) {
          const evt = new DragEvent("dragenter", {
            dataTransfer: activeDrag.dataTransfer,
            relatedTarget: activeDrag.to?.element ?? undefined,
            bubbles: true,
            cancelable: true
          });
          overZone?._handleDragEnter(evt);
        }
      }
    }
    // Reset after native drop
    // FIX: UNBIND
    this.addEventListener(document, "drop", (e) => {
      // NOTE: This will cleanup after a native drop, as it wont have dragend called on any element.
      // TODO: Is this correct?
      if (!Dragcula.get().activeDrag?.isNative) return;
      setTimeout(() => this.cleanupDragOperation());
    });

    /* this.addEventListener(document, "dragend", (e) => {    // FIX: UNBIND
      // TODO: (maxu): investigate again.
      setTimeout(() => this.cleanupDragOperation());
    });*/

    // FIX: UNBIND
    this.addEventListener(document, "drag", handleDragUpdate);
    this.addEventListener(document, "dragover", handleDragUpdate);

    // @ts-ignore
    window.Dragcula = this;
  }

  public destroy() {
    if (!this._listenerBindings) return;
    for (const [bindingEl, listeners] of this._listenerBindings) {
      if (!bindingEl) continue;
      for (const [event, cbs] of listeners) {
        for (const cb of cbs) {
          bindingEl.removeEventListener(event, cb);
        }
      }
    }
  }

  public addEventListener(el: EventTarget, event: string, cb: (e: Event) => void) {
    if (!this._listenerBindings.has(el)) {
      this._listenerBindings.set(el, []);
    }
    const listeners = this._listenerBindings.get(el)!;
    let listener = listeners.find(([e]) => e === event);
    if (!listener) {
      listener = [event, []];
      listeners.push(listener);
    }
    listener[1].push(cb);
    el.addEventListener(event, cb);
  }

  activeDrag: DragOperation | null = null;
  isDragging = writable(false);

  /// Callback to update global stuff like body attributes
  public prepareDragOperation() {
    document.body.setAttribute("data-dragging", "true");
    this.isDragging.set(true);
  }

  /// Callback to cleanup global stuff like body attributes
  public cleanupDragOperation() {
    log.debug(`${ii_DRAGCULA}\x1B[40;97m === Cleanup Drag`);
    document.body.removeAttribute("data-dragging");
    document.body.removeAttribute("data-drag-target");
    this.isDragging.set(false);

    /* HTMLDragZone.ZONES.forEach((zone) => {
      zone._handleDragLeave();
    });
    */

    HTMLDragArea.AREAS.forEach((area) => {
      area._handleDragEnd();
    });

    // Make sure no previews are dnagling
    // FIX: Ideally this shouldnt happen in the first case.. but better save than sorry
    document.querySelectorAll("[data-drag-preview]").forEach((el) => el.remove());
    document
      .querySelectorAll("[data-drag-target]")
      .forEach((el) => el.removeAttribute("data-drag-target"));

    for (const cb of this.#dragendHandlers) {
      cb(this.activeDrag);
    }
    this.activeDrag = null;
  }

  #dragstartHandlers = new Set<(e: DragOperation) => void>();
  #dragendHandlers = new Set<(e: DragOperation) => void>();
  public on(kind: "dragstart" | "dragend", cb: (e: DragOperation) => void) {
    if (kind === "dragstart") this.#dragstartHandlers.add(cb);
    else if (kind === "dragend") this.#dragendHandlers.add(cb);
  }
  public off(kind: "dragstart" | "dragend", cb: (e: DragOperation) => void) {
    if (kind === "dragstart") this.#dragstartHandlers.delete(cb);
    else if (kind === "dragend") this.#dragendHandlers.delete(cb);
  }
  public callHandlers(kind: "dragstart" | "dragend", e: DragOperation) {
    if (kind === "dragstart") {
      this.#dragstartHandlers.forEach((cb) => cb(e));
    } else if (kind === "dragend") {
      this.#dragendHandlers.forEach((cb) => cb(e));
    }
  }
}

export class DragOperation<DataTypes extends { [key: string]: any } = { [key: string]: any }> {
  readonly id: string;

  from: DragZone | null;
  #to: DragZone | null;
  get to() {
    return this.#to;
  }
  set to(v: DragZone | null) {
    this.#to = v;
    if (v !== null) {
      document.body.setAttribute("data-drag-target", v.id);
    } else {
      document.body.removeAttribute("data-drag-target");
    }
  }
  area: HTMLDragArea | null;

  item: DragItem<DataTypes> | null; // DragItem, null it native drag from outside
  dataTransfer: DataTransfer | null; // DataTransfer, if custom drag, still original event dataTransfer

  index: number | null; // Generic index used by e.g. AxisDragZone
  dropPosition: DropPosition | null; // Fine-grained position relative to drop target

  get isNative(): boolean {
    return this.item === null && this.dataTransfer !== null;
  }

  protected constructor(props: {
    id?: string;
    from?: DragZone;
    to?: DragZone;
    area?: HTMLDragArea;
    item?: DragItem<any>;
    dataTransfer?: DataTransfer;
    index?: number;
    dropPosition?: DropPosition;
  }) {
    this.id = props.id ?? genId();
    this.from = props.from || null;
    this.#to = props.to || null;
    this.area = props.area ?? null;
    this.item = props.item ?? null;
    this.dataTransfer = props.dataTransfer ?? null;
    this.index = props.index ?? null;
    this.dropPosition = props.dropPosition ?? null;
  }

  static new(props: {
    id?: string;
    from?: DragZone;
    to?: DragZone;
    area?: HTMLDragArea;
    item?: DragItem;
    dataTransfer?: DataTransfer;
    dropPosition?: DropPosition;
  }): DragOperation {
    return new this(props);
  }
}

export class DragData<T extends Record<string, any> = { [key: string]: any }> {
  #data: Map<string, unknown> = new Map();

  constructor(from?: Partial<T>) {
    if (from) {
      for (const [key, value] of Object.entries(from)) {
        this.setData(key, value);
      }
    }
  }

  public getData<K extends keyof T>(key: K): T[K];
  public getData(key: string): unknown;
  public getData(key: string): unknown {
    return this.#data.get(key);
  }

  public setData<K extends keyof T>(key: K, value: T[K]): void;
  public setData(key: string, value: unknown): void;
  public setData(key: string, value: unknown): void {
    this.#data.set(key, value);
  }

  public hasData<K extends keyof T>(key: K): boolean;
  public hasData(key: string): boolean;
  public hasData(key: string): boolean {
    return this.#data.has(key);
  }

  public clearData<K extends keyof T>(key?: K): void;
  public clearData(key?: string): void;
  public clearData(key?: string): void {
    if (key === undefined) this.#data.clear();
    else this.#data.delete(key);
  }
}
