import { tick } from "svelte";
import { get, writable, type Writable } from "svelte/store";
import { findClosestDragZone, findClosestDragZoneFromEl, parseDataTransfer } from "./utils.js";
import type { DragOperation, IDragData } from "./types.js";
import type { Action } from "svelte/action";

export const ZONES = writable<Map<string, DragZone<unknown>>>(new Map());
export const DRAGGABLES = writable<Map<string, DragElement<unknown>>>(new Map());
export const ACTIVE_DRAG = writable<DragOperation | null>(null);

/**
 * A generic drag zone which holds elements of type T.
 * By default, it only accepts elements of the same type,
 * this can be customized to transform other types into the required one.
 */
export class DragZone<T> {
  readonly id: string = crypto.randomUUID();
  domEl: HTMLElement | null = null;

  // Elements inside the zone.
  contents: Writable<Map<string, DragElement<T>>> = writable(new Map());

  // Whether the zone is currently the target of a drag operation.
  readonly isActiveTarget = writable(false);

  // TODO: Future -> Broadcast on dragstart so zones can be highlighted if needed.
  //canDrop = writable(false);

  protected eventHandlers: {
    dragenter: ((drop: DropOperation) => void)[];
    dragover: ((drop: DropOperation) => void)[];
    dragleave: ((drop: DropOperation) => void)[];
    drop: ((drop: DropOperation) => void)[];
  } = {
    dragenter: [],
    dragover: [],
    dragleave: [],
    drop: []
  };

  // Set by intial element if present / after first one added.
  itemSize: { w: number; h: number } | null = null;

  /// Settings
  //

  constructor(id: string) {
    //this.id = id;

    // Register the zone
    if (get(ZONES).has(id)) {
      throw new Error(`Zone with ID ${id} already exists.`);
    }
    // FIX: Do we need an else or sth here? Hw tf does js work.?
    ZONES.update((zones) => zones.set(id, this));
  }

  private attach(node: HTMLElement) {
    this.domEl = node;
    this.itemSize = this.getItemSize();

    // TODO: These all need to be removed on destroy!
    this.domEl.addEventListener("dragenter", this.handleDragEnter.bind(this));
    this.domEl.addEventListener("dragover", this.handleDragOver.bind(this));
    this.domEl.addEventListener("dragleave", this.handleDragLeave.bind(this));
    this.domEl.addEventListener("drop", this.handleDrop.bind(this));
  }

  protected acceptDrag(dataTransfer: DataTransfer): boolean {
    return true;
  }

  /// Calculate the size of an item in the zone.
  /// This is pretty barebones but should work for all types of
  /// lists / grids with uniform item sizes.
  protected getItemSize(): { w: number; h: number } {
    const { width: w, height: h } = this.domEl.children[0].getBoundingClientRect();
    return { w, h };
  }

  protected dispatchHandlers(
    eventName: keyof typeof this.eventHandlers,
    ...args: Parameters<(typeof this.eventHandlers)[keyof typeof this.eventHandlers][0]>
  ) {
    this.eventHandlers[eventName].forEach((cbk) => cbk(...args));
  }

  /// === DOM EVENTS
  // Handles for DOM events.

  handleDragEnter(e: DragEvent) {
    console.debug(`[Dragcula::Z-${this.id}] DragEnter`, e);

    // Extract possible DragElement
    const dragElement = parseDataTransfer(e.dataTransfer);
    console.warn("DragElement", dragElement);

    this.onDragEnter(get(ACTIVE_DRAG));
  }
  handleDragOver(e: DragEvent) {
    //console.debug(`[Dragcula::Z-${this.id}] DragOver`, e);
    e.preventDefault();
    this.onDragOver(get(ACTIVE_DRAG));
  }
  handleDragLeave(e: DragEvent) {
    console.debug(`[Dragcula::Z-${this.id}] DragLeave`, e);
    this.onDragLeave(get(ACTIVE_DRAG));
  }
  handleDrop(e: DragEvent) {
    console.debug(`[Dragcula::Z-${this.id}] DragDrop`, e);
    e.preventDefault();

    const isDragcula = parseDataTransfer(e.dataTransfer) !== null;
    if (isDragcula) this.onDrop(get(ACTIVE_DRAG));
  }

  /// === EVENTS
  // Custom logic

  onDragEnter(drag: DragOperation<unknown>) {
    this.isActiveTarget.set(true);

    //const transition = document.startViewTransition(async () => {
    if (this.itemSize !== null) {
      drag.element.domEl.style.width = `${this.itemSize.w}px`;
      drag.element.domEl.style.height = `${this.itemSize.h}px`;
    }
    //	await tick();
    //});
    drag.element.onDragEnter(drag);
  }
  onDragOver(drag: DragOperation<unknown>) {}
  onDragLeave(drag: DragOperation<unknown>) {
    this.isActiveTarget.set(false);
    drag.element.onDragLeave(drag);
  }
  onDrop(drag: DragOperation<unknown>) {
    this.isActiveTarget.set(false);
    //if (this.acceptDrag(null)) return
    //e.preventDefault()

    // nono: THis is user defined!
    // todo: move
    // todo: copy, manual copy draggable
    //

    this.dispatchHandlers("drop", drag);
    // todo: calc item size update if first element after drop!
  }

