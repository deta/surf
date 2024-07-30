/*import type { ActionReturn } from "svelte/action";
import { ACTIVE_DRAG, createDragData, createStyleCache, DEBUG, DRAG_ZONES, DragculaCustomDragEvent, DragculaNativeDragEvent, DragZone, findClosestDragZoneFromEl, findClosestDragZoneFromPoint, mousePos, type DragOperation, type ItemPreviewMode, type RawDragData } from "./index.js";
import { get } from "svelte/store";
import { tick } from "svelte";

export interface DragItemActionProps {
	id: string;
	controller?: DragItem;

	data: RawDragData;
}
export interface DragItemActionAttributes {
	// Whether the item can be dragged.
	draggable?: boolean;

	dragpreview?: "clone" | "hoist";
	//simulatedragstart?: "true" | "false"; // Use so we can have a min-move before start

	'on:DragStart'?: (e: DragculaDragEvent) => void,
	'on:Drag'?: (e: DragculaDragEvent) => void,
	'on:DragEnter'?: (e: DragculaDragEvent) => void,
	'on:DragLeave'?: (e: DragculaDragEvent) => void,
	'on:DragEnd'?: (e: DragculaDragEvent) => void,
}*/

import type { ActionReturn } from "svelte/action";
import {
  createStyleCache,
  DragculaDragEvent,
  DragZone,
  findClosestDragZoneFromEl,
  findClosestDragZoneFromPoint,
  type DragData,
  type DragEffect,
  type DragOperation,
  type ItemPreviewMode
} from "./index.js";
import { ACTIVE_DRAG_OPERATION, mousePos } from "./internal.js";
import { get } from "svelte/store";
import { tick } from "svelte";

/** An abstract Item, holding some data, a dragEffect
 * and exposing handler function called during a drag operation.
 */
export class DragItem {
  readonly id: string;

  /// === STATE

  protected _isDragging = false;
  get isDragging(): boolean {
    return this._isDragging;
  }
  set isDragging(v: boolean) {
    this._isDragging = v;
  }

  protected _isOverZone = false;
  get isOverZone(): boolean {
    return this._isOverZone;
  }
  set isOverZone(v: boolean) {
    this._isOverZone = v;
  }

  data: DragData;
  dragEffect: DragEffect = "none";
  previewEffect: ItemPreviewMode = "hoist";

  /// === CONSTRUCTOR

  constructor(props: { id?: string; data?: DragData }) {
    this.id = props.id || crypto.randomUUID();
    this.data = props.data || {};
  }

  /// Lifecycle cleanup.
  destroy() {}

  /// === UTILS

  /// === EVENTS

  /** Prepare the drag operation.
   * e.g. handling document changes.
   *
   * @param drag Reference the active drag operation, or undfined if no active one (e.g. called from HTMLDragItem on dragstart)
   */
  onDragStart(drag?: DragOperation) {
    // Bootstrap drag operation if not already active
    if (!drag) {
      ACTIVE_DRAG_OPERATION.set({
        id: crypto.randomUUID(),
        status: "active",
        from: null,
        to: null,
        item: this
      });
    }

    // Set effect depending on the keys pressed
    // TODO: Impl handle keys
    if (true) {
      this.dragEffect = "move";
    }
  }

  /** Update the drag state.
   * e.g. update visual position, document styles etc.
   */
  onDrag(drag: DragOperation) {
    // NOTE: Defaults to no-op,
  }

  /** Finalize the drag operation.
   * e.g. clean up document changes depending on whether the drag was
   *			completed or aborted.
   */
  onDragEnd(drag: DragOperation) {}

  /** Called once, when cursor enters a zone different from the active target zone.
   * e.g. use to update visual feedback depnding on the target.
   */
  onDragEnter(drag: DragOperation) {}

  /** Called once, when cursor leaves the active target zone.
   * e.g. use to update visual feedback depending on the target.
   */
  onDragLeave(drag: DragOperation) {}
}

