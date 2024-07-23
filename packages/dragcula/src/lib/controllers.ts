import { get, writable, type Writable } from "svelte/store";
import type {
  DragItemActionAttributes,
  DragItemActionProps,
  DragOperation,
  DragZoneActionAttributes,
  DragZoneActionProps,
  IDragData,
  PreviewMode
} from "./types.js";
import { createStyleCache, findClosestDragZone, findClosestDragZoneFromEl } from "./utils.js";
import { tick } from "svelte";
import type { ActionReturn } from "svelte/action";
import { DragculaDragEvent } from "./events.js";

// TODO: Smooth fail transition -> https://developer.chrome.com/docs/web-platform/view-transitions/same-document#transitions_as_an_enhancement
// TODO: DragStart -> Store data transferred.
// TODO: ref stylePlaceholder / styleDragged prop function
// TODO: Abstract indexed zone? / events / actions
//
// TODO: remove -> on:Lift

const SUPPORTS_VIEW_TRANSITIONS = document.startViewTransition !== undefined; // TODO: test & check in startVT method

export const DRAG_ZONES = writable<Map<string, DragZone>>(new Map());
export const DRAG_ITEMS = writable<Map<string, DragItem>>(new Map());
export const ACTIVE_DRAG = writable<DragOperation | null>(null);

/// GLOBAL MOUSE LISTENER
let mousePos = { x: 0, y: 0 };
let GLOBAL_mouseMoveListener: ((e: MouseEvent) => void) | null = null;
if (!GLOBAL_mouseMoveListener) {
  GLOBAL_mouseMoveListener = (e: MouseEvent) => {
    mousePos = { x: e.clientX, y: e.clientY };
  };
  window.addEventListener("mousemove", GLOBAL_mouseMoveListener, { capture: true });
}

export class DragZone {
  readonly id: string = crypto.randomUUID();
  readonly node?: HTMLElement;

  /// === STATE

  //items?: Writable<unknown[]>;

  /// Whether target of current drag operation.
  readonly isTarget = writable(false);

  /// DOM element size which can be used by custom transitions.
  /// Set by initial element if present / after first one added.
  private _itemDomSize?: { w: number; h: number };
  get itemDomSize() {
    if (this._itemDomSize !== undefined) return this._itemDomSize;
    return (this._itemDomSize = this.getItemSize());
  }

  /// Cbk Refs
  //getItemId?: (item: DragItem) => string;

  /// === CUSTOM EVENT HANDLERS
  protected eventHandlers: {
    /// Additional event, called when an item is lifted (removed) from this zone.
    //'lift': ((drag: DragOperation) => void)[]
    dragenter: ((drag: DragOperation, e: MouseEvent) => void)[];
    dragover: ((drag: DragOperation, e: MouseEvent) => void)[];
    dragleave: ((drag: DragOperation, e: MouseEvent) => void)[];
    dragend: ((drag: DragOperation, e: MouseEvent) => void)[];
    drop: ((drag: DragOperation, e: MouseEvent) => void)[];
  } = {
    //'lift': [],
    dragenter: [],
    dragover: [],
    dragleave: [],
    dragend: [],
    drop: []
  };

  // TODO: Dont run handlers for default dnd when no active drag / handle default data transfer, no drag logic
  constructor(id?: string) {
    (this.id as string) = id ?? crypto.randomUUID();
  }

  /// === UTILS

  attach(node: HTMLElement) {
    if (get(DRAG_ZONES).has(this.id)) {
      throw new Error(`[Dragcula::Z-${this.id}] Zone with id ${this.id} already exists!`);
    }

    (this.node as Element) = node;
    this.node!.setAttribute("data-dragcula-zone", this.id);

    this.node!.addEventListener("dragenter", this.boundHandleDragEnter);
    this.node!.addEventListener("dragover", this.boundHandleDragOver);
    this.node!.addEventListener("dragleave", this.boundHandleDragLeave);
    this.node!.addEventListener("drop", this.boundHandleDrop);

    DRAG_ZONES.update((zones) => zones.set(this.id, this));
  }
  detach() {
    this.node?.removeEventListener("dragenter", this.boundHandleDragEnter);
    this.node?.removeEventListener("dragover", this.boundHandleDragOver);
    this.node?.removeEventListener("dragleave", this.boundHandleDragLeave);
    this.node?.removeEventListener("drop", this.boundHandleDrop);
    DRAG_ZONES.update((zones) => {
      zones.delete(this.id);
      return zones;
    });
  }

