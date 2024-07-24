import type { ActionReturn } from "svelte/action";
import {
  ACTIVE_DRAG,
  createDragData,
  createStyleCache,
  DRAG_ZONES,
  DragculaCustomDragEvent,
  DragculaNativeDragEvent,
  DragZone,
  findClosestDragZoneFromEl,
  findClosestDragZoneFromPoint,
  mousePos,
  type DragOperation,
  type ItemPreviewMode,
  type RawDragData
} from "./index.js";
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

  "on:DragStart"?: (e: DragculaDragEvent) => void;
  "on:Drag"?: (e: DragculaDragEvent) => void;
  "on:DragEnter"?: (e: DragculaDragEvent) => void;
  "on:DragLeave"?: (e: DragculaDragEvent) => void;
  "on:DragEnd"?: (e: DragculaDragEvent) => void;
}

export const DRAG_ITEMS = new Map<string, DragItem>();

export class DragItem {
  readonly id: string;
  readonly node?: HTMLElement;

  /// Element after self, used for .insertBefore when resetting during hoisting.
  readonly nodeNext?: HTMLElement;
  readonly nodeParent?: HTMLElement;

  /// Cloned node if using preview mode "clone".
  protected nodeClone?: HTMLElement;

  protected previewMode: ItemPreviewMode = "hoist";

  /// === STATE
  // isDragging = writable(false);
  // isOverZone = writable(false);
  protected draggable = false;

  private _isDragging = false;
  set isDragging(v: boolean) {
    this._isDragging = v;
    if (v) {
      this.node && (this.node.dataset.dragculaDragging = "true");
    } else {
      this.node && delete this.node.dataset.dragculaDragging;
    }
  }
  set isOverZone(v: boolean) {
    if (v) {
      this.node && (this.node.dataset.dragculaOverZone = "true");
    } else {
      this.node && delete this.node.dataset.dragculaOverZone;
    }
  }

  /// Default drag data passed to DragOperation, if not overriden.
  data: RawDragData;

  protected _activeTransition: ViewTransition | null = null;
  set activeTransition(v: ViewTransition | null) {
    // TODO: SKIP TARGET ZONE EHCEK
    this._activeTransition = v;
    if (v === null) {
      if (/*this.raf !== null ||*/ get(ACTIVE_DRAG) !== null) this.doTargetZoneCheck();
    }
  }
  get inTransition() {
    return this._activeTransition || false;
  }

  protected raf: number | null = null;
  protected styleCache = createStyleCache();

  /// === CONSTRUCTOR

  constructor(data: RawDragData, id?: string) {
    this.id = id || crypto.randomUUID();
    this.data = data;
  }

  attach(node: HTMLElement, reAttach = false) {
    (this.node as HTMLElement) = node;
    (this.nodeParent as HTMLElement) = node.parentElement!;

    this.node!.setAttribute("data-dragcula-item", this.id);

    if (reAttach) {
      console.debug(`[Dragcula::I-${this.id}] Re-attaching controller to node`, this, node);
      this.styleCache.cache(this.node!, "view-transition-name", `dragItem-${this.id}`);
      //this.styleCache.dump("In Reattache");
    }

    // Attribute cfg
    this.draggable = node.getAttribute("draggable") === "true";
    this.previewMode = (node.getAttribute("dragpreview") as ItemPreviewMode) || "hoist";

    // Event listeners
    this.node!.addEventListener("dragstart", this.boundHandleDragStart);
    this.node!.addEventListener("drag", this.boundHandleDrag);
    this.node!.addEventListener("dragend", this.boundHandleDragEnd);

    DRAG_ITEMS.set(this.id, this);
  }

  detach() {
    if (get(ACTIVE_DRAG) === null) DRAG_ITEMS.delete(this.id);
    else
      console.debug(
        `[Dragcula::I-${this.id}] Detaching controller, but active drag is still present!`,
        get(ACTIVE_DRAG)
      );

    this.node!.removeAttribute("data-dragcula-item");
    this.node!.removeEventListener("dragstart", this.boundHandleDragStart);
    this.node!.removeEventListener("drag", this.boundHandleDrag);
    this.node!.removeEventListener("dragend", this.boundHandleDragEnd);
  }

  /// === UTILS

