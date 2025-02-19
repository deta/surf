import type { ActionReturn } from "svelte/action";
import { Dragcula, DragOperation, DragData } from "./Dragcula.js";
import type { DragItemPreviewType, DropEffect, Vec2 } from "./types.type.js";
import {
  assert,
  clamp,
  genId,
  getParentZone,
  getParentZoneEl,
  ii_TRACE,
  log
} from "./utils/internal.js";
import { DragculaDragEvent } from "./Event.js";
import { DragZone } from "./DragZone.js";
import { HTMLDragArea } from "./DragArea.js";

export class DragItem<DataTypes extends Record<string, any> = { [key: string]: any }> {
  static ITEMS = new Map<string, DragItem>();

  readonly id: string;

  // === STATE
  data: DragData<DataTypes>;
  dropEffect: DropEffect = "move";

  // === CONSTRUCTOR

  constructor(id?: string, data?: DragData) {
    this.id = id ?? genId();
    this.data = data ?? new DragData();

    DragItem.ITEMS.set(this.id, this);
  }

  destroy() {
    DragItem.ITEMS.delete(this.id);
  }

  // === EVENTS

  protected onDragStart() {
    console.assert(
      Dragcula.get().activeDrag === null,
      "Another drag operation is already active! This should not happen!"
    );

    Dragcula.get().activeDrag = DragOperation.new({
      item: this
    });
    Dragcula.get().prepareDragOperation();
  }

  public onDragTargetEnter(drag: DragOperation, e?: DragEvent) {}

  /// e is defined when dispatched from browser, undefined when dispatched from code so drag is not only run whilst moving the mouse
  protected onDrag(drag: DragOperation, e?: DragEvent) {}

  public onDragTargetLeave(drag: DragOperation, e?: DragEvent) {}

  protected onDragEnd(drag: DragOperation, e?: DragEvent) {
    console.warn("onDragEnd isNative", Dragcula.get().activeDrag?.isNative);
    Dragcula.get().cleanupDragOperation();
  }
}

export interface HTMLDragItemProps {
  id?: string;
  data?: DragData;
}
export interface HTMLDragItemAttributes {
  /// dragPreviewMode
  id?: string;

  "on:DragStart"?: (drag: DragculaDragEvent) => void;
  "on:Drag"?: (drag: DragculaDragEvent) => void;
  "on:DragTargetEnter"?: (drag: DragculaDragEvent) => void;
  "on:DragTargetLeave"?: (drag: DragculaDragEvent) => void;
  "on:DragEnd"?: (drag: DragculaDragEvent) => void;
}