  on(
    event: keyof typeof this.eventHandlers,
    cbk: (typeof this.eventHandlers)[keyof typeof this.eventHandlers][0]
  ) {
    this.eventHandlers[event].push(cbk);
  }
  off(
    event: keyof typeof this.eventHandlers,
    cbk: (typeof this.eventHandlers)[keyof typeof this.eventHandlers][0]
  ) {
    const index = this.eventHandlers[event].indexOf(cbk);
    if (index !== -1) this.eventHandlers[event].splice(index, 1);
  }
  protected dispatch(
    event: keyof typeof this.eventHandlers,
    ...args: Parameters<(typeof this.eventHandlers)[keyof typeof this.eventHandlers][0]>
  ) {
    this.eventHandlers[event].forEach((cbk) => cbk(...args));
  }

  protected getItemSize() {
    if (!this.node) return undefined;

    // Find first child node recursive with data-dragcula-item attribute
    const findItem = (el: Element): Element | null => {
      if (el.dataset.dragculaItem) return el;
      for (const child of el.children) {
        const found = findItem(child);
        if (found) return found;
      }
      return null;
    };

    const item = findItem(this.node);

    if (item === null) return undefined;
    const { width: w, height: h } = item.getBoundingClientRect();
    return { w, h };
  }

  /// Whether to accept a given drag operation or ignore it.
  protected acceptDrag(drag: DragOperation): boolean {
    return true;
  }

  /// === DOM EVENTS

  protected boundHandleDragEnter = this.handleDragEnter.bind(this);
  handleDragEnter(e: DragEvent) {
    console.debug(`[Dragcula::Z-${this.id}] DragEnter`, e);
    this.onDragEnter(get(ACTIVE_DRAG)!, e);
  }

  protected boundHandleDragOver = this.handleDragOver.bind(this);
  handleDragOver(e: DragEvent) {
    //console.debug(`[Dragcula::Z-${this.id}] DragOver`, e);
    e.preventDefault();
    this.onDragOver(get(ACTIVE_DRAG)!, e);
  }

  protected boundHandleDragLeave = this.handleDragLeave.bind(this);
  handleDragLeave(e: DragEvent) {
    console.debug(`[Dragcula::Z-${this.id}] DragLeave`, e);
    this.onDragLeave(get(ACTIVE_DRAG)!, e);
  }

  protected boundHandleDrop = this.handleDrop.bind(this);
  handleDrop(e: DragEvent) {
    console.debug(`[Dragcula::Z-${this.id}] DragDrop`, e);
    // Only continue for dragcula operations.
    // This still allows for native drag & drop to work.
    // TODO: Actually, not.. need to fix this sometime!
    if (get(ACTIVE_DRAG) === null) return;
    e.preventDefault();
    e.stopPropagation();
    this.onDrop(get(ACTIVE_DRAG)!, e);
  }

  /// === EVENTS

  /**
   * Called when an item is lifted from this zone
   * (when item is dropped [move] onto other zone).
   * Use it to remove the item from the zone!
   */
  /*onLift(drag: DragOperation) {
		this.dispatch("lift", drag);
	}*/
  onDragEnter(drag: DragOperation, e: DragEvent) {
    if (!this.acceptDrag(drag)) return;
    console.debug(`[Dragcula::Z-${this.id}] DragEnter`, drag);
    this.isTarget.set(true);
    this.node!.dataset.dragculaTarget = "true";
    this.dispatch("dragenter", drag, e);
    drag.item.onDragEnter(drag); // TODO: EVENT CALL
  }
  onDragOver(drag: DragOperation, e: DragEvent) {
    //console.debug(`[Dragcula::Z-${this.id}] DragOver`, drag);
    this.dispatch("dragover", drag, e);
  }
  onDragLeave(drag: DragOperation, e: DragEvent) {
    console.debug(`[Dragcula::Z-${this.id}] DragLeave`, drag);
    this.isTarget.set(false);
    delete this.node!.dataset.dragculaTarget;
    this.dispatch("dragleave", drag, e);
    drag.item.onDragLeave(drag); // TODO: EVENT CALL
  }