/** A DragItem that is bound to a HTMLElement.
 *  Note, that it can re-attach to a different node during a drag operation,
 *  e.g. if a move operation is performed.
 */
export class HTMLDragItem extends DragItem {
  /// Map of active HTMLDragItems used to find re-attach items e.g. during move.
  static ITEMS = new Map<string, HTMLDragItem>();

  protected static _activeTransition: ViewTransition | false = false;
  static get activeTransition(): ViewTransition | false {
    return this._activeTransition;
  }
  static setActiveTransition(transition: ViewTransition, skipActive = true) {
    console.error("DONT USE THIS!!!");
    return;
    if (HTMLDragItem.activeTransition) {
      if (skipActive) HTMLDragItem.activeTransition.skipTransition();
      HTMLDragItem._activeTransition = transition;
    }
  }
  static async startTransition(cbk: () => void, skipActive = true): Promise<ViewTransition> {
    if (true) {
      // TODO: TEST USE_TRANSITIONS
      cbk();
      return {
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        finished: Promise.resolve(),
        skipTransition: () => {}
      } satisfies ViewTransition;
    }

    if (HTMLDragItem.activeTransition) {
      if (skipActive) HTMLDragItem.activeTransition.skipTransition();
      await HTMLDragItem.activeTransition.finished;
    }
    HTMLDragItem._activeTransition = document.startViewTransition(cbk);
    HTMLDragItem._activeTransition.finished.then(() =>
      setTimeout(() => {
        HTMLDragItem._activeTransition = false;
      })
    );
    return HTMLDragItem._activeTransition;
  }

  /// === CONFIG

  readonly node: HTMLElement;

  readonly nodeNext?: HTMLElement;
  readonly nodeParent?: HTMLElement;

  /// === STATE

  override set isDragging(v: boolean) {
    super.isDragging = v;
    // TODO: update dom
  }
  override set isOverZone(v: boolean) {
    super.isOverZone = v;
    // TODO: update dom
  }

  protected styles = createStyleCache();

  protected raf: number | null = null;
  protected previewX: number = 0;
  protected previewY: number = 0;
  protected previewSize: { w: number; h: number } = { w: 0, h: 0 };
  get previewTransform(): string {
    return `translate(${this.previewX - this.previewSize.w / 2}px, ${this.previewY - this.previewSize.h / 2}px)`;
  }

  /// === CONSTRUCTOR

  constructor(node: HTMLElement, props: { id?: string; data?: DragData }) {
    super(props);
    this.node = node;
    this.node.setAttribute("data-dragcula-item", this.id);

    this.nodeParent = node.parentElement || undefined;

    if (HTMLDragItem.ITEMS.has(this.id)) {
      console.debug(
        `[HTMLDragItem::${this.id}] Re-attaching new node to existing item.`,
        this.node,
        this
      );
      // TODO: styles.cache, set auto vt-name
    } else {
      HTMLDragItem.ITEMS.set(this.id, this);
    }

    this.node.addEventListener("dragend", this.handleDragEnd);
    this.node.addEventListener("drag", this.handleDrag, { capture: true });
    this.node.addEventListener("dragstart", this.handleDragStart, { capture: true });
  }

  static action(node: HTMLElement, props: { id?: string }): ActionReturn {
    const controller = new this(node, props);

    return {
      destroy() {
        controller.destroy();
      },
      update(props: any) {}
    };
  }

  override destroy() {
    this.node.removeEventListener("dragstart", this.handleDragStart);
    this.node.removeEventListener("drag", this.handleDrag, { capture: true });
    this.node.removeEventListener("dragend", this.handleDragEnd, { capture: true });

    //if (get(ACTIVE_DRAG_OPERATION) !== null && (get(ACTIVE_DRAG_OPERATION)!.item as DragItem)?.id !== this.id) {
    HTMLDragItem.ITEMS.delete(this.id);
    //}

    super.destroy();
  }