  /// === API

  /// Add an event listener to the zone.
  on(
    eventName: keyof typeof this.eventHandlers,
    cbk: (typeof this.eventHandlers)[keyof typeof this.eventHandlers][0]
  ) {
    if (!this.eventHandlers[eventName].includes(cbk)) {
      this.eventHandlers[eventName].push(cbk);
    }
  }

  /// Remove an event listener from the zone.
  off(
    eventName: keyof typeof this.eventHandlers,
    cbk: (typeof this.eventHandlers)[keyof typeof this.eventHandlers][0]
  ) {
    const index = this.eventHandlers[eventName].indexOf(cbk);
    if (index !== -1) {
      this.eventHandlers[eventName].splice(index, 1);
    }
  }
}

/**
 * A draggable element of type T.
 */
export class DragElement<T extends IDragData> {
  readonly id: string = crypto.randomUUID(); // Unique id used for transitions etc.
  domEl: HTMLElement | null = null;

  data: T;
  dataType: string = "dragcula/dragelement"; // MIME type -> also usef for dataTransfer

  raf: number | null = null; // requestanimationframe handle
  mouse: { x: number; y: number } = { x: 0, y: 0 };

  styleCache: Map<string, string> = new Map();

  parentZone: DragZone<unknown>;
  //currentTargetZone: DragZone<unknown> | null = null;

  isDraggable = true;
  isDragging = writable(false);

  // Whether the element is currently over a zone which accepts the drag.
  isOverZone = writable(false);

  private _dataTransfer: DataTransfer | null = null;
  get dataTransfer(): DataTransfer {
    if (this._dataTransfer) return this._dataTransfer;
    this._dataTransfer = new DataTransfer();
    this._dataTransfer.setData(this.dataType, `${this.id}`);
    return this._dataTransfer;
  }

  constructor(id: string, data: T) {
    //this.domEl = el;
    //this.id = id;
    this.data = data;

    // Find parent Zone
    /*const zone = findClosestDragZoneFromEl(this.domEl);
		if (zone) {
			this.parentZone = zone;
			zone.contents.set(id, this);
		}
		else {
			console.warn(`No parent zone found for draggable element ${this.id}.`)
			throw new Error(`No parent zone found for draggable element ${this.id}.`);
		}*/
  }

  /// Attach a target DOM element -> This is required!
  attach(element: HTMLElement) {
    this.domEl = element;

    //document.addEventListener('mousemove', (e) => this.mouse = { x: e.clientX, y: e.clientY });

    // TODO: These all need to be removed on destroy!
    this.domEl.addEventListener("dragstart", this.handleDragStart.bind(this));
    this.domEl.addEventListener("drag", this.handleDrag.bind(this));
    this.domEl.addEventListener("dragend", this.handleDragEnd.bind(this));
    DRAGGABLES.update((draggables) => draggables.set(this.id, this));
  }

  /// Cleanup / remove event listeners
  deattach() {
    DRAGGABLES.update((draggables) => draggables.delete(this.id));
  }

  /// === DOM EVENTS
  // Handles for DOM events.
  //
  handleDragStart(e: DragEvent) {
    console.debug(`[Dragcula::E-${this.id}] DragStart`, e);
    e.preventDefault();
    this.onDragStart(e);
  }
  handleDrag(e: DragEvent) {
    //console.debug(`[Dragcula::E-${this.id}] Drag`, e);
    this.onDrag(e);
  }
  handleDragEnd(e: DragEvent) {
    console.debug(`[Dragcula::E-${this.id}] DragEnd`, e);
    document.removeEventListener("mousemove", this.boundMouseMove);
    console.warn(this);
    if (get(ACTIVE_DRAG).targetZone !== null) {
      get(ACTIVE_DRAG).targetZone.domEl.dispatchEvent(
        new DragEvent("drop", { dataTransfer: this.dataTransfer })
      );
    }

    this.onDragEnd(get(ACTIVE_DRAG));
  }
  private readonly boundMouseMove = this.handleMouseMove.bind(this);
  async handleMouseMove(e: MouseEvent) {
    this.mouse = { x: e.clientX, y: e.clientY };
    if (get(ACTIVE_DRAG) === null) {
      this.domEl.dispatchEvent(
        new DragEvent("dragstart", {
          ...e,
          dataTransfer: new DataTransfer(),
          clientX: e.clientX,
          clientY: e.clientY
        })
      );
    }
    this.domEl.dispatchEvent(
      new DragEvent("drag", {
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY
      })
    );
  }

