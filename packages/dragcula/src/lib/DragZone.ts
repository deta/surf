/*import type { ActionReturn } from "svelte/action";
import { DEBUG, DragculaCustomDragEvent, DragculaNativeDragEvent, type DragculaDragEvent, type DragEffect, type DragOperation } from "./index.js";
import { get, writable, type Writable } from "svelte/store";

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

	'on:DragEnter'?: (e: T) => void,
	'on:DragOver'?: (e: T) => void,
	'on:DragLeave'?: (e: T) => void,
	'on:DragEnd'?: (e: T) => void,
	'on:Drop'?: (e: T) => void,
}

export const DRAG_ZONES = new Map<string, DragZone>();*/

import { get } from "svelte/store";
import {
  DragculaDragEvent,
  DragItem,
  HTMLDragItem,
  type DragEffect,
  type DragOperation
} from "./index.js";
import { ACTIVE_DRAG_OPERATION } from "./internal.js";
import { tick } from "svelte";

/* An abstract Zone, an item could be dragged over, and dropped into.
 */
export class DragZone {
  static ZONES = new Map<string, DragZone>();

  readonly id: string;

  /// === STATE

  protected _isTarget = false;
  get isTarget(): boolean {
    return this._isTarget;
  }
  set isTarget(v: boolean) {
    this._isTarget = v;
  }

  effectsAllowed: DragEffect[] = ["none", "move", "copy", "link"];

  /// === CONSTRUCTOR

  constructor(props: { id?: string }) {
    this.id = props.id || crypto.randomUUID();

    DragZone.ZONES.set(this.id, this);
  }

  /// Lifecycle cleanup.
  destroy() {
    DragZone.ZONES.delete(this.id);
  }

  /// === EVENTS

  onDragEnter(drag: DragOperation): boolean {
    return true;
  }

  onDragOver(drag: DragOperation): boolean {
    return true;
  }

  onDragLeave(drag: DragOperation) {}

  onDrop(drag: DragOperation) {}
}

export class HTMLDragZone extends DragZone {
  /// === CONFIG

  readonly node: HTMLElement;

  /// === STATE

  override set isTarget(v: boolean) {
    super.isTarget = v;
    // TODO: dom style change
  }

  /// === CONSTRUCTOR

  constructor(node: HTMLElement, props: { id?: string }) {
    super(props);
    this.node = node;

    this.node.setAttribute("data-dragcula-zone", this.id);
    this.node.style.setProperty("view-transition-name", `dragcula-zone-${this.id}`);

    this.node.addEventListener("drop", this.handleDrop);
    this.node.addEventListener("dragenter", this.handleDragEnter);
    this.node.addEventListener("dragleave", this.handleDragLeave);
    this.node.addEventListener("dragover", this.handleDragOver);
  }

  static action(node: HTMLElement, props: { id?: string }) {
    const controller = new this(node, props);
    controller.applyNodeAttributes();

    return {
      destroy() {
        controller.destroy();
      },
      updated(props: any) {
        controller.applyNodeAttributes();
      }
    };
  }

  override destroy() {
    // TODO: Remove as unuseful?
    super.destroy();
  }

  applyNodeAttributes() {}

  /// === DOM HANDLERS

  protected _handleDragEnter(e: DragEvent) {
    e.stopPropagation();
    console.debug(`[HTMLDragZone::${this.id}] DragEnter`, e);

    if (get(ACTIVE_DRAG_OPERATION) === null) {
      ACTIVE_DRAG_OPERATION.set({
        id: crypto.randomUUID(),
        status: "active",
        item: e.dataTransfer || new DataTransfer(),
        from: null,
        to: this
      });
    }

    const drag = get(ACTIVE_DRAG_OPERATION)!;
    // TODO: What if null?
    console.warn("enter accep", this.onDragEnter(drag!));
    if (this.onDragEnter(drag)) e.preventDefault();
    console.warn("Zone acceptDRAG", e.defaultPrevented);
  }
  protected handleDragEnter = this._handleDragEnter.bind(this);

  protected _handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    //console.debug(`[HTMLDragZone::${this.id}] DragOver`, e);
    const drag = get(ACTIVE_DRAG_OPERATION);
    // TODO: What if null?
    this.onDragOver(drag!);
  }
  protected handleDragOver = this._handleDragOver.bind(this);

  protected _handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.debug(`[HTMLDragZone::${this.id}] DragLeave`, e);
    const drag = get(ACTIVE_DRAG_OPERATION);
    // TODO: What if null?
    this.onDragLeave(drag!);
  }
  protected handleDragLeave = this._handleDragLeave.bind(this);

  protected async _handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.debug(`[HTMLDragZone::${this.id}] Drop`, e);

    if (get(ACTIVE_DRAG_OPERATION) === null) {
      ACTIVE_DRAG_OPERATION.set({
        id: crypto.randomUUID(),
        status: "active",
        item: e.dataTransfer || new DataTransfer(),
        from: null,
        to: this
      });
    }
    ACTIVE_DRAG_OPERATION.update((v) => {
      v!.item = e.dataTransfer || new DataTransfer();
      return v;
    });
    const drag = get(ACTIVE_DRAG_OPERATION)!;

    // Setup vt & start

    // TODO: Possibly wrap in try catch & set completed based on that?
    // NOTE: negated as by default should abort to reset item, only on succesful drop
    // should it be completed!
    const completed = !this.node.dispatchEvent(
      new DragculaDragEvent("Drop", {
        id: drag.id,
        status: drag.status,
        item: drag.item,
        from: drag.from || undefined,
        to: drag.to || undefined,
        bubbles: false
      })
    );

    ACTIVE_DRAG_OPERATION.update((v) => {
      (v!.status as "aborted" | "completed") = completed ? "completed" : "aborted";
      return v;
    });

    await tick();

    // NOTE: We need to dispatch this manually for custom drags.. see othr notes
    if (drag.item instanceof DataTransfer) {
      // NOTE: Ensures that this is ran after  DragItem on:dragend was called
      // They have access to drag.status so they can handle the drop differently.
      await new Promise((r) => setTimeout(r));
    }

    // NOTE: Ensures that this is ran after  DragItem on:dragend was called
    // They have access to drag.status so they can handle the drop differently.
    setTimeout(() => {
      console.warn("_handleDrop ended");
      // await tick();
      // remove tmp vt names
    });

    // await tran sfinished
  }
  protected handleDrop = this._handleDrop.bind(this);

  /// === EVENTS

  override onDragEnter(drag: DragOperation): boolean {
    const acceptDrag = !this.node.dispatchEvent(
      new DragculaDragEvent("DragEnter", {
        id: drag.id,
        status: drag.status,
        item: drag.item,
        from: drag.from || undefined,
        to: this
      })
    );

    return acceptDrag;
  }

  override onDrop(drag: DragOperation) {}
}