  protected async doTargetZoneCheck(overZone?: DragZone) {
    //console.trace("DoTarget check", get(ACTIVE_DRAG))
    if (get(ACTIVE_DRAG) === null) return;
    if (overZone === undefined)
      overZone = findClosestDragZoneFromPoint(mousePos.x, mousePos.y) || undefined;

    // Check if target accepts
    if (overZone) {
      const event =
        get(ACTIVE_DRAG)!.data instanceof DataTransfer
          ? new DragculaNativeDragEvent("DragOver", {}, get(ACTIVE_DRAG)!)
          : new DragculaCustomDragEvent("DragOver", {}, get(ACTIVE_DRAG)!);
      if (!overZone.acceptDrag(event)) overZone = undefined;
    }

    const newTargetId = overZone ? overZone.id : null;
    const oldTargetId = get(ACTIVE_DRAG)!.to ? get(ACTIVE_DRAG)!.to?.id : null;

    if (newTargetId !== oldTargetId) {
      if (oldTargetId) {
        DRAG_ZONES.get(oldTargetId)?.node?.dispatchEvent(
          new DragEvent("dragleave", {
            clientX: mousePos.x,
            clientY: mousePos.y
          })
        );
        //await tick() // TODO: REMOVE?
      }

      ACTIVE_DRAG.update((v) => {
        v!.to = overZone || null;
        return v;
      });

      if (newTargetId) {
        overZone?.node?.dispatchEvent(
          new DragEvent("dragenter", {
            clientX: mousePos.x,
            clientY: mousePos.y
          })
        );
        //await tick() // TODO: REMOVE?
      }
    }

    if (overZone) {
      overZone.node?.dispatchEvent(
        new DragEvent("dragover", {
          clientX: mousePos.x,
          clientY: mousePos.y
        })
      );
      this.isOverZone = true;
    } else {
      this.isOverZone = false;
    }
  }

  protected async rafCbk(_: number) {
    const elWidth = this.node!.offsetWidth;
    const elHeight = this.node!.offsetHeight;
    const overZone = findClosestDragZoneFromPoint(mousePos.x, mousePos.y);

    this.node!.style.transform = `translate(${mousePos.x - elWidth / 2}px, ${mousePos.y - elHeight / 2}px)`;

    if (!this.inTransition) {
      await this.doTargetZoneCheck(overZone || undefined);
    }
    this.raf = null;
  }
  protected boundRafCbk = this.rafCbk.bind(this);

  public async startViewTransition(cbk: () => void) {
    if (this.inTransition) {
      this._activeTransition?.skipTransition(); // TODO: Might be practical?
      //await this._activeTransition!.finished;
    }
    this._activeTransition = document.startViewTransition(cbk);

    this._activeTransition!.finished.then(() =>
      setTimeout(() => {
        this._activeTransition = null;
      })
    );

    return this._activeTransition;
  }

  /// === DOM EVENTS

  protected handleMouseMove(e: MouseEvent) {
    if (this.raf === null) this.raf = requestAnimationFrame(this.boundRafCbk);
    this.node?.dispatchEvent(
      new DragEvent("drag", {
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY
      })
    );
  }
  protected boundHandleMouseMove = this.handleMouseMove.bind(this);

  protected async handleMouseUp(e: MouseEvent) {
    if (get(ACTIVE_DRAG) === null) return;
    window.removeEventListener("mousemove", this.boundHandleMouseMove, { capture: true });
    if (this.raf !== null) cancelAnimationFrame(this.raf);

    if (this.inTransition) {
      this._activeTransition!.skipTransition();
      await this._activeTransition!.finished;
    }

    this.styleCache.cache(this.node!, "view-transition-name", `dragItem-${this.id}`);

    const drag = get(ACTIVE_DRAG)!;

    const transition = await this.startViewTransition(async () => {
      this.styleCache.applyAll(this.node!, ["view-transition-name"]);

      if (this.previewMode === "clone") {
        this.nodeClone!.remove();
        this.nodeClone = undefined;
      }

      if (drag.to === null) {
        // We "abort" the drag and reset the elements
        if (this.previewMode === "hoist") {
          this.node!.remove();
          // TODO: Handle missing parent?
          if (this.nodeNext !== null) this.nodeParent!.insertBefore(this.node!, this.nodeNext!);
          else this.nodeParent!.appendChild(this.node!);

          // TODO: Moved below for now, look into this!
          //this.node?.dispatchEvent(new DragEvent("dragend", {}));
          // NOTE: We dont reset the v.t.name here, as this has to be done
          // after the transition finished!
        }
      } else if (drag.to !== null) {
        // NOTE: Inside this event handler, the zone can
        // remove the element / do copy updates etc.
        // This will call the detache() method, but as there is an active drag op
        // this controller will remain
        if (drag.from !== null) drag.from.onDragEnd(drag, e);
        await tick(); // TODO: Is necessary to require item correctly removoved?

        this.node!.remove();
        this.styleCache.applyAll(this.node!);
        drag.to.node!.dispatchEvent(
          new DragEvent("drop", {
            dataTransfer: new DataTransfer()
          })
        );
        await tick();
        // NOTE: After this one, the new element should be created in the dom
        // and as this controller reamined, it is re-attached to the new DOM node!
      }

      // NOTE: This will target the new dom node.
      this.node?.dispatchEvent(new DragEvent("dragend", {}));
      await tick();
    });
    transition.finished.then(async () => {
      // NOTE: This will target the new dom node.
      this.styleCache.apply(this.node!, "view-transition-name");
      await tick();
      ACTIVE_DRAG.set(null);
    });
    await transition.finished;
  }
  protected boundHandleMouseUp = this.handleMouseUp.bind(this);