  /**
   * Mirrors the drag item dragend event.
   * Use this to remove the item of the DragOperation from this zone.
   */
  onDragEnd(drag: DragOperation, e: MouseEvent) {
    console.debug(`[Dragcula::Z-${this.id}] DragEnd`, drag);
    this.dispatch("dragend", drag, e);

    this.node!.dispatchEvent(new DragculaDragEvent("DragEnd", e, drag, drag.data));
  }

  onDrop(drag: DragOperation, e: DragEvent) {
    console.debug(`[Dragcula::Z-${this.id}] DragDrop`, drag);
    this.isTarget.set(false);
    delete this.node!.dataset.dragculaTarget;

    // TODO: COPY?
    //drag.srcZone.items.update((items) => items.filter((id) => id !== drag.item.id));
    //this.items.update((items) => [...items, drag.item.id]);

    this.dispatch("drop", drag, e);
  }

  /// === ACTION

  static action<P extends DragZoneActionProps, A extends DragZoneActionAttributes>(
    node: HTMLElement,
    props: P
  ): ActionReturn<P, A> {
    const controller = props.controller || new this(props.id);
    controller.attach(node);

    controller.on("drop", (drag: DragOperation, e: MouseEvent) => {
      node.dispatchEvent(new DragculaDragEvent("Drop", e, drag, drag.data));
    });
    controller.on("dragenter", (drag: DragOperation, e: MouseEvent) => {
      node.dispatchEvent(new DragculaDragEvent("DragEnter", e, drag, drag.data));
    });
    controller.on("dragover", (drag: DragOperation, e: MouseEvent) => {
      node.dispatchEvent(new DragculaDragEvent("DragOver", e, drag, drag.data));
    });
    controller.on("dragleave", (drag: DragOperation, e: MouseEvent) => {
      node.dispatchEvent(new DragculaDragEvent("DragLeave", e, drag, drag.data));
    });

    if (props.removeItem) controller.removeItem = props.removeItem;
    //node.style.setProperty("view-transition-name", `dragZone-${controller.id}`);

    return {
      update(props: any) {
        console.log("updated drag zone", props);
      },

      destroy() {
        controller.detach();
      }
    };
  }
}

export class DragItem {
  readonly id: string = crypto.randomUUID();
  readonly node?: HTMLElement;
  readonly nodeParent?: HTMLElement;
  readonly nodeNext?: HTMLElement | null; // Used for .insertBefore when hoisting
  previewMode: PreviewMode = "hoist";

  data: IDragData;
  get dataTransfer(): DataTransfer {
    const t = new DataTransfer();
    t.setData("dragcula/item", `${this.id}`); // Mark as on of ours in case we need it somewhere
    // TODO: Fails on objects, we need some serialization / warning here!
    for (const [key, value] of Object.entries(this.data)) {
      t.setData(key, value);
    }
    return t;
  }

  /// === STATE

  private _inTransition = false;
  private _activeTransition: {
    finished: Promise<void>;
    updateCallbackDone: Promise<void>;
    ready: Promise<void>;
  } | null = null;
  get inTransition() {
    return this._inTransition;
  }
  set inTransition(val: boolean) {
    this._inTransition = val;
    if (!val) {
      this.doTargetZoneCheck();
    }
  }

  isDragging = writable(false);
  isOverZone = writable(false);

  raf: number | null = null;
  styleCache = createStyleCache();
  private viewTransitionNameBackup?: string; // TODO: External from style cache currently, as we need to apply cached styles before reverting name... Temporary!

  /// Ref to node clone if using previewMode "clone"
  nodeClone?: HTMLElement;