  protected async rafCbk(_: number) {
    this.node.style.transform = this.previewTransform;

    this.raf = null;
  }
  protected boundRafCbk = this.rafCbk.bind(this);

  /// === DOM HANDLERS

  /** Sadly we need this workaround, as native drag event
   *  is only fired about every 300ms so it lags like shit.
   */
  protected _handleMouseMove(e: MouseEvent) {
    this.node.dispatchEvent(
      new DragEvent("drag", {
        clientX: e.clientX,
        clientY: e.clientY,
        bubbles: false
      })
    );
  }
  protected handleMouseMove = this._handleMouseMove.bind(this);

  /** Safly we need this workaround, as no drop event is automatically fired
   * as we needed to prevent native dragstart event.
   */
  protected async _handleMouseUp(e: MouseEvent) {
    document.body.removeAttribute("data-dragcula-dragging");

    const drag = get(ACTIVE_DRAG_OPERATION)!;

    // start vt
    HTMLDragItem.startTransition(async () => {
      if (drag.to !== null) {
        e.target?.dispatchEvent(
          new DragEvent("drop", {
            bubbles: true
          })
        );
      } else {
        ACTIVE_DRAG_OPERATION.update((v) => {
          (v!.status as "completed" | "aborted") = "aborted";
          return v;
        });
      }

      await tick();

      //if (drag.item instanceof HTMLDragItem) {
      this.node.dispatchEvent(new DragEvent("dragend"));
      //}
    }, true);
  }
  protected handleMouseUp = this._handleMouseUp.bind(this);

  protected _handleDragStart(e: DragEvent) {
    document.body.setAttribute("data-dragcula-dragging", "true");

    // NOTE: THIS IS THE ISSUE WHY EVERYTHING COULD BE SOOOO SIMPLE
    // BUT ISN'T!
    e.preventDefault();
    e.stopPropagation();
    console.log(`[HTMLDragItem::${this.id}] DragStart`, e);

    (this.nodeNext as HTMLElement) = this.node.nextElementSibling as HTMLElement;
    this.previewX = e.clientX;
    this.previewY = e.clientY;

    // super call
    this.onDragStart();
  }
  protected handleDragStart = this._handleDragStart.bind(this);

  protected _handleDrag(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    //console.log(`[HTMLDragItem::${this.id}] Drag`, e);

    this.previewX = e.clientX;
    this.previewY = e.clientY;

    this.onDrag(get(ACTIVE_DRAG_OPERATION)!);
  }
  protected handleDrag = this._handleDrag.bind(this);

  protected _handleDragEnd(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.log(`[HTMLDragItem::${this.id}] DragEnd`, e);
    document.body.removeAttribute("data-dragcula-dragging");
    document.body.removeAttribute("data-dragcula-overZone");

    if (get(ACTIVE_DRAG_OPERATION) !== null) this.onDragEnd(get(ACTIVE_DRAG_OPERATION)!);
  }
  protected handleDragEnd = this._handleDragEnd.bind(this);

  /// === EVENTS

