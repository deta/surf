import type { ActionReturn } from "svelte/action";
import { DragculaDragEvent, type DragEffect, type DragOperation } from "./index.js";
import { EventSpy, MOUSE_POS } from "./internal.js";

export class DragZone {
  static ZONES = new Map<string, DragZone>();

  readonly id: string;

  /// === STATE

  protected _isTarget = false;
  get isTarget() {
    return this._isTarget;
  }
  set isTarget(v: boolean) {
    this._isTarget = v;
  }

  protected effectsAllowed: DragEffect[];

  /// === CONSTRUCTOR

  constructor(props: { id?: string; effectsAllowed?: DragEffect[] }) {
    this.id = props.id ?? crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
    this.effectsAllowed = props.effectsAllowed ?? ["move", "copy", "link", "none"];

    // FIX: Removed for now to enable scuffed nesting lol
    /*if (DragZone.ZONES.has(this.id)) {
			throw new Error(`DragZone with id ${this.id} already exists!`);
		}*/
    DragZone.ZONES.set(this.id, this);
  }

  destroy() {
    //DragZone.ZONES.delete(this.id);
  }

  /// === EVENTS

  onDragEnter(drag?: DragOperation): Promise<boolean> {
    return Promise.resolve(false);
  }

  onDragLeave(drag?: DragOperation) {
    this.isTarget = false;
  }

  onDragOver(drag?: DragOperation) {}

  onDrop(drag?: DragOperation) {
    this.isTarget = false;
  }
}

export class HTMLDragZone extends DragZone {
  readonly element: HTMLElement;

  /// === STATE

  override set isTarget(v: boolean) {
    super.isTarget = v;
    if (v) {
      this.element.setAttribute("data-dragcula-isTarget", "true");
      document.body.setAttribute("data-dragcula.isTargeting", this.id);
    } else {
      this.element.removeAttribute("data-dragcula-isTarget");
      document.body.removeAttribute("data-dragcula.isTargeting");
    }
  }

  /// === CONSTRUCTOR

  constructor(node: HTMLElement, props: { id?: string; effectsAllowed?: DragEffect[] }) {
    props.id =
      node.getAttribute("id") ??
      props.id ??
      crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
    super(props);
    this.element = node;

    this.element.setAttribute("data-dragcula-zone", this.id);
    if (this.element.style.viewTransitionName === "") {
      this.element.style.setProperty("view-transition-name", `dragcula-zone-${this.id}`);
    }

    this.applyDomAttributes();

    this.element.addEventListener("drop", this.handleDrop);
    this.element.addEventListener("dragenter", this.handleDragEnter);
    this.element.addEventListener("dragleave", this.handleDragLeave);
    this.element.addEventListener("dragover", this.handleDragOver);
  }

  destroy() {
    this.element.removeEventListener("drop", this.handleDrop);
    this.element.removeEventListener("dragenter", this.handleDragEnter);
    this.element.removeEventListener("dragleave", this.handleDragLeave);
    this.element.removeEventListener("dragover", this.handleDragOver);

    super.destroy();
  }

  applyDomAttributes() {
    // TODO: impl
  }

  static action(
    node: HTMLElement,
    props: { id?: string; effectsAllowed?: DragEffect[] }
  ): ActionReturn {
    const controller = new this(node, props);
    return {
      destroy() {
        controller.destroy();
      },
      update(props: any) {
        // TODO: impl
      }
    };
  }

  /// === EVENTS

  override async onDrop(drag?: DragOperation): Promise<void> {
    console.debug(`[HTMLDragZone:${this.id}] Drop`, drag);
    super.onDrop(drag);

    if (drag === undefined) {
      console.error("Not implemented, native drop");
      // TODO: handle native drop
      return Promise.reject();
    }

    const hasDragculaListeners = EventSpy.hasListenerOfType(this.element, "Drop");
    const handlesDragculaEventCorrectly = EventSpy.allListenersHandleDragculaEvent(
      this.element,
      "Drop"
    );

    console.warn("onDrop", hasDragculaListeners, handlesDragculaEventCorrectly);

    return await DragculaDragEvent.dispatch("Drop", drag, this.element);
    /// FIX: beeing dispatch in svelte, out cheks dont work :(
    /*	if (hasDragculaListeners && !handlesDragculaEventCorrectly) {
			throw new Error(`[HTMLDragZone:${this.id}] Dragcula event listeners do not handle event correctly!`);
		}
		else if (hasDragculaListeners && handlesDragculaEventCorrectly) {
			return await DragculaDragEvent.dispatch("Drop", drag, this.element);
		}
		else {
			return DragculaDragEvent.dispatch("Drop", drag, this.element);
		}*/
  }

