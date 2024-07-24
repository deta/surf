import type { ActionReturn } from "svelte/action";
import {
  DEBUG,
  DragculaCustomDragEvent,
  DragculaNativeDragEvent,
  type DragculaDragEvent,
  type DragEffect,
  type DragOperation
} from "./index.js";
import { get, writable, type Writable } from "svelte/store";

export let ACTIVE_DRAG: Writable<null | DragOperation> = writable(null);

export interface DragZoneActionProps {
  id: string;
  controller?: DragZone;

  /// Use to check, whether the zone accepts the drag.
  acceptDrag: (drag: DragculaDragEvent) => boolean;

  //items: Writable<unknown[]> | unknown[];
  //getItem: (id: string) => unknown
}
export interface DragZoneActionAttributes<T extends DragculaDragEvent> {
  /// Whether the zone accepts any drops at all.
  droppable?: boolean;

  "on:DragEnter"?: (e: T) => void;
  "on:DragOver"?: (e: T) => void;
  "on:DragLeave"?: (e: T) => void;
  "on:DragEnd"?: (e: T) => void;
  "on:Drop"?: (e: T) => void;
}

export const DRAG_ZONES = new Map<string, DragZone>();

export class DragZone {
  readonly id: string;
  readonly node?: HTMLElement;

  /// === Callbacks

  acceptDrag: (drag: DragculaDragEvent) => boolean = () => false;

  /// === STATE

  /// Global "switch" whether thi zone accepts any drops.
  protected droppable = true;

  set isDropTarget(v: boolean) {
    if (v) {
      this.node && (this.node!.dataset.dragculaDropTarget = "true");
    } else {
      this.node && delete this.node?.dataset.dragculaDropTarget;
    }
  }

  get childDomSize(): { w: number; h: number } | undefined {
    if (!this.node) return undefined;

    // Find first child node recursive with data-dragcula-item attribute
    const findItem = (el: HTMLElement): HTMLElement | null => {
      if (el.dataset.dragculaItem) return el;
      for (const child of el.children) {
        const found = findItem(child as HTMLElement);
        if (found) return found;
      }
      return null;
    };

    const item = findItem(this.node);

    if (item === null) return undefined;
    const { width: w, height: h } = item.getBoundingClientRect();
    return { w, h };
  }

  /// === CONSTRUCTOR

  constructor(id?: string) {
    this.id = id || crypto.randomUUID();
  }

  attach(node: HTMLElement) {
    (this.node as HTMLElement) = node;

    this.node!.setAttribute("data-dragcula-zone", this.id);
    this.node!.style.setProperty("view-transition-name", `dragcula-zone-${this.id}`);

    // Event listeners
    this.node!.addEventListener("dragenter", this.boundHandleDragEnter);
    this.node!.addEventListener("dragover", this.boundHandleDragOver);
    this.node!.addEventListener("dragleave", this.boundHandleDragLeave);
    this.node!.addEventListener("drop", this.boundHandleDrop);

    DRAG_ZONES.set(this.id, this);
  }

  detach() {
    DRAG_ZONES.delete(this.id);

    this.node!.removeEventListener("dragenter", this.boundHandleDragEnter);
    this.node!.removeEventListener("dragover", this.boundHandleDragOver);
    this.node!.removeEventListener("dragleave", this.boundHandleDragLeave);
    this.node!.removeEventListener("drop", this.boundHandleDrop);
  }

  public applyNodeAttributes() {}

  /// === UTILS

  /// === DOM EVENTS

  protected handleDragEnter(e: DragEvent) {
    //if (e.target !== this.node!) return;
    console.debug(`[Dragcula::Z-${this.id}] DragEnter`, e);

    const drag = get(ACTIVE_DRAG) || {
      id: crypto.randomUUID(),
      from: null,
      to: this,
      item: null,
      data: e.dataTransfer || new DataTransfer(),
      effect: (e.dataTransfer?.dropEffect as DragEffect) || "none"
    };
    const event =
      drag.data instanceof DataTransfer
        ? new DragculaNativeDragEvent("DragEnter", e, drag)
        : new DragculaCustomDragEvent("DragEnter", e, drag);

    if (!this.acceptDrag(event)) return;
    this.onDragEnter(drag, e);
  }
  protected boundHandleDragEnter = this.handleDragEnter.bind(this);

  protected handleDragOver(e: DragEvent) {
    //if (e.target !== this.node!) return;
    //console.debug(`[Dragcula::Z-${this.id}] DragOver`, e);

    const drag = get(ACTIVE_DRAG) || {
      id: crypto.randomUUID(),
      from: null,
      to: this,
      item: null,
      data: e.dataTransfer || new DataTransfer(),
      effect: (e.dataTransfer?.dropEffect as DragEffect) || "none"
    };
    const event =
      drag.data instanceof DataTransfer
        ? new DragculaNativeDragEvent("DragOver", e, drag)
        : new DragculaCustomDragEvent("DragOver", e, drag);

    if (!this.acceptDrag(event)) return;
    e.preventDefault();
    this.onDragOver(drag, e);
  }
  protected boundHandleDragOver = this.handleDragOver.bind(this);