  protected async handleDragStart(e: DragEvent) {
    if (!this.draggable) return;
    e.preventDefault();

    console.debug(`[Dragcula::I-${this.id}] DragStart`, e);

    window.addEventListener("mouseup", this.boundHandleMouseUp, { once: true });

    const srcZone = findClosestDragZoneFromEl(this.node!);

    (this.nodeNext as HTMLElement) = this.node!.nextElementSibling as HTMLElement;

    ACTIVE_DRAG.set({
      id: crypto.randomUUID(),
      from: srcZone || null,
      to: null, // TODO: srcZone also?
      item: this,
      data: createDragData(this.data),
      effect: "move" // TODO: HANDLE OPS
    });
    //await tick();

    if (this.inTransition) {
      this._activeTransition!.skipTransition();
      await this._activeTransition!.finished;
    }

    this.isDragging = true;

    const elWidth = this.node!.offsetWidth;
    const elHeight = this.node!.offsetHeight;

    /*	this.styleCache.cacheMany(this.node!, {
				"position": "fixed",
				"top": "0",
				"left": "0",
			});*/
    this.styleCache.cache(this.node!, "position", "relative");
    //	this.styleCache.cache(this.node!, 'top', '0');
    //		this.styleCache.cache(this.node!, 'left', '0');
    this.styleCache.cache(this.node!, "z-index", "2147483647");
    this.styleCache.cache(this.node!, "view-transition-name", `dragItem-${this.id}`);

    const transition = await this.startViewTransition(async () => {
      if (this.previewMode === "hoist") {
        this.node!.remove();
        document.body.appendChild(this.node!);
      } else if (this.previewMode === "clone") {
        alert("NO IMPL clone");
        return;
        /*this.nodeClone! = this.node!.cloneNode(true);
				this.nodeClone!.style.setProperty("view-transition-name", `drag-clone-${this.id}`)
				this.applyPlaceholderStyle(this.nodeClone as HTMLElement);
				this.node!.replaceWith(this.nodeClone!);
				document.body.appendChild(this.node!);*/
      }

      this.styleCache.cacheMany(this.node!, {
        position: "fixed",
        top: "0",
        left: "0",
        "pointer-events": "none",
        width: `${elWidth}px`,
        height: `${elHeight}px`,
        transform: `translate(${mousePos.x - elWidth / 2}px, ${mousePos.y - elHeight / 2}px)`
        //['transition', 'all 0.21s cubic-bezier(0.77,0,0.175,1), transform 0s'],
      });

      //this.applyDragStyle(this.node!);

      document.body.setAttribute("data-dragcula-dragging", "true");
      await tick();
    });

    transition.finished.then(() => {
      this.styleCache.dump("after dragstarttransition");
      this.styleCache.apply(this.node!, "view-transition-name");
    });

    await transition.updateCallbackDone;

    window.addEventListener("mousemove", this.boundHandleMouseMove, { capture: true });
    this.raf = requestAnimationFrame(this.boundRafCbk);
    //this.doTargetZoneCheck(srcZone || undefined)

    this.onDragStart(get(ACTIVE_DRAG)!);
  }
  protected boundHandleDragStart = this.handleDragStart.bind(this);

  protected handleDrag(e: DragEvent) {}
  protected boundHandleDrag = this.handleDrag.bind(this);

  protected handleDragEnd(e: DragEvent) {
    console.debug(`[Dragcula::I-${this.id}] DragEnd`, e);
    this.isOverZone = false;
    this.isDragging = false;
    document.body.removeAttribute("data-dragcula-dragging");
    this.onDragEnd(get(ACTIVE_DRAG)!);
  }
  protected boundHandleDragEnd = this.handleDragEnd.bind(this);

  /// === EVENT HANDLERS

  protected onDragStart(drag: DragOperation) {}

  protected onDrag(drag: DragOperation) {}

  onDragEnter(drag: DragOperation) {
    this.isOverZone = true;
  }

  onDragLeave(drag: DragOperation) {
    this.isOverZone = false;
  }

  protected onDragEnd(drag: DragOperation) {}

  /// === ACTION

  static action<P extends DragItemActionProps, A extends DragItemActionProps>(
    node: HTMLElement,
    props: P
  ): ActionReturn<P, A> {
    let controller: DragItem;

    if (get(ACTIVE_DRAG) !== null && get(ACTIVE_DRAG)!.item?.id === props.id) {
      controller = DRAG_ITEMS.get(props.id)!;
      controller.attach(node, true); // NOTE: We re-attach!
    } else {
      controller = props.controller || new this(props.data, props.id);
      controller.attach(node);
    }
    controller.draggable = node.getAttribute("draggable") === "true";
    console.debug(`[Dragcula::I-${controller.id}] Attached controller to node`, controller, node);

    return {
      update(props: P) {
        console.trace(`[Dragcula::I-${controller.id}] Updated props`, props);
        controller.draggable = node.getAttribute("draggable") === "true";
      },
      destroy() {
        controller.detach();
      }
    };
  }
}