  /// === CUSTOM EVENT HANDLERS
  protected eventHandlers: {
    dragstart: ((drag: DragOperation) => void)[];
    dragenter: ((drag: DragOperation) => void)[];
    drag: ((drag: DragOperation) => void)[];
    dragleave: ((drag: DragOperation) => void)[];
    dragend: ((drag: DragOperation) => void)[];
  } = {
    dragstart: [],
    dragenter: [],
    drag: [],
    dragleave: [],
    dragend: []
  };

  // TODO: IF end when st<rt transtion, if flicks back, can we fix this? / general to fast
  constructor(data: IDragData, id?: string) {
    (this.id as string) = id ?? crypto.randomUUID();
    this.data = data;
  }

  attach(node: HTMLElement) {
    if (get(DRAG_ITEMS).has(this.id)) {
      //	throw new Error(`[Dragcula::I-${this.id}] Item with id ${this.id} already exists!`);
    }
    (this.node as Element) = node;
    (this.nodeParent as Element) = node.parentElement as HTMLElement;

    this.previewMode =
      (node.attributes.getNamedItem("dragPreview")?.value as PreviewMode) ?? "hoist";

    this.node!.setAttribute("data-dragcula-item", this.id);

    this.node!.addEventListener("dragstart", this.boundHandleDragStart);
    this.node!.addEventListener("drag", this.boundHandleDrag);
    this.node!.addEventListener("dragend", this.boundHandleDragEnd);

    DRAG_ITEMS.update((items) => items.set(this.id, this));
  }
  detach() {
    this.node?.removeEventListener("dragstart", this.boundHandleDragStart);
    this.node?.removeEventListener("drag", this.boundHandleDrag);
    this.node?.removeEventListener("dragend", this.boundHandleDragEnd);

    DRAG_ITEMS.update((items) => {
      items.delete(this.id);
      return items;
    });
  }

  on(
    event: keyof typeof this.eventHandlers,
    cbk: (typeof this.eventHandlers)[keyof typeof this.eventHandlers][0]
  ) {
    this.eventHandlers[event].push(cbk);
  }
  off(
    event: keyof typeof this.eventHandlers,
    cbk: (typeof this.eventHandlers)[keyof typeof this.eventHandlers][0]
  ) {
    const index = this.eventHandlers[event].indexOf(cbk);
    if (index !== -1) this.eventHandlers[event].splice(index, 1);
  }
  protected dispatch(
    event: keyof typeof this.eventHandlers,
    ...args: Parameters<(typeof this.eventHandlers)[keyof typeof this.eventHandlers][0]>
  ) {
    this.eventHandlers[event].forEach((cbk) => cbk(...args));
  }

  /**
   * If no overZone specified, try to find by using current mouse position.
   * Else: Handle for enter / exit & state changes.
   */
  async doTargetZoneCheck(overZone?: DragZone) {
    if (get(ACTIVE_DRAG) === null) return;
    if (overZone === undefined) {
      overZone = findClosestDragZone(mousePos.x, mousePos.y);
    }
    const newTargetId = overZone ? overZone.id : null;
    const currentTargetId = get(ACTIVE_DRAG)!.to?.id ?? null;

    if (newTargetId !== currentTargetId) {
      if (currentTargetId) {
        get(DRAG_ZONES).get(currentTargetId)!.node!.dispatchEvent(new DragEvent("dragleave", {}));
        await tick();
      }

      ACTIVE_DRAG.update((drag) => {
        drag!.to = overZone;
        return drag;
      });

      if (newTargetId) {
        overZone.node!.dispatchEvent(new DragEvent("dragenter", {}));
        await tick();
      }
    }
    if (overZone) {
      overZone.node!.dispatchEvent(
        new DragEvent("dragover", {
          clientX: mousePos.x,
          clientY: mousePos.y
        })
      );
      this.isOverZone.set(true);
    } else {
      this.isOverZone.set(false);
    }
  }

  protected boundRafCbk = this.rafCbk.bind(this);
  protected async rafCbk(_: number) {
    const elWidth = this.node!.offsetWidth;
    const elHeight = this.node!.offsetHeight;
    const overZone = findClosestDragZone(mousePos.x, mousePos.y);

    this.node!.style.transform = `translate(${mousePos.x - elWidth / 2}px, ${mousePos.y - elHeight / 2}px)`;

    if (!this.inTransition) {
      await this.doTargetZoneCheck(overZone);
    }
    this.raf = null;
  }