  override async onDragEnter(drag?: DragOperation): Promise<boolean> {
    console.debug(`[HTMLDragZone:${this.id}] DragEnter`, drag);
    console.assert(
      drag !== undefined,
      "onDragEnter called with dragOperation === undefined! This should not happen!"
    );
    super.onDragEnter(drag);

    const hasListener = EventSpy.hasListenerOfType(this.element, "DragEnter");
    if (!hasListener) return false;

    // TODO: Call event
    try {
      await DragculaDragEvent.dispatch("DragEnter", drag!, this.element);
      return true;
    } catch {
      return false;
    }
  }

  override onDragLeave(drag?: DragOperation) {
    console.debug(`[HTMLDragZone:${this.id}] DragLeave`, drag);
    super.onDragLeave(drag);
  }

  override onDragOver(drag?: DragOperation) {
    //console.debug(`[HTMLDragZone:${this.id}] DragOver`, drag);
    super.onDragOver(drag);
  }

  /// === DOM HANDLERS
  protected handleDrop = this._handleDrop.bind(this);
  protected handleDragEnter = this._handleDragEnter.bind(this);
  protected handleDragLeave = this._handleDragLeave.bind(this);
  protected handleDragOver = this._handleDragOver.bind(this);

  protected _handleDrop(e: DragEvent) {
    e.stopPropagation();
    e.preventDefault();
    console.debug(`[HTMLDragZone:${this.id}] drop (NATIVE)`, e);

    if (document.activeDragOperation === undefined) {
      console.error(`[HTMLDragZone:${this.id}] No active drag operation during NATIVE drop!`);
      return;
    }

    document.activeDragOperation.item = e.dataTransfer || new DataTransfer();

    this.onDrop(document.activeDragOperation);
    document.activeDragOperation = undefined;
  }
  protected async _handleDragEnter(e: DragEvent) {
    e.stopPropagation();
    console.debug(`[HTMLDragZone:${this.id}] dragenter`, e);
    if (document.activeDragOperation === undefined) {
      console.log(
        `[HTMLDragZone:${this.id}] No active drag operation! Creating one with native DataTransfer!`
      );
      document.activeDragOperation = {
        id: crypto.getRandomValues(new Uint32Array(1))[0].toString(16),
        status: "active",
        from: null,
        to: this,
        item: e.dataTransfer || new DataTransfer()
      };
    }

    if (await this.onDragEnter(document.activeDragOperation)) e.preventDefault();
  }
  protected _handleDragLeave(e: DragEvent) {
    e.stopPropagation();
    e.preventDefault();
    console.debug(`[HTMLDragZone:${this.id}] dragleave`, e);
    this.onDragLeave(document.activeDragOperation);
  }
  protected _handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // FIX: Raw mous post? or why no work on axis zone?
    //MOUSE_POS.x = e.clientX;
    //MOUSE_POS.y = e.clientY;
    this.onDragOver(document.activeDragOperation);
    //e.preventDefault();
    //console.debug(`[HTMLDragZone:${this.id}] dragover`, e);
  }

  /// === UTILS

  static findClosestFromPoint(x: number, y: number): HTMLDragZone | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (el === null) return null;
    return this.findClosestFromElement(el);
  }
  static findClosestFromElement(element: HTMLElement): HTMLDragZone | null {
    let el: HTMLElement | null = element;
    while (el !== null) {
      if (el.getAttribute("data-dragcula-zone") !== null) {
        // FIX: This should always be an HTMLDragZone except in weird cases, specifying custom
        // controller extended from DragZone.
        // Should be fine for now though!
        const zoneId = el.getAttribute("data-dragcula-zone")!;
        if (!DragZone.ZONES.has(zoneId)) {
          console.error("Target zone found, but controller is NULL");
        }
        return (DragZone.ZONES.get(el.getAttribute("data-dragcula-zone")!) as HTMLDragZone) || null;
      }
      el = el.parentElement;
    }
    return null;
  }
}