  protected handleDragLeave(e: DragEvent) {
    //if (e.target !== this.node!) return;
    console.debug(`[Dragcula::Z-${this.id}] DragLeave`, e);

    const drag = get(ACTIVE_DRAG) || {
      id: crypto.randomUUID(),
      from: null,
      to: this,
      item: null,
      data: e.dataTransfer || new DataTransfer(),
      effect: (e.dataTransfer?.dropEffect as DragEffect) || "none"
    };
    const event =
      drag.data instanceof DataTransfer
        ? new DragculaNativeDragEvent("DragLeave", e, drag)
        : new DragculaCustomDragEvent("DragLeave", e, drag);

    if (!this.acceptDrag(event)) return;
    this.onDragLeave(drag, e);
  }
  protected boundHandleDragLeave = this.handleDragLeave.bind(this);

  protected handleDrop(e: DragEvent) {
    console.debug(`[Dragcula::Z-${this.id}] Drop`, e);

    const drag = get(ACTIVE_DRAG) || {
      id: crypto.randomUUID(),
      from: null,
      to: this,
      item: null,
      data: e.dataTransfer || new DataTransfer(),
      effect: (e.dataTransfer?.dropEffect as DragEffect) || "none"
    };
    const event =
      drag.data instanceof DataTransfer
        ? new DragculaNativeDragEvent("DragLeave", e, drag)
        : new DragculaCustomDragEvent("DragLeave", e, drag);

    if (!this.acceptDrag(event)) return;

    e.preventDefault();
    e.stopPropagation(); // TODO: See if we need this for nested zones?
    this.onDrop(drag, e);
  }
  protected boundHandleDrop = this.handleDrop.bind(this);

  /// === EVENT HANDLERS

  protected onDragEnter(drag: DragOperation, e: DragEvent) {
    this.isDropTarget = true;

    const event =
      drag.data instanceof DataTransfer
        ? new DragculaNativeDragEvent("DragEnter", e, drag)
        : new DragculaCustomDragEvent("DragEnter", e, drag);
    this.node!.dispatchEvent(event);
    drag.item?.onDragEnter(drag);
  }

  protected onDragOver(drag: DragOperation, e: DragEvent) {
    this.isDropTarget = true;
    const event =
      drag.data instanceof DataTransfer
        ? new DragculaNativeDragEvent("DragOver", e, drag)
        : new DragculaCustomDragEvent("DragOver", e, drag);
    this.node!.dispatchEvent(event);
  }

  protected onDragLeave(drag: DragOperation, e: DragEvent) {
    this.isDropTarget = false;

    const event =
      drag.data instanceof DataTransfer
        ? new DragculaNativeDragEvent("DragLeave", e, drag)
        : new DragculaCustomDragEvent("DragLeave", e, drag);
    this.node!.dispatchEvent(event);
    drag.item?.onDragLeave(drag);
  }

  /* Mirrors the drag item's onDragEnd event.
   * This is only called on the source zone, not the target zone.
   * NOTE: Use this to remove the item from this zone on move.
   */
  onDragEnd(drag: DragOperation, e: DragEvent) {
    console.debug(`[Dragcula::Z-${this.id}] DragEnd`, e);
    this.isDropTarget = false;

    const event =
      drag.data instanceof DataTransfer
        ? new DragculaNativeDragEvent("DragEnd", e, drag)
        : new DragculaCustomDragEvent("DragEnd", e, drag);
    this.node!.dispatchEvent(event);
  }

  protected onDrop(drag: DragOperation, e: DragEvent) {
    this.isDropTarget = false;

    const event =
      drag.data instanceof DataTransfer
        ? new DragculaNativeDragEvent("Drop", e, drag)
        : new DragculaCustomDragEvent("Drop", e, drag);
    this.node!.dispatchEvent(event);
  }

  /// === ACTION

  static action<
    P extends DragZoneActionProps,
    A extends DragZoneActionAttributes<DragculaDragEvent>
  >(node: HTMLElement, props: P): ActionReturn<P, A> {
    const controller = DRAG_ZONES.get(props.id) || props.controller || new this(props.id);

    controller.attach(node);
    props.acceptDrag && (controller.acceptDrag = props.acceptDrag);

    return {
      update(props: P) {
        if (DEBUG) console.debug(`[Dragcula::Z-${controller.id}] Updated props`, props);
        props.acceptDrag && (controller.acceptDrag = props.acceptDrag);
      },
      destroy() {
        controller.detach();
      }
    };
  }
}