  /// === UTILS

  /// Custom wrapper so we can retain fluent drag & prevent weird
  /// event triggers from searching for target zones during the
  /// view transition.
  /// @arg skipTargetZoneCheck - Used on mouseUp, to prevent onDragOver dispatch after drop ended
  async startViewTransition(cbk: () => void, skipTargetZoneCheck = false) {
    // TODO: What to do if in transition already?
    if (this._activeTransition !== null) {
      await this._activeTransition.finished;
    }
    this.inTransition = true;
    // TODO: Maybe not if we want to support old browsers.. add "polyfill" here!
    // @ts-ignore - This does exist!
    const transition = document.startViewTransition(cbk);
    this._activeTransition = transition;
    transition.finished.then(() => {
      this._activeTransition = null;
      if (skipTargetZoneCheck) this._inTransition = false;
      else this.inTransition = false;
    });
    return transition;
  }

  /// === IDK WHAT TO CALL THIS

  applyPlaceholderStyle(node: HTMLElement) {
    node.style.setProperty("opacity", "60%");
  }
  applyDragStyle(node: HTMLElement) {
    this.styleCache.cache(node, "opacity", "90%");
    this.styleCache.cache(node, "box-shadow", "0 0 18px 0 rgba(40,40,40,0.18)");
    node.dataset.dragculaDragging = "true";
  }

  /// === DOM EVENTS

  handleMouseDown = this._handleMouseDown.bind(this); // Weird naming to make it easy for outside users
  private _handleMouseDown(e: MouseEvent) {
    // TODO: We dont need the drag simulated as drabbale starts this already by browser
    const isDraggable = this.node!.getAttribute("draggable");
    if (isDraggable === "false" || isDraggable === null) return;

    this.node!.addEventListener(
      "mousemove",
      (e) => {
        //window.addEventListener("mouseup", this.boundHandleMouseUp, { once: true });
        this.node!.dispatchEvent(
          new DragEvent("dragstart", {
            ...e,
            clientX: e.clientX,
            clientY: e.clientY
          })
        );
      },
      { once: true }
    );
  }

  protected boundHandleMouseMove = this.handleMouseMove.bind(this);
  private handleMouseMove(e: MouseEvent) {
    if (this.raf === null) this.raf = requestAnimationFrame(this.boundRafCbk);

    this.node!.dispatchEvent(
      new DragEvent("drag", {
        ...e,
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY
      })
    );
  }

