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

  onDragEnter(drag: DragOperation): boolean {}

  onDragOver(drag: DragOperation): boolean {}

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

    return {
      destroy() {
        controller.destory();
      },
      updated(props: any) {}
    };
  }

  override destroy() {
    super.destroy();
  }

  /// === DOM HANDLERS

  protected _handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.debug(`[HTMLDragZone::${this.id}] DragEnter`, e);
  }
  protected handleDragEnter = this._handleDragEnter.bind(this);

  protected _handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.debug(`[HTMLDragZone::${this.id}] DragOver`, e);
  }
  protected handleDragOver = this._handleDragOver.bind(this);

  protected _handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.debug(`[HTMLDragZone::${this.id}] DragLeave`, e);
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
    const drag = get(ACTIVE_DRAG_OPERATION)!;

    // Setup vt & start

    // TODO: Possibly wrap in try catch & set completed based on that?
    const completed = this.node.dispatchEvent(
      new DragculaDragEvent("Drop", {
        id: drag.id,
        item: drag.item,
        from: drag.from || undefined,
        to: drag.to || undefined
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

  override onDrop(drag: DragOperation) {}
}