  private readonly boundMouseUp = this.handleMouseUp.bind(this);
  handleMouseUp(e: MouseEvent) {
    document.removeEventListener("mousemove", this.boundMouseMove);
    document.removeEventListener("mouseup", this.boundMouseUp);
    this.domEl.dispatchEvent(new DragEvent("dragend"));
  }

  private readonly boundRafCbk = this.rafCbk.bind(this);
  end = false;
  protected rafCbk(time: number) {
    this.raf = requestAnimationFrame(this.boundRafCbk);
    const elWidth = this.domEl.offsetWidth;
    const elHeight = this.domEl.offsetHeight;
    const targetZone = findClosestDragZone(this.mouse.x, this.mouse.y);

    this.domEl.style.transform = `translate(${this.mouse.x - elWidth / 2}px, ${this.mouse.y - elHeight / 2}px)`;

    const newTargetId = targetZone?.id ?? null;
    const currentTargetId = get(ACTIVE_DRAG).targetZone?.id ?? null;
    // FIX: LEave is called once too many over src zone when dragstarted
    if (newTargetId !== currentTargetId) {
      if (currentTargetId !== null) {
        get(ACTIVE_DRAG).targetZone.domEl.dispatchEvent(
          new DragEvent("dragleave", { dataTransfer: this.dataTransfer })
        );
      }
      if (newTargetId !== null) {
        targetZone.domEl.dispatchEvent(
          new DragEvent("dragenter", { dataTransfer: this.dataTransfer })
        );
      }
      ACTIVE_DRAG.update((drag) => {
        drag.targetZone = targetZone;
        return drag;
      });
    }
    if (targetZone !== null) {
      targetZone.domEl.dispatchEvent(
        new DragEvent("dragover", { dataTransfer: this.dataTransfer })
      );
      this.isOverZone.set(true);
    } else {
      this.isOverZone.set(false);
    }
  }

  /// === EVENTS

  async onDragStart(e: DragEvent) {
    // Default behaviour:
    // Elevate domItem to float above all other elements.
    // TODO: Temporarily disable all 'isolation: isolate' css rules if any on parents.
    // TODO: Temporarily disable all 'contain' css rules if any on parents.

    if (get(ACTIVE_DRAG) !== null) {
      console.warn("[Dragcula] Another drag operation is already active. This shouldn't happen!");
    }

    // todo: Update active reference

    // Prevent selection
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    //const transition = document.startViewTransition(async () => {
    this.cacheStyles([
      ["position", "fixed"],
      ["top", "0"],
      ["left", "0"],
      ["z-index", "2147483647"],
      ["pointer-events", "none"],
      ["cursor", "grabbing"],
      ["box-shadow", "0 0 20px 0 rgba(0,0,0,0.1)"],
      ["border-radius", "15px"],
      ["width", `${this.domEl.offsetWidth}px`],
      ["height", `${this.domEl.offsetHeight}px`],
      [
        "transform",
        `translate(${e.clientX - this.domEl.offsetWidth / 2}px, ${e.clientY - this.domEl.offsetHeight / 2}px)`
      ]
      //['transition', ''],
    ]);
    this.isDragging.set(true);
    //		await tick();
    //	});
    //	await transition.finished;

    // TODO: somehow get datatransfer in here.. classic ondragStart and modify drag?
    const parentZone = findClosestDragZoneFromEl(this.domEl);
    ACTIVE_DRAG.set({
      srcZone: parentZone,
      targetZone: parentZone,
      element: this,
      effect: "move",
      dataTransfer: this.dataTransfer,
      preview: true,
      targetXPos: 0,
      targetYPos: 0
    });

    // NOTE: Here we finally attach the mousemove handler (without once).
    document.addEventListener("mousemove", this.boundMouseMove);

    this.raf = requestAnimationFrame(this.boundRafCbk);
  }
  onDrag(e: DragEvent) {
    if (get(ACTIVE_DRAG) === null) return;
    //if (this.raf !== null) cancelAnimationFrame(this.raf);
    //this.raf = requestAnimationFrame(this.boundRafCbk);

    /*if (targetZone) {
			if (get(ACTIVE_DRAG).targetZone === null || (get(ACTIVE_DRAG).targetZone.id !== targetZone.id)) {
			ACTIVE_DRAG.update(drag => ({ ...drag, targetZone: targetZone }));
			targetZone.domEl.dispatchEvent(new DragEvent("dragenter", { dataTransfer: this.dataTransfer }));
		}
		targetZone.domEl.dispatchEvent(new DragEvent("dragover", { dataTransfer: this.dataTransfer }));
				//this.isOverZone.set(true); // TODO: VIE TRANSITION
	}
		
	if((targetZone !== null && get(ACTIVE_DRAG).targetZone.id !== targetZone.id) || (targetZone !== get(ACTIVE_DRAG).targetZone)) {
	console.warn(":: leave", get(ACTIVE_DRAG).targetZone.id, targetZone);
	// Drag leave
	//if (get(ACTIVE_DRAG).targetZone !== null && get(ACTIVE_DRAG).targetZone.id !== targetZone?.id) {
	get(ACTIVE_DRAG).targetZone.domEl.dispatchEvent(new DragEvent("dragleave", { dataTransfer: this.dataTransfer }));
	ACTIVE_DRAG.update(drag => ({ ...drag, targetZone: null }));
	//this.currentTargetZone = null;
	//		this.isOverZone.set(false); // TODO: VIE TRANSITION
	}
		//ACTIVE_DRAG.update(drag => ({ ...drag, targetZone: this.currentTargetZone }));
	*/
  }