export class HTMLDragItem extends DragItem {
  protected static _activeTransition: ViewTransition | false = false;
  static get activeTransition() {
    return this._activeTransition;
  }
  static async startTransition(
    cbk: () => void | Promise<void>,
    skipActive = true
  ): Promise<ViewTransition> {
    if (Dragcula.useViewTransitions === false) {
      await cbk();
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
    HTMLDragItem._activeTransition.finished.finally(() => {
      HTMLDragItem._activeTransition = false;
    });
    return HTMLDragItem._activeTransition;
  }

  protected get prefix(): string {
    return `\x1B[40;97m[DragItem::${this.id}]\x1B[m`;
  }

  readonly previewType: DragItemPreviewType;
  readonly element: HTMLElement;
  readonly allowDragStartPropagation: boolean;

  /// Used for hoist
  //protected readonly nextElement?: HTMLElement;
  //protected readonly parentElement?: HTMLElement;

  // === STATE

  protected previewElement?: HTMLElement;

  protected raf: number | null = null;
  protected dragInterval: Timer | null = null; // Used to emit drag events event when not moving mouse.
  protected previewPosition: Vec2<number> & {
    vx: number;
    vy: number;
    scaleX: number;
    scaleY: number;
  } = { x: 0, y: 0, vx: 0, vy: 0, scaleX: 1, scaleY: 1 }; // Position + velocity (movement delta)
  protected previewSize: Vec2<number> = { x: 0, y: 0 };
  protected previewVisible = true;

  // === CONSTRUCTOR

  constructor(
    node: HTMLElement,
    props?: {
      id?: string;
      data?: DragData;
      previewType?: DragItemPreviewType;
      allowDragStartPropagation?: boolean;
    }
  ) {
    super((props?.id ?? Boolean(node.id)) ? node.id : undefined, props?.data);
    this.element = node;
    this.previewType = props?.previewType ?? "clone";
    this.allowDragStartPropagation = props?.allowDragStartPropagation ?? false;
    //this.parentElement = node.parentElement;

    this.attach(node);

    Dragcula.get();
  }

  attach(node: HTMLElement) {
    (this.element as HTMLElement) = node;
    //log.trace(`${ii_TRACE} ${this.prefix}:attach`, this);
    this.element.setAttribute("data-drag-item", this.id);

    this.configureFromDOMAttributes();

    this.element.addEventListener("dragstart", this.handleDragStart, { capture: false });
    //this.element.addEventListener("dragend", this.handleDragEnd, { capture: false });
    this.element.addEventListener("dragend", (e) => setTimeout(() => this._handleDragEnd(e), 10), {
      capture: false
    }); // NOTE: This is a haky fix to make it work with webviews for now, as they need some ipc time and dont themselves dispatch drag events :''')
    this.element.addEventListener("drag", this.handleDrag, { capture: true });
  }

  destroy() {
    //log.trace(`${ii_TRACE} ${this.prefix}:destroy`, this);
    //this.element.removeEventListener("dragstart", this.handleDragStart);
    //this.element.removeEventListener("dragend", this.handleDragEnd);
    //this.element.removeEventListener("drag", this.handleDrag, { capture: true });

    super.destroy();
  }

  configureFromDOMAttributes() {
    // TODO: this nees proper handling due to props override? (this.id as string) = this.element.getAttribute("id") ?? this.id;
    // TODO: impl
  }

  static action(
    node: HTMLElement,
    props: { id?: string; data?: DragData; allowDragStartPropagation?: boolean }
  ): ActionReturn<HTMLDragItemProps, HTMLDragItemAttributes> {
    const item = new this(node, props);
    return {
      destroy() {
        item.destroy();
      },
      update() {}
    };
  }

  /** Create the drag preview element and attache it to the DOM.
   */
  createPreivewElement() {
    console.warn("createPreivewElement");
    //   const transition = await HTMLDragItem.startTransition(() => {
    if (this.previewType === "clone") {
      this.previewElement = this.element.cloneNode(true) as HTMLElement;

      let vtName = this.element.style.viewTransitionName;

      this.previewElement.style.viewTransitionName = vtName;
      this.element.style.viewTransitionName = "";

      this.previewElement.setAttribute("data-drag-preview", "");
      this.previewElement.style.pointerEvents = "none";
      this.previewElement.style.position = "fixed";
      this.previewElement.style.zIndex = "2147483647";
      this.previewElement.style.left = "0px";
      this.previewElement.style.top = "0px";
      this.previewElement.style.setProperty("--drag-width", `${this.previewSize.x}px`);
      this.previewElement.style.setProperty("--drag-height", `${this.previewSize.y}px`);
      this.previewElement.style.setProperty("--drag-offsetX", `${this.previewPosition.x}px`);
      this.previewElement.style.setProperty("--drag-offsetY", `${this.previewPosition.y}px`);
      this.previewElement.style.setProperty("--drag-scale", "1");

      const scaleFactor = clamp(245 / Math.max(this.previewSize.x, this.previewSize.y), 0, 1);
      this.previewElement.style.setProperty("--drag-scale", `${scaleFactor}`);

      this.previewElement.style.viewTransitionName = "dragcula-preview-element";

      // TODO: This should be not hard wired into dragcula
      // TOOD: Add schnittstelle to do custom preview manipulation on dragstart
      // HACK: For now it is
      const prevEls = Array.from(
        this.previewElement.querySelectorAll(".space-preview .resource-preview")
      );
      if (prevEls.length > 25) {
        for (const e of prevEls) {
          e.remove();
        }
      }
    }

    if (this.previewType === "clone") {
      document.body.appendChild(this.previewElement!);
    }

    //});
  }

  // === DOM EVENTS
  protected handleDragStart = this._handleDragStart.bind(this);
  protected handleDrag = this._handleDrag.bind(this);
  protected handleDragEnd = this._handleDragEnd.bind(this);
  // NOTE: We still need a dedicated mosueUp, as dragEnd wont be fired until after drop..
  // we already want to cancel timers on release though!
  protected handleMouseUp = this._handleMouseUp.bind(this);

  protected _handleDragStart(e: DragEvent) {
    if (!this.allowDragStartPropagation) {
      e.stopPropagation();
    }
    e.dataTransfer!.setDragImage(Dragcula.get().transparentImg, 0, 0); // FIX: CHECK dt
    //e.dataTransfer!.setData("text", "test");
    e.dataTransfer!.effectAllowed = "all";
    e.dataTransfer!.dropEffect = "copy";

    log.debug(`${this.prefix}:dragStart`, e);

    /*// NOTE: HTML5 Honeypot fix as browsers dont fix weird bugs for shit :((
		// see: https://www.youtube.com/watch?v=udE9qbFTeQg
		const honeypot = document.createElement("div");
		honeypot.style.position = "fixed";
		const WIDTH = 30;
		honeypot.style.top = `${e.clientY - WIDTH / 2}px`;
		honeypot.style.left = `${e.clientX - WIDTH / 2}px`;
		honeypot.style.width = `${WIDTH}px`;
		honeypot.style.height = `${WIDTH}px`;
		honeypot.style.background = "red";
		honeypot.style.pointerEvents = "none";
		document.body.appendChild(honeypot);*/

    // TODO: update paren t/ siblings
    this.previewPosition.x = e.clientX;
    this.previewPosition.y = e.clientY;
    this.previewPosition.vx = 0;
    this.previewPosition.vy = 0;

    this.element.setAttribute("data-dragging-item", "");

    const parentAreaEl = this.element.parentElement?.closest(
      "[data-drag-area]"
    ) as HTMLElement | null;

    Dragcula.get().activeDrag = DragOperation.new({
      item: this,
      area: parentAreaEl
        ? HTMLDragArea.AREAS.get(parentAreaEl.getAttribute("data-drag-area")!)
        : undefined
    });
    Dragcula.get().prepareDragOperation();
    const drag = Dragcula.get().activeDrag!;

    const parentArea = parentAreaEl
      ? HTMLDragArea.AREAS.get(parentAreaEl.getAttribute("data-drag-area")!)
      : undefined;

    if (parentArea) {
      const evt = new DragEvent("dragenter", {
        dataTransfer: drag.dataTransfer,
        relatedTarget: drag.area?.element ?? undefined,
        bubbles: true,
        cancelable: true
      });
      parentArea?._handleDragEnter(evt);
    }

    DragculaDragEvent.dispatch("DragStart", this.element, {
      metaKey: e?.metaKey,
      ctrlKey: e?.ctrlKey,
      shiftKey: e?.shiftKey,
      altKey: e?.altKey,
      ...drag,
      event: e,
      bubbles: false
    }); // no fck bubbles to annoy u ;) !

    this.dragInterval = setInterval(() => this.onDrag.bind(this)(drag), 300);
    this.onDragStart(e);
  }

  protected async _handleDragEnd(e: DragEvent) {
    /*const target = e.target as HTMLElement;
		if (!this.element.contains(target) || getParentZoneEl(target) !== this.element) return;*/

    e.stopPropagation();
    e.preventDefault();

    log.debug(`${this.prefix}:dragEnd`, e);
    const drag = Dragcula.get().activeDrag;
    assert(drag !== null, "No active drag operation during handleDragEnd! This should not happen!");

    // FIX: MAKE IT CANLELLE
    if (HTMLDragItem.activeTransition) {
      HTMLDragItem.activeTransition!.skipTransition();
    }

    const cancelled = drag.to === null || drag.to === drag.from;
    if (cancelled) {
      const vtName = this.element.style.viewTransitionName;
      if (vtName !== "") {
        this.previewElement.style.viewTransitionName = vtName;
        this.element.style.viewTransitionName = "";
      } else this.previewElement.style.viewTransitionName = "drag-item";
      const transition = await HTMLDragItem.startTransition(() => {
        if (vtName !== "") {
          this.element.style.viewTransitionName = vtName;
          this.previewElement.style.viewTransitionName = "";
        } else this.element.style.viewTransitionName = "drag-item";

        this.element.removeAttribute("data-dragging-item");
        this.onDragEnd(drag, e);
      });
      transition.finished.then(() => {
        this.element.style.viewTransitionName = "";
      });
      return;
    }

    // TODO: Check for ESC cancel
    // TODO: Set status

    this.element.removeAttribute("data-dragging-item");

    this.onDragEnd(drag, e);
  }

  protected _handleDrag(e: DragEvent) {
    //e.stopPropagation() // TODO: Issues?
    const drag = Dragcula.get().activeDrag;
    assert(drag !== null, "No active drag operation during handleDrag! This should not happen!");
    this.onDrag(drag, e);
  }

  protected _handleMouseUp(e: MouseEvent) {
    const drag = Dragcula.get().activeDrag;
    clearInterval(this.dragInterval!);
  }

  // === EVENTS
  protected boundRafCbk = this.rafCbk.bind(this);

  protected override async onDragStart(e?: DragEvent) {
    const drag = Dragcula.get().activeDrag;
    if (drag === null) {
      throw new Error("No active drag operation during onDragStart! This should not happen!");
    }
    log.debug(`${this.prefix}:DragStart`, drag);

    drag.dataTransfer = e?.dataTransfer ?? new DataTransfer();

    const parentZoneEl = this.element.parentElement?.closest(
      "[data-drag-zone]"
    ) as HTMLElement | null;
    if (parentZoneEl !== null) {
      const zone = DragZone.ZONES.get(parentZoneEl.getAttribute("data-drag-zone")!);
      if (!zone) {
        // TODO: Better more correct error msg.
        log.warn(`${this.prefix} Parent zone not found during drag start! This should not happen!`);
        throw new Error("Parent zone not found during drag start! This should not happen!");
      }
      drag.from = zone;
      Dragcula.get().targetDomElement.set(zone.element);
    }

    const parentAreaEl = this.element.parentElement?.closest(
      "[data-drag-area]"
    ) as HTMLElement | null;
    if (parentAreaEl !== null) {
      const area = HTMLDragArea.AREAS.get(parentAreaEl.getAttribute("data-drag-area")!);
      if (area) {
        drag.area = area;
        area._handleDragEnter(e);
        //Dragcula.get().targetDomElement.set(zone.element);
      }
    }

    this.previewPosition.x = e?.clientX ?? 0;
    this.previewPosition.y = e?.clientY ?? 0;
    this.previewSize = { x: this.element.clientWidth, y: this.element.clientHeight };

    // Create preview element
    setTimeout(() => this.createPreivewElement(), 0);

    //window.addEventListener("mouseup", this.handleMouseUp, { once: true, capture: true });

    DragculaDragEvent.dispatch("DragStart", this.element, {
      metaKey: e?.metaKey,
      ctrlKey: e?.ctrlKey,
      shiftKey: e?.shiftKey,
      altKey: e?.altKey,
      ...drag,
      event: e,
      bubbles: false
    }); // no fck bubbles to annoy u ;) !

    this.dragInterval = setInterval(() => this.onDrag.bind(this)(drag), 300);

    //transition.updateCallbackDone.then(() => {

    setTimeout(() => {
      const parentZone = getParentZoneEl(this.element);
      if (parentZone) {
        const evt = new DragEvent("dragenter", {
          dataTransfer: drag.dataTransfer,
          bubbles: true,
          clientX: e.clientX,
          clientY: e.clientY
        });
        parentZone.dispatchEvent(evt);
      }
      //});
      /*transition.finished.then(() => {
      if (this.previewElement) {
        const vtName = this.previewElement.style.viewTransitionName;
        if (vtName !== "drag-item") {
          this.element.style.viewTransitionName = vtName;
        }
        this.previewElement.style.viewTransitionName = "";
      }
    });*/

      Dragcula.get().callHandlers("dragstart", drag);
    }, 1);
  }

  lastOffset: Vec2<number> = { x: NaN, y: NaN }; // TODO: refac.
  protected rafCbk(_: number) {
    if (this.previewElement === undefined) {
      this.raf = null;
      return;
    }

    // FIX:: Add down velocity
    const tilt =
      this.previewPosition.vx * 5 +
      (Math.sign(this.previewPosition.vx) > 0
        ? -this.previewPosition.vy * 3
        : Math.sign(this.previewPosition.vx) < 0
          ? this.previewPosition.vy * 3
          : 0);

    if (
      this.lastOffset.x !== this.previewPosition.x ||
      this.lastOffset.y !== this.previewPosition.y
    ) {
      this.previewElement!.style.setProperty("--drag-offsetX", `${this.previewPosition.x}px`);
      this.previewElement!.style.setProperty("--drag-offsetY", `${this.previewPosition.y}px`);
      this.lastOffset.x = this.previewPosition.x;
      this.lastOffset.y = this.previewPosition.y;
    }
    this.previewElement!.style.setProperty("--drag-tilt", `${clamp(tilt, -45, 45)}deg`);
    this.previewElement!.style.setProperty("--drag-scaleX", this.previewPosition.scaleX.toString());
    this.previewElement!.style.setProperty("--drag-scaleY", this.previewPosition.scaleY.toString());

    //this.previewElement!.style.visibility = this.previewVisible ? "visible" : "hidden";

    this.raf = null;
  }

  override onDrag(drag: DragOperation, e?: DragEvent) {
    super.onDrag(drag, e);

    // Update velocity (decrease)
    this.previewPosition.vx = (this.previewPosition.vx * 0.6 + this.previewPosition.vx * 7.0) / 9.0;
    this.previewPosition.vy = (this.previewPosition.vy * 0.6 + this.previewPosition.vy * 7.0) / 9.0;
    if (Math.abs(this.previewPosition.vx) < 0.1) this.previewPosition.vx = 0;
    if (Math.abs(this.previewPosition.vy) < 0.1) this.previewPosition.vy = 0;

    //const insideViewport = this.previewPosition.x > 1 && this.previewPosition.y > 1 && this.previewPosition.x < window.innerWidth && this.previewPosition.y < window.innerHeight;

    if (e) {
      //this.previewVisible = true;

      // Update velocity (increase from movemenet delta)
      if (e.clientX >= 1 && e.clientY >= 1) {
        this.previewPosition.vx =
          (e.clientX - this.previewPosition.x + this.previewPosition.vx * 9.0) / 10.0;
        this.previewPosition.vy =
          (e.clientY - this.previewPosition.y + this.previewPosition.vy * 9.0) / 10.0;

        this.previewPosition.x = e.clientX;
        this.previewPosition.y = e.clientY;
      }

      /*if (this.previewPosition.x === 0 && this.previewPosition.y === 0) {
				if (this.previewElement) this.previewElement!.style.visibility = "hidden";
				this.previewVisible = false;
			}
			else {
				if (this.previewElement && !this.previewVisible) {
					this.previewElement!.style.visibility = "visible";
					this.previewVisible = true
				}
			}

			if (this.previewPosition.x <= this.previewSize.x / 2) {
				const scale = 1; //lerp(0, 1, this.previewPosition.x / (this.previewSize.x / 2));
				this.previewPosition.scaleX = lerp(0, 1, this.previewPosition.x / (this.previewSize.x / 2 * scale));
				//this.previewElement!.style.setProperty("--scale", scale.toString());
			} else if (this.previewPosition.x >= window.innerWidth - this.previewSize.x / 2) {
				this.previewPosition.scaleX = lerp(0, 1, (window.innerWidth - this.previewPosition.x) / (this.previewSize.x / 2))
			}
			else {
				this.previewPosition.scaleX = 1;
			}
			if (this.previewPosition.y <= this.previewSize.y / 2) {
				this.previewPosition.scaleY = lerp(0, 1, this.previewPosition.y / (this.previewSize.y / 2));
			} else if (this.previewPosition.y >= window.innerHeight - this.previewSize.y / 2) {
				this.previewPosition.scaleY = lerp(0, 1, (window.innerHeight - this.previewPosition.y) / (this.previewSize.y / 2));
			}
			else {
				this.previewPosition.scaleY = 1;
			}*/
    } /*else {

			// Update velocity (increase from movemenet delta)
			this.previewPosition.vx = (SPY_MOUSE_POS.x - this.previewPosition.x + this.previewPosition.vx * 9.0) / 10.0;
			this.previewPosition.vy = (SPY_MOUSE_POS.y - this.previewPosition.y + this.previewPosition.vy * 9.0) / 10.0;

			this.previewPosition.x = SPY_MOUSE_POS.x;
			this.previewPosition.y = SPY_MOUSE_POS.y;
		}*/

    //if (insideViewport) this.previewVisible = true;
    //else this.previewVisible = false;

    /*if (HTMLDragItem.activeTransition) this.rafCbk(performance.now().valueOf());
		else*/ if (this.raf === null) this.raf = requestAnimationFrame(this.boundRafCbk);

    DragculaDragEvent.dispatch("Drag", this.element, {
      metaKey: e?.metaKey,
      ctrlKey: e?.ctrlKey,
      shiftKey: e?.shiftKey,
      altKey: e?.altKey,
      ...drag,
      event: e,
      bubbles: false
    });

    if (HTMLDragItem.activeTransition && drag.to !== null) {
      //drag.to.onDragOver(drag, e);
    }
  }

  override onDragTargetEnter(drag: DragOperation, e?: DragEvent) {
    log.debug(`${this.prefix}:DragTargetEnter`, drag);

    if (drag.to?.id) this.previewElement?.setAttribute("data-drag-target", drag.to.id);

    DragculaDragEvent.dispatch("DragTargetEnter", this.element, {
      metaKey: e?.metaKey,
      ctrlKey: e?.ctrlKey,
      shiftKey: e?.shiftKey,
      altKey: e?.altKey,
      ...drag,
      event: e,
      bubbles: false
    });
  }

  override onDragTargetLeave(drag: DragOperation, e?: DragEvent) {
    log.debug(`${this.prefix}:DragTargetLeave`, drag);

    if (drag.to?.id !== this.previewElement?.getAttribute("data-drag-target")) {
      log.debug("DRAG LEFT WINDOW");
      log.warn(`${this.prefix}:DragTargetLeave: Drag target mismatch! This should not happen!`);
    }
    if (drag.to === null) this.previewElement?.removeAttribute("data-drag-target");

    DragculaDragEvent.dispatch("DragTargetLeave", this.element, {
      metaKey: e?.metaKey,
      ctrlKey: e?.ctrlKey,
      shiftKey: e?.shiftKey,
      altKey: e?.altKey,
      ...drag,
      event: e,
      bubbles: false
    });
  }

  protected override onDragEnd(drag: DragOperation, e?: DragEvent) {
    log.debug(`${this.prefix}:DragEnd`, drag, e);

    clearInterval(this.dragInterval!);

    if (this.previewType === "clone") {
      this.previewElement?.remove();
      this.previewElement = undefined;
    }

    DragculaDragEvent.dispatch("DragEnd", this.element, {
      metaKey: e?.metaKey,
      ctrlKey: e?.ctrlKey,
      shiftKey: e?.shiftKey,
      altKey: e?.altKey,
      ...drag,
      event: e,
      bubbles: false
    }); // no fck bubbles to annoy u ;) !

    document.body.removeAttribute("data-drag-target");

    super.onDragEnd(drag, e);
  }
}