  override async onDragStart(drag?: DragOperation) {
    super.onDragStart(drag);

    const srcZone = findClosestDragZoneFromEl(this.node);
    if (srcZone) {
      ACTIVE_DRAG_OPERATION.update((v) => {
        v!.from = srcZone;
        return v;
      });
    }

    drag = get(ACTIVE_DRAG_OPERATION)!;

    this.previewSize = { w: this.node.offsetWidth, h: this.node.offsetHeight };

    window.addEventListener("mousemove", this.handleMouseMove, { capture: true });
    window.addEventListener("mouseup", this.handleMouseUp, { capture: true, once: true });

    // #dispatch DragStart so client can set data e.item.data = ...
    // ERR: this could throw.. handle that succer
    const completed = this.node.dispatchEvent(
      new DragculaDragEvent("DragStart", {
        id: drag.id,
        status: drag.status,
        item: drag.item,
        from: drag.from || undefined,
        to: drag.to || undefined
      })
    );

    if (!completed) {
      // TODO: Abort all & start reset
      console.warn("Drag item onDragStart event cancelled!");
    }

    // TODO: Lift element
    //this.styleCache.cache(this.node!, 'position', 'relative');
    this.styles.cache(this.node!, "z-index", "2147483647");
    this.styles.cache(this.node!, "view-transition-name", `dragItem-${this.id}`);
    const transition = await HTMLDragItem.startTransition(() => {
      this.node.remove();
      this.styles.cacheMany(this.node, {
        "pointer-events": "none",
        position: "fixed",
        top: "0",
        left: "0",
        width: `${this.previewSize.w}px`,
        height: `${this.previewSize.h}px`,
        //"z-index": "2147483647",
        transform: this.previewTransform
      });
      this.node.setAttribute("data-dragcula-dragging", "true");
      document.body.appendChild(this.node);
    });
    transition.finished.then(() => {
      this.styles.apply(this.node, "view-transition-name");
    });
  }

  override onDrag(drag: DragOperation) {
    const overZone = findClosestDragZoneFromPoint(this.previewX, this.previewY);

    const newTargetId = overZone ? overZone.id : null;

    ACTIVE_DRAG_OPERATION.update((activeDrag) => {
      const oldTargetId = activeDrag!.to ? activeDrag!.to?.id : null;

      if (newTargetId !== oldTargetId) {
        if (oldTargetId) {
          DragZone.ZONES.get(oldTargetId)?.node?.dispatchEvent(
            new DragEvent("dragleave", {
              clientX: mousePos.x,
              clientY: mousePos.y
            })
          );

          activeDrag!.to = null;
          //await tick() // TODO: REMOVE?
        }

        if (newTargetId) {
          const accepted = !overZone?.node?.dispatchEvent(
            new DragEvent("dragenter", {
              clientX: mousePos.x,
              clientY: mousePos.y,
              cancelable: true
            })
          );

          activeDrag!.to = accepted ? overZone : null;
          //await tick() // TODO: REMOVE?
        }
      }

      if (activeDrag!.to !== null) {
        activeDrag!.to.node!.dispatchEvent(
          new DragEvent("dragover", {
            clientX: mousePos.x,
            clientY: mousePos.y
          })
        );
        this.isOverZone = true;
      } else {
        this.isOverZone = false;
      }

      if (activeDrag!.to === null) {
        document.body.removeAttribute("data-dragcula-overZone");
      } else {
        document.body.setAttribute("data-dragcula-overZone", activeDrag!.to.id);
      }

      return activeDrag;
    });

    // update visual position
    if (!this.raf) this.raf = requestAnimationFrame(this.boundRafCbk);
  }

  override onDragEnd(drag: DragOperation) {
    super.onDragEnd(drag);
    console.warn("onDragEnd", drag.status, drag);

    window.removeEventListener("mousemove", this.handleMouseMove, { capture: true });

    this.node.removeAttribute("data-dragcula-dragging");

    this.node.dispatchEvent(
      new DragculaDragEvent("DragEnd", {
        id: drag.id,
        status: drag.status,
        item: drag.item,
        from: drag.from || undefined,
        to: drag.to || undefined
      })
    );

    // Reset item
    // TODO: Check dragEffect & status
    if (drag.status === "aborted") {
      this.node.remove();
      this.styles.applyAll(this.node, ["view-transition-name"]);
      if (this.previewEffect === "hoist") {
        this.nodeParent?.insertBefore(this.node, this.nodeNext || null);
      } else {
        this.nodeParent?.appendChild(this.node);
      }
    } else {
      //this.node.remove();
      this.styles.applyAll(this.node);
    }

    // if vt running, after finish, apply vt-backup
  }
}