  protected boundHandleDragStart = this.handleDragStart.bind(this);
  async handleDragStart(e: DragEvent) {
    const isDraggable = this.node!.getAttribute("draggable");
    if (isDraggable === "false" || isDraggable === null) return; // TODO: Do we need to prevent default?

    console.debug(`[Dragcula::I-${this.id}] DragStart`, e);
    e.preventDefault();

    window.addEventListener("mouseup", this.boundHandleMouseUp, { once: true });

    if (get(ACTIVE_DRAG)) {
      console.warn("Another drag operation is already active, ignoring this one.");
      return;
    }

    const srcZone = findClosestDragZoneFromEl(this.node!);
    if (!srcZone) {
      console.warn("No parent source zone found, ignoring drag operation.");
      return;
    }

    (this.nodeNext as Element) = this.node!.nextSibling;

    ACTIVE_DRAG.set({
      id: crypto.randomUUID(),
      from: srcZone,
      to: null, //srcZone,
      item: this,
      data: this.data,
      effect: "move"
    });
    this.isDragging.set(true);

    const w = this.node!.offsetWidth;
    const h = this.node!.offsetHeight;

    // TODO: Cache view transition name? Also fix this for the code inside the action
    // User should be able to retain custom view transition names if used!

    if (this.node!.style.getPropertyValue("view-transition-name") !== "") {
      this.viewTransitionNameBackup = this.node!.style.getPropertyValue("view-transition-name");
    }
    this.node!.style.setProperty("view-transition-name", `dragItem-${get(ACTIVE_DRAG)!.id}`);
    this.styleCache.cache(this.node!, "z-index", "2147483647");
    const transition = await this.startViewTransition(async () => {
      if (this.previewMode === "hoist") {
        this.node!.remove();
        document.body.appendChild(this.node!);
      } else if (this.previewMode === "clone") {
        this.nodeClone! = this.node!.cloneNode(true);
        this.nodeClone!.style.setProperty("view-transition-name", `drag-clone-${this.id}`);
        this.applyPlaceholderStyle(this.nodeClone as HTMLElement);
        this.node!.replaceWith(this.nodeClone!);
        document.body.appendChild(this.node!);
      }

      this.styleCache.cacheMany(this.node!, {
        position: "fixed",
        top: "0",
        left: "0",
        "pointer-events": "none",
        width: `${w}px`,
        height: `${h}px`,
        transform: `translate(${mousePos.x - w / 2}px, ${mousePos.y - h / 2}px)`
        //['transition', 'all 0.21s cubic-bezier(0.77,0,0.175,1), transform 0s'],
      });

      this.applyDragStyle(this.node!);

      this.dispatch("dragstart", get(ACTIVE_DRAG)!);
      await tick();
    });
    await transition.updateCallbackDone;
    transition.finished.then(() => this.node!.style.removeProperty("view-transition-name"));

    window.addEventListener("mousemove", this.boundHandleMouseMove);
    this.raf = requestAnimationFrame(this.boundRafCbk);
    this.onDragStart(get(ACTIVE_DRAG)!);
  }

  protected boundHandleDrag = this.handleDrag.bind(this);
  handleDrag(e: DragEvent) {
    //console.debug(`[Dragcula::I-${this.id}] Drag`, e);
    this.dispatch("drag", get(ACTIVE_DRAG)!);
  }

  protected boundHandleDragEnd = this.handleDragEnd.bind(this);
  handleDragEnd(e: DragEvent) {
    console.debug(`[Dragcula::I-${this.id}] DragEnd`, e);
    this.onDragEnd(get(ACTIVE_DRAG)!);
    this.dispatch("dragend", get(ACTIVE_DRAG)!);
  }

  protected boundHandleMouseUp = this.handleMouseUp.bind(this);
  async handleMouseUp(e: MouseEvent) {
    if (get(ACTIVE_DRAG) === null) return;
    window.removeEventListener("mousemove", this.boundHandleMouseMove);
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.isDragging.set(false);

    delete document.body.dataset.dragculaDragging;

    if (this._activeTransition !== null) {
      await this._activeTransition.finished;
    }
    this.node!.style.setProperty("view-transition-name", `dragItem-${get(ACTIVE_DRAG)!.id}`);

    const transition = await this.startViewTransition(async () => {
      this.styleCache.applyAll(this.node!);
      //applyCachedStyles(this.node!);

      if (this.previewMode === "clone") {
        this.nodeClone!.remove();
        this.nodeClone = undefined;
      }

      const drag = get(ACTIVE_DRAG)!;

      if (drag.to === null) {
        // TODO: this is only hoist, not clone
        this.node!.remove();
        console.warn("aborting, next, parent", this.nodeNext, this.nodeParent);
        if (this.nodeNext !== null) {
          this.nodeParent!.insertBefore(this.node!, this.nodeNext!);
        } else {
          this.nodeParent!.appendChild(this.node!);
        }
      } else if (drag.to !== null) {
        // TODO: If items linked auto remove, else this else error
        if (drag.from !== null) drag.from.onDragEnd(drag, e);
        await tick(); // TODO: Check if needed to ensure item is removed?

        this.node!.remove();
        drag.to.node!.dispatchEvent(
          new DragEvent("drop", {
            dataTransfer: this.dataTransfer
          })
        );
        await tick();
      }

      this.node!.dispatchEvent(new DragEvent("dragend", {}));
      await tick();
    }, true);
    transition.finished.then(() => this.node!.style.removeProperty("view-transition-name"));
    await transition.finished;

    // Remove automagical view transition name
    // TODO: Reset to original value?
    const el = document.querySelector(`[view-transition-name="dragItem-${get(ACTIVE_DRAG)!.id}"]`);
    if (el) {
      (el as HTMLElement).style.removeProperty("view-transition-name");
      if (el.hasAttribute("view-transition-name-backup")) {
        el.style.setProperty(
          "view-transition-name",
          el.getAttribute("view-transition-name-backup")!
        );
        el.removeAttribute("view-transition-name-backup");
      }
    }

    // Reset to original view transition name
    if (this.viewTransitionNameBackup !== undefined) {
      this.node!.style.setProperty("view-transition-name", this.viewTransitionNameBackup);
      this.viewTransitionNameBackup = undefined;
    }

    ACTIVE_DRAG.set(null);
  }

