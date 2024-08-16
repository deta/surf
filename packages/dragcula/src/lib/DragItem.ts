import type { ActionReturn } from "svelte/action";
import type { DragData, DragEffect, DragOperation } from "./types.js";
import { createStyleCache, nextElementSibling, StyleCache } from "./utils.js";
import { log, EventSpy, KEY_STATE, MOUSE_POS, SUPPORTS_VIEW_TRANSITIONS } from "./internal.js";
import { tick } from "svelte";
import { HTMLDragZone } from "./DragZone.js";
import { DragculaDragEvent } from "./Event.js";

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

  protected _canDrop = false;
  get canDrop(): boolean {
    return this._canDrop;
  }
  set canDrop(v: boolean) {
    this._canDrop = v;
  }

  data: DragData;
  dragEffect: DragEffect;

  /// === CONSTRUCTOR

  constructor(props: { id?: string; data?: DragData }) {
    this.id = props.id ?? crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
    this.data = props.data ?? {};
    this.dragEffect = "none";
  }

  destroy() {}

  /// === EVENTS

  /** Bootstrap the drag operation & handle possible DOM changes. */
  onDragStart() {
    console.assert(
      document.activeDragOperation === undefined,
      "Another drag operation is already active! This should not happen!"
    );

    document.activeDragOperation = {
      id: crypto.getRandomValues(new Uint32Array(1))[0].toString(16),
      status: "active",
      from: null,
      to: null,
      item: this,

      clientX: MOUSE_POS.x,
      clientY: MOUSE_POS.y
    };
  }

  onDrag(drag: DragOperation) {}
  onDragEnd(drag: DragOperation) {
    this.isDragging = false;
    this.canDrop = false;
    document.activeDragOperation = undefined;
  }

  onDragEnter(drag: DragOperation) {
    this.canDrop = true;
  }
  onDragLeave(drag: DragOperation) {
    this.canDrop = false;
  }
}

/**
 * clone: Clones the DOM element as a preview.
 * hoist: Uses the original DOM element as a preview.
 * component: Uses custom Svelte component as the preview.
 */
type HTMLDragItemPreviewMode = "clone" | "hoist" | "component";
export class HTMLDragItem extends DragItem {
  /// Map of active HTMLDragItems used to find re-attach items e.g. during move.
  /// FIX: Maybe add some sort of limit / auto clean just to prevent memory buildup.
  static ITEMS = new Map<string, HTMLDragItem>();