  /// Similar to the zone, but also usable by the element itself.
  // Called after zones onDragEnter ran
  onDragEnter(drag: DragOperation<unknown>) {
    /*const transition = document.startViewTransition(async () => {
			if (drag.targetZone.itemSize !== null) {
				drag.element.domEl.style.width = `${drag.targetZone.itemSize.w}px`;
				drag.element.domEl.style.height = `${drag.targetZone.itemSize.h}px`;
			}
			await tick();
		});*/
  } // TODO: imp

  /// Similar to the zone, but also usable by the element itself.
  // Called after zones onDragEnter ran
  onDragLeave(drag: DragOperation<unknown>) {} // TODO: imp

  onDragEnd() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    document.body.style.userSelect = "";

    this.applyCachedStyles();
    const transition = document.startViewTransition(async () => {
      this.isDragging.set(false);
      this.isOverZone.set(false);
      await tick();

      // TODO: Call custom logic to handle drop on zone
    });

    // todo: Reset temp disabled css rules
    this.raf = null;
    this.styleCache.clear();
    ACTIVE_DRAG.set(null);
  }

  /// === UTILS

  cacheStyle(prop: string, newVal?: string) {
    this.styleCache.set(prop, this.domEl.style.getPropertyValue(prop));
    if (newVal) this.domEl.style.setProperty(prop, newVal);
  }
  cacheStyles(styles: [string, string][]) {
    for (const [prop, value] of styles) {
      this.cacheStyle(prop, value);
    }
  }
  applyCachedStyles() {
    for (const [prop, value] of this.styleCache) {
      this.domEl.style.setProperty(prop, value);
    }
  }

  /// === API

  // Manually start the drag operation.
  startDrag() {
    document.addEventListener("mouseup", this.boundMouseUp, { once: true });
    // NOTE: we dont dispatch the drag event here, but actually inside the mouseMoveHandler
    // So we have access to the event data.
    // This is also why we use the once modifier, so it only fires once.
    document.addEventListener("mousemove", this.boundMouseMove, { once: true });
  }
}

// === ACTIONS

export function createDragZone<T, C extends DragZone<any>>(id: string, controllerOverride?: C) {
  new controllerOverride();
  const controller = new DragZone<T>(id);

  const action: Action<
    HTMLElement,
    { droppable: boolean },
    {
      "on:dragEnter": (e: CustomEvent<DragOperation>) => void;
      "on:dragOver": (e: CustomEvent<DragOperation>) => void;
      "on:dragLeave": (e: CustomEvent<DragOperation>) => void;
      "on:drop": (e: CustomEvent<DragOperation>) => void;
    }
  > = (node, props) => {
    // the node has been mounted in the DOM
    controller.attach(node);

    return {
      update(props) {
        // the value of `props` has changed
        //draggableElement.isDraggable = props.draggable;
      },

      destroy() {
        // the node has been removed from the DOM
      }
    };
  };
  return {
    dragZone: action,
    controller
  };
}

export function createDraggable<T extends IDragData>(id: string, data: T) {
  const controller = new DragElement(id, data);

  const action: Action<
    HTMLElement,
    {
      data: T;
      draggable?: boolean;
    },
    {
      "on:drag": (e: CustomEvent<DragOperation>) => void;
      "on:dragenter": (e: CustomEvent<DragOperation>) => void;
      "on:dragleave": (e: CustomEvent<DragOperation>) => void;
      "on:dragend": (e: CustomEvent<DragOperation>) => void;
    }
  > = (node, props) => {
    // the node has been mounted in the DOM
    controller.attach(node);

    node.addEventListener("mousedown", controller.startDrag.bind(controller));

    return {
      update(props) {
        // the value of `props` has changed
        //controller.data = props.data;
        //props.draggable && controller.isDraggable = props.draggable;
      },

      destroy() {
        // the node has been removed from the DOM
      }
    };
  };
  return {
    draggable: action,
    controller
  };
}