  /// === EVENTS

  onDragStart(drag: DragOperation) {
    document.body.dataset.dragculaDragging = "true";
  }
  onDrag(drag: DragOperation) {}
  onDragEnter(drag: DragOperation) {
    this.isOverZone.set(true);
    this.node!.dataset.dragculaCanDrop = "true";

    // TODO: Remove this this should be custom behavior!
    if (drag.to?.itemDomSize !== undefined) {
      return;
      const transition = this.startViewTransition(async () => {
        this.node!.style.width = `${drag.to?.itemDomSize.w}px`;
        this.node!.style.height = `${drag.to?.itemDomSize.h}px`;
      });
    }
    this.dispatch("dragenter", drag);
  }
  onDragLeave(drag: DragOperation) {
    this.isOverZone.set(false);
    delete this.node!.dataset.dragculaCanDrop;
    this.dispatch("dragleave", drag);
  }
  onDragEnd(drag: DragOperation) {
    delete this.node!.dataset.dragculaCanDrop;
    delete this.node!.dataset.dragculaDragging;
    this.dispatch("dragend", drag);
  }

  /// === API

  /*startDrag() {
		// TODO: Use logic from mousedown handler -> use current known mousePos
		window.addEventListener("mouseup", this.boundHandleMouseUp, { once: true });

		// NOTE: We dont dispatch the dragstart event here, as we want to have access to the 
		// mouse event and only start it after a few pixels of movement.
	}*/

  /// === ACTION

  static action<Props extends DragItemActionProps, Attributes extends DragItemActionAttributes>(
    node: HTMLElement,
    props: Props
  ): ActionReturn<Props, Attributes> {
    const controller = props.controller || new this(props.data, props.id);
    controller.attach(node);

    if (get(ACTIVE_DRAG) !== null) {
      const drag = get(ACTIVE_DRAG)!;

      // NOTE: We automatically attach the view transition name to the node
      // to enable automagical view transitions from the dragged one to
      // the newly created one.
      if (drag.item.id === controller.id) {
        if (node.style.getPropertyValue("view-transition-name") !== undefined)
          node.setAttribute(
            "view-transition-name-backup",
            node.style.getPropertyValue("view-transition-name")
          );
        node.style.setProperty("view-transition-name", `dragItem-${drag.id}`);
      }
    }

    /*const simulateDragStart = node.getAttribute("simulatedragstart");
		if (simulateDragStart === null || simulateDragStart === "true") {
			node.addEventListener("mousedown", controller.handleMouseDown);
		}*/

    controller.on("drag", (e: DragOperation) => {
      node.dispatchEvent(new CustomEvent("Drag", { detail: e }));
    });
    controller.on("dragenter", (e: DragOperation) => {
      node.dispatchEvent(new CustomEvent("DragEnter", { detail: e }));
    });
    controller.on("dragleave", (e: DragOperation) => {
      node.dispatchEvent(new CustomEvent("DragLeave", { detail: e }));
    });
    controller.on("dragend", (e: DragOperation) => {
      node.dispatchEvent(new CustomEvent("DragEnd", { detail: e }));
    });

    if (props.onInit) props.onInit(controller);

    return {
      update(props: Props) {
        console.log("updated draggable item", props);
      },

      destroy() {
        node.removeEventListener("mousedown", controller.handleMouseDown);
        controller.detach();
      }
    };
  }
}
