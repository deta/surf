import {
  createStyleCache,
  DRAG_ZONES,
  DragZone,
  IndexedDragculaCustomDragEvent,
  IndexedDragculaNativeDragEvent,
  type DragOperation,
  type DragZoneActionAttributes,
  type DragZoneActionProps,
  type IndexedDragculaDragEvent
} from "$lib/index.js";
import type { ActionReturn } from "svelte/action";

// TODO: dragDeadzone should be percentage -> cal for each element -> if element sizes differe, 0 = only otuside element, inside element is strict, 100% no deadzone inside element

export type Axis = "horizontal" | "vertical";

export interface AxisDragZoneActionProps extends DragZoneActionProps {}

export interface AxisDragZoneActionAttributes
  extends DragZoneActionAttributes<IndexedDragculaDragEvent> {
  axis?: Axis;
  dragdeadzone?: number;

  "on:DragEnter"?: (e: IndexedDragculaDragEvent) => void;
  "on:DragOver"?: (e: IndexedDragculaDragEvent) => void;
  "on:DragLeave"?: (e: IndexedDragculaDragEvent) => void;
  "on:DragEnd"?: (e: IndexedDragculaDragEvent) => void;
  "on:Drop"?: (e: IndexedDragculaDragEvent) => void;
}

export class AxisDragZone extends DragZone {
  protected axis: Axis = "vertical";
  protected dragDeadzone: number = 0;

  /// === STATE

  protected styleCache = createStyleCache();

  protected lastIndex: number | undefined = undefined;

  /// === CONSTRUCTOR

  constructor(id?: string) {
    super(id);
  }

  override attach(node: HTMLElement) {
    super.attach(node);

    this.applyNodeAttributes();
  }

  override applyNodeAttributes() {
    super.applyNodeAttributes();

    switch (this.node!.getAttribute("axis")) {
      case "horizontal":
        this.axis = "horizontal";
        break;
      case "vertical":
        this.axis = "vertical";
        break;
      default:
        this.axis = "vertical";
        break;
    }

    this.dragDeadzone = Number(this.node!.getAttribute("dragdeadzone") || 0);
  }

  /// === UTILS

  protected getIndexAtPoint(x: number, y: number): number | undefined {
    if (this.node!.children.length <= 0) return 0;

    const childs: {
      el: HTMLElement;
      distance: number;
      bounds: { top: number; right: number; bottom: number; left: number };
    }[] = [];
    const parentBounds = this.node!.getBoundingClientRect();
    const relativePoint = { x: x - parentBounds.left, y: y - parentBounds.top };

    for (const child of this.node!.children) {
      const bounds = child.getBoundingClientRect();
      let c = {
        el: child as HTMLElement,
        distance: -1,
        bounds: {
          top: bounds.top - parentBounds.top,
          right: bounds.right - parentBounds.left,
          bottom: bounds.bottom - parentBounds.top,
          left: bounds.left - parentBounds.left
        }
      };
      // NOTE: We don't use Math.abs here, as we want to retain the sign
      // to know if the point is above or below the child.
      switch (this.axis) {
        case "horizontal":
          c.distance = (c.bounds.left + c.bounds.right) / 2 - relativePoint.x;
          break;
        case "vertical":
          c.distance = (c.bounds.top + c.bounds.bottom) / 2 - relativePoint.y;
          break;
      }
      childs.push(c);
    }
    // FIX: First el, cannot insert before?

    const closestChild = childs.reduce((prev, curr) => {
      if (prev === null) return curr;
      if (Math.abs(curr.distance) < Math.abs(prev.distance)) return curr;
      return prev;
    });
    const closestChildIndex = Array.from(closestChild.el.parentNode!.children).indexOf(
      closestChild.el
    );
    const closestAdjusted = closestChild.distance > 0 ? closestChildIndex : closestChildIndex + 1;
    if (Math.abs(closestChild.distance) < this.dragDeadzone) return undefined;

    return closestAdjusted;
  }

  /// === EVENT HANDLERS

  protected override onDragEnter(drag: DragOperation, e: DragEvent) {
    for (const child of Array.from(this.node!.children) as Array<HTMLElement>) {
      this.styleCache.cacheMany(child, {
        transition: child.style.transition,
        transform: child.style.transform,
        margin: child.style.margin
      });
    }
    super.onDragEnter(drag, e);
  }

  protected override onDragLeave(drag: DragOperation, e: DragEvent) {
    //document.startViewTransition(() => {
    for (const child of Array.from(this.node!.children) as Array<HTMLElement>) {
      this.styleCache.applyAll(child);
    }
    //	});
    super.onDragLeave(drag, e);
  }

  protected override onDragOver(drag: DragOperation, e: DragEvent) {
    const index = this.getIndexAtPoint(e.clientX, e.clientY);
    //if (this.lastIndex === index) return;
    drag.index = index;
    this.lastIndex = index;

    const ITEM_SIZE = this.axis === "vertical" ? this.childDomSize?.h : this.childDomSize?.w;
    if (ITEM_SIZE === undefined) return;
    const AXIS_DIR_PREV = this.axis === "vertical" ? "bottom" : "right";
    const AXIS_DIR_NEXT = this.axis === "vertical" ? "top" : "left";
    const childs = this.node!.children; //Array.from(this.node!.children) as Array<HTMLElement>;
    for (const child of childs) {
      child.style.transition = `margin 0.15s ease-out`; // TODO: Customize
      (child as HTMLElement).style.removeProperty(`margin-${AXIS_DIR_PREV}`);
      (child as HTMLElement).style.removeProperty(`margin-${AXIS_DIR_NEXT}`);

      if (index === undefined) continue;
      const childIdx = Array.from(child.parentNode!.children).indexOf(child);
      if (childIdx === index - 1) {
        (child as HTMLElement).style.setProperty(`margin-${AXIS_DIR_PREV}`, `${ITEM_SIZE}px`);
      } else if (childIdx === index) {
        (child as HTMLElement).style.setProperty(`margin-${AXIS_DIR_NEXT}`, `${ITEM_SIZE}px`);
      }
    }

    super.onDragOver(drag, e);
  }

  protected override onDrop(drag: DragOperation, e: DragEvent) {
    for (const child of Array.from(this.node!.children) as Array<HTMLElement>) {
      this.styleCache.applyAll(child);
    }
    //const index = this.getIndexAtPoint(e.clientX, e.clientY);
    //drag.index = index;
    drag.index = this.lastIndex;
    //this.lastIndex = 0;
    //super.onDrop(drag, e);

    this.isDropTarget = false;

    const event =
      drag.data instanceof DataTransfer
        ? new IndexedDragculaNativeDragEvent("Drop", e, drag, drag.index)
        : new IndexedDragculaCustomDragEvent("Drop", e, drag, drag.index);
    this.node!.dispatchEvent(event);
  }

  /// === ACTION

  static override action<P extends AxisDragZoneActionProps, A extends AxisDragZoneActionAttributes>(
    node: HTMLElement,
    props: P
  ): ActionReturn<P, A> {
    const controller = DRAG_ZONES.get(props.id) || props.controller || new this(props.id);
    controller.attach(node);
    props.acceptDrag && (controller.acceptDrag = props.acceptDrag);

    return {
      update: (props: P) => {
        console.trace(`[Dragcula::Z-${controller.id}] Updated props`, props);
        props.acceptDrag && (controller.acceptDrag = props.acceptDrag);
        controller.applyNodeAttributes();
      },
      destroy: () => {
        controller.detach();
      }
    };
  }
}