  protected static _activeTransition: ViewTransition | false = false;
  static get activeTransition() {
    return this._activeTransition;
  }
  static get useTransitions() {
    return false; /*SUPPORTS_VIEW_TRANSITIONS && !document.dragculaDisableViewTransitions;*/
  }
  static async startTransition(
    cbk: () => void | Promise<void>,
    skipActive = true
  ): Promise<ViewTransition> {
    if (HTMLDragItem.useTransitions === false) {
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

  readonly element: HTMLElement;
  protected readonly nextElement?: HTMLElement;
  protected readonly parentElement: HTMLElement;

  readonly previewMode: HTMLDragItemPreviewMode;

  /// === STATE

  override set isDragging(v: boolean) {
    super.isDragging = v;
    const target = this.previewMode === "clone" ? this.previewElement : this.element;
    if (v) {
      target?.setAttribute("data-dragcula-dragging-item", "true");
    } else {
      target?.removeAttribute("data-dragcula-dragging-item");
    }
  }
  override set canDrop(v: boolean) {
    super.canDrop = v;
    const target = this.previewMode === "clone" ? this.previewElement : this.element;
    if (v) {
      target?.setAttribute("data-dragcula-can-drop", "true");
    } else {
      target?.removeAttribute("data-dragcula-can-drop");
    }
  }

  /// FIX: MAybe use WeakMap / auto cleanup somehow to prevent memory buildup.
  /// Needs to still support referencing old dom items though somehow.
  protected styles = new StyleCache();
  /// NOTE: This looks a bit nasty
  protected pushViewTransitionName(node: HTMLElement, val: string) {
    if (HTMLDragItem.useTransitions === false) return;
    this.styles.push(node, "view-transition-name", val);
  }
  protected popViewTransitionName(node: HTMLElement) {
    if (HTMLDragItem.useTransitions === false) return;
    this.styles.pop(node, "view-transition-name");
  }

  // Ref to the element which is used as a preview during drag.
  protected previewElement?: HTMLElement;

  protected raf: number | null = null;
  protected rafInterval: Timer | null = null; // Used to emit drag events event when not moving mouse.
  protected previewPosition: { x: number; y: number } = { x: 0, y: 0 };
  protected initialElementSize: { w: number; h: number } = { w: 0, h: 0 };

  /// === CONSTRUCTOR

  /** Use static new method, as it handles re-attaching item to existing controller and
   * sets the id from the id attribute if existis.
   */
  protected constructor(node: HTMLElement, props: { id?: string; data?: DragData }) {
    super(props);
    this.element = node;
    if (node.parentElement === null) throw new Error("HTMLDragItem must have a parent element!");
    this.parentElement = node.parentElement!;
    this.previewMode = "clone";

    this.attach(node);
    HTMLDragItem.ITEMS.set(this.id, this);
  }

  /// Used to attach to a given node, or re-attach to a new node.
  attach(node: HTMLElement, oldNode?: HTMLElement) {
    (this.element as HTMLElement) = node;
    this.element.setAttribute("data-dragcula-item", this.id);
    if (node.parentElement === null) throw new Error("HTMLDragItem must have a parent element!");
    (this.parentElement as HTMLElement) = node.parentElement!;

    // TODO: Recover needed values from old controller

    this.applyDomAttributes();

    if (oldNode) {
      oldNode.removeEventListener("dragstart", this.boundDragStart);
      this.styles.transfer(oldNode, this.element);
      if (document.activeDragOperation?.status === "finalizing") {
        log.trace("Attaching to new with status", document.activeDragOperation?.status);
        this.pushViewTransitionName(this.element, `dragcula-dragItem`);
        //this.styles.push(this.element, "view-transition-name", `dragcula-dragItem`);
      }
    }

    //console.warn("Attaching dragstart", this.element)
    this.element.addEventListener("dragstart", this.boundDragStart);
    //this.isDragging = this.isDragging;
  }

  /// Apply configuration attributes based on current attached HTMLElement.
  applyDomAttributes() {
    // TODO: preview-mode
  }

  static new(node: HTMLElement, props: { id?: string; data?: DragData }): HTMLDragItem {
    const id = node.getAttribute("id") ?? props.id ?? undefined;
    if (id === undefined) {
      return new this(node, props);
    } else props.id = id;

    //console.warn("NEW status", document.activeDragOperation?.status, id)
    if (
      HTMLDragItem.ITEMS.has(id) &&
      document.activeDragOperation !== undefined &&
      document.activeDragOperation.item?.id === id &&
      document.activeDragOperation.status === "finalizing"
    ) {
      const controller = this.ITEMS.get(id)!;
      log.debug(`[HTMLDragitem:${id}] Re-attaching item to existing controller!`, node, controller);
      controller.attach(node, controller.element);
      return controller;
    }

    return new this(node, props);
  }

  override destroy() {
    // If there is an active drag with this item, dont delete the controller
    // so it can be re-attached to the new element.

    if (
      document.activeDragOperation !== undefined &&
      (document.activeDragOperation.item as DragItem)?.id === this.id &&
      ["active", "finalizing"].includes(document.activeDragOperation!.status)
    )
      return;

    log.debug("Deleting controller", this.id, document.activeDragOperation?.status);

    super.destroy();

    // FIX: Willingly create memory leak!? buuut, prevents accidentally removing handle rbreaking this shit
    // should be fine mostly, as elements re-render either way most of the time.
    //this.element.removeEventListener("dragstart", this.boundDragStart);

    HTMLDragItem.ITEMS.delete(this.id);
  }

  static action(node: HTMLElement, props: { id?: string; data?: DragData }): ActionReturn {
    const controller = this.new(node, props);

    return {
      destroy() {
        controller.destroy();
      },
      update(props: any) {
        // TODO: impl
      }
    };
  }

  protected async rafCbk(_: number) {
    console.assert(
      this.previewElement !== undefined,
      "Preview element is null! This should not happen!"
    );
    if (this.previewElement === undefined) {
      this.raf = null;
      return;
    }
    const drag = document.activeDragOperation;
    if (!drag) {
      log.error("raf withozut activ edrag!");
      this.raf = null;
      return;
    }

    this.previewElement.style.transform = `translate(-50%, -50%) translate(${this.previewPosition.x}px, ${this.previewPosition.y}px)`; // var(--dragcula-transform)

    const overZone = HTMLDragZone.findClosestFromPoint(MOUSE_POS.x, MOUSE_POS.y);
    const newTargetId = overZone?.id ?? null;
    const oldTargetId = drag.to?.id ?? null;

    if (newTargetId !== oldTargetId) {
      log.debug("dragRaf new/old target", newTargetId, oldTargetId);
      if (oldTargetId !== null) {
        drag.to!.onDragLeave(drag);
        drag.to = null;
      }
      if (newTargetId !== null) {
        const accepted = await overZone!.onDragEnter(drag);
        log.debug("zone accepted", accepted);
        drag.to = accepted ? overZone : null;
      }
    }

    if (drag.to !== null) {
      drag.to.isTarget = true;
      drag.to.onDragOver(drag);
      this.canDrop = true;
    } else {
      this.canDrop = false;
    }

    this.raf = null;
  }
  protected boundRafCbk = this.rafCbk.bind(this);

  /// === DOM HANDLERS
  protected boundMouseMove = this._handleMouseMove.bind(this);
  protected boundMouseUp = this._handleMouseUp.bind(this);
  protected boundDragStart = this._handleDragStart.bind(this);

  protected _handleMouseMove(e: MouseEvent) {
    console.assert(
      document.activeDragOperation !== undefined,
      "No active drag operation! This should not happen!"
    );

    const drag = document.activeDragOperation!;
    drag.clientX = MOUSE_POS.x;
    drag.clientY = MOUSE_POS.y;

    this.onDrag(drag);
  }
  protected async _handleMouseUp(e: MouseEvent) {
    log.debug(`[HTMLDragItem:${this.id}] mouseup`, e);
    console.assert(
      document.activeDragOperation !== undefined,
      "No active drag operation! This should not happen!"
    );
    const drag = document.activeDragOperation!;

    window.removeEventListener("mouseup", this.boundMouseUp, { capture: true });
    window.removeEventListener("mousemove", this.boundMouseMove, { capture: true });
    clearInterval(this.rafInterval!);

    this.pushViewTransitionName(this.previewElement!, `dragcula-dragItem`);
    //this.styles.push(this.previewElement!, "view-transition-name", `dragcula-dragItem`);

    const transition = await HTMLDragItem.startTransition(async () => {
      this.pushViewTransitionName(this.element, `dragcula-dragItem`);
      //this.styles.push(this.element, "view-transition-name", `dragcula-dragItem`);
      drag.status = "finalizing";
      this.popViewTransitionName(this.previewElement!);
      //this.styles.pop(this.previewElement!, "view-transition-name");
      if (drag.to !== null) {
        try {
          drag.to.onDrop(drag);
          drag.status = "done";
        } catch {
          drag.status = "aborted";
        }
        // TODO: Dispatch drop event
        // handle aborted
      } else {
        drag.status = "aborted";
      }

      if (drag.from !== null) {
        drag.from.onDragEnd(drag);
      }

      this.onDragEnd(drag);

      // NOTE: Needed so that DOM can change, items can be re-attached & finalized
      await tick();

      //this.onDragEnd(drag);
    }, true);
    transition.finished.finally(() => {
      // TODO: Reset vt name overrides
      if (this.previewElement) this.styles.resetAll(this.previewElement);
      this.styles.resetAll(this.element);

      // FIX: fix
      //this.styles.dump("DragEnd");
      //console.assert(this.styles.items.size === 0, "Style cache not empty after drag end! This should not happen!");
    });
  }

  protected _handleDragStart(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    log.debug(`[HTMLDragItem:${this.id}] dragstart`, e);

    (this.nextElement as HTMLElement) = nextElementSibling(this.element, (el) =>
      el.hasAttribute("data-dragcula-item")
    ) as HTMLElement;
    this.previewPosition = { x: e.clientX, y: e.clientY };

    const style = window.getComputedStyle(this.element, null);
    this.initialElementSize = {
      w: parseFloat(style.getPropertyValue("width")),
      h: parseFloat(style.getPropertyValue("height"))
    };

    this.onDragStart();
  }

  /// === EVENTS

  override async onDragStart() {
    log.debug(`[HTMLDragItem:${this.id}] DragStart`);
    super.onDragStart();
    const drag = document.activeDragOperation;
    if (drag === undefined) {
      throw new Error("No active drag operation during onDragStart! This should not happen!");
    }

    const parentZone = HTMLDragZone.findClosestFromElement(this.parentElement);
    if (parentZone !== null) document.activeDragOperation!.from = parentZone;

    try {
      const hasDragculaListeners = EventSpy.hasListenerOfType(this.element, "DragStart");
      const handlesDragculaEvent = EventSpy.allListenersHandleDragculaEvent(
        this.element,
        "DragStart"
      );
      log.debug(
        "hasDragculaListeners",
        hasDragculaListeners,
        "handlesDragculaEvent",
        handlesDragculaEvent
      );
      if (hasDragculaListeners && !handlesDragculaEvent) {
        log.warn(
          "Element ",
          this.element,
          " has DragStart listener(s), but not all handle Dragcula events correctly! Are you missing .continue() / .abort() ?"
        );
        throw new Error(
          "Element has DragStart listener(s), but not all handle Dragcula events correctly! Are you missing .continue() / .abort() ?"
        );
      } else if (hasDragculaListeners && handlesDragculaEvent) {
        await DragculaDragEvent.dispatch("DragStart", document.activeDragOperation, this.element);
      }

      window.addEventListener("mouseup", this.boundMouseUp, { capture: true, once: true });
      window.addEventListener("mousemove", this.boundMouseMove, { capture: true });
      this.rafInterval = setInterval(() => {
        if (this.raf === null) this.raf = requestAnimationFrame(this.boundRafCbk);
      }, 300);

      this.pushViewTransitionName(this.element, `dragcula-dragItem`);
      //this.styles.push(this.element, "view-transition-name", `dragcula-dragItem`)
      this.styles.push(this.element, "position", "relative");
      this.styles.push(this.element, "z-index", "2147483647");
      this.element.setAttribute("data-dragging-item-source", "true");
      if (this.previewMode === "clone") {
        this.previewElement = this.element.cloneNode(true) as HTMLElement;
        // Iterate all chidlren recusrively and remvoe any which have data-dragcula-zone attribute set
        this.previewElement.querySelectorAll("[data-dragcula-zone]").forEach((el) => el.remove());

        this.previewElement.style.pointerEvents = "none";
        this.previewElement.style.position = "fixed";
        this.previewElement.style.zIndex = "2147483647";
        this.previewElement.style.width = `${this.initialElementSize.w}px`;
        this.previewElement.style.height = `${this.initialElementSize.h}px`;
        this.previewElement.style.left = `0`;
        this.previewElement.style.top = `0`;
        this.previewElement.style.transform = `translate(-50%, -50%) translate(${this.previewPosition.x}px, ${this.previewPosition.y}px)`;
      } else if (this.previewMode === "hoist") {
        throw new Error("Hoist not implemented!");
        this.previewElement = this.element;
      }
      this.styles.dump();

      const transition = await HTMLDragItem.startTransition(() => {
        this.popViewTransitionName(this.element);
        //this.styles.pop(this.element, "view-transition-name");
        this.pushViewTransitionName(this.previewElement!, `dragcula-dragItem`);
        //this.styles.push(this.previewElement!, "view-transition-name", `dragcula-dragItem`);

        document.body.appendChild(this.previewElement!);
        this.styles.pushMany(this.element, {
          opacity: "0.5"
        });

        this.isDragging = true;
        document.body.setAttribute("data-dragcula-dragging", "true");
      }, true);
      transition.finished.finally(() => {
        this.styles.reset(this.element, "view-transition-name");
        this.styles.reset(this.previewElement!, "view-transition-name");
        // TOOD: Reset vt name overrides
      });
    } catch (e) {
      // TODO: Abort all
      log.warn("Aborting drag operation!", e);
      this.onDragEnd(drag);
    }
  }

  override async onDrag(drag: DragOperation) {
    //console.debug(`[HTMLDragItem:${this.id}] Drag`, drag);
    super.onDrag(drag);

    this.previewPosition.x = MOUSE_POS.x;
    this.previewPosition.y = MOUSE_POS.y;

    if (KEY_STATE.alt) this.dragEffect = "copy";
    else this.dragEffect = "move";

    document.body.setAttribute("data-dragcula-drag-effect", this.dragEffect);

    if (this.raf === null) this.raf = requestAnimationFrame(this.boundRafCbk);
  }

  override onDragEnd(drag: DragOperation) {
    log.debug(`[HTMLDragItem:${this.id}] DragEnd`, drag);

    //console.assert(this.previewElement !== undefined, "Preview element is null in onDragEnd! This should not happen!");
    if (this.previewElement) this.styles.resetAll(this.previewElement);

    if (this.previewMode === "clone") {
      this.element.removeAttribute("data-dragging-item-source");

      this.previewElement?.remove();
    }

    this.styles.resetEverything();

    if (drag.status === "aborted") {
      this.pushViewTransitionName(this.element, `dragcula-dragItem`);
      //this.styles.push(this.element, "view-transition-name", `dragcula-dragItem`);
      log.warn("Drag aborted, reseetting");
      if (this.previewMode === "hoist") {
        throw new Error("Hoist not implemented!");
        // NOTE: only readd if element / parent / next sib still exists.
      }
    } else {
      // TODO: Check clone / hosit & act
      if (drag.item instanceof DragItem) {
        /*if (drag.item.dragEffect === "move") {
          this.
        }*/
      }
    }

    this.previewElement = undefined;
    document.body.removeAttribute("data-dragcula-dragging");
    document.body.removeAttribute("data-dragcula-drag-effect");

    // NOTE: We call this last as it also resets document.activeDragOperation and we need it
    // before for correct cleanup!
    super.onDragEnd(drag);

    DragculaDragEvent.dispatch("DragEnd", drag, this.element);
    //DragculaDragEvent.dispatch("DragEnd", drag, HTMLDragItem.ITEMS.get(this.id)!.element);

    // TODO: Check if this.element is in the DOM, remove this controller if not
    // -> The element was probably deleted in the background!
  }

  override onDragEnter(drag: DragOperation) {
    log.debug(`[HTMLDragItem:${this.id}] DragEnter`, drag);
    super.onDragEnter(drag);
  }

  override onDragLeave(drag: DragOperation) {
    log.debug(`[HTMLDragItem:${this.id}] DragLeave`, drag);
    super.onDragLeave(drag);
  }
}
