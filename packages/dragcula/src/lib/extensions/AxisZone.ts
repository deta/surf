/*import { type ActionReturn } from "svelte/action";
import { DragZone, IndexedDragculaDragEvent, createStyleCache } from "../index.js";
import { DragOperation, DragZoneActionAttributes, DragZoneActionProps, IndexedDragOperation } from "../types.js";*/

import { DragZone } from "../controllers.js";
import { createStyleCache } from "../utils.js";
import type { DragOperation, DragZoneActionAttributes, DragZoneActionProps } from "../types.js";
import type { ActionReturn } from "svelte/action";
import { IndexedDragculaDragEvent, type IndexedDragOperation } from "../index.js";

export type Axis = "vertical" | "horizontal";

export interface AxisDragZoneActionProps extends DragZoneActionProps {}
export interface AxisDragZoneActionAttributes extends DragZoneActionAttributes {
  axis?: Axis;

  //dropMargin?: number;

  /// DOM Events
  "on:DragEnter"?: (e: IndexedDragculaDragEvent) => void;
  "on:DragOver"?: (e: IndexedDragculaDragEvent) => void;
  "on:DragLeave"?: (e: IndexedDragculaDragEvent) => void;
  "on:Drop"?: (e: IndexedDragculaDragEvent) => void;
}

// TODO: Dont fully override existing child margins if any.
export class AxisDragZone extends DragZone {
  protected styleCache = createStyleCache();

  axis: Axis = "vertical";
  dropDeadZone: number = 5;
  lastIndex: number | undefined = undefined;

  get childsLength() {
    return this.node!.children.length;
  }
  get childSize(): number | undefined {
    switch (this.axis) {
      case "vertical":
        return this.node!.children[0]?.clientHeight || undefined;
      case "horizontal":
        return this.node!.children[0]?.clientWidth || undefined;
    }
  }

  constructor(id?: string) {
    super(id);
  }

  override attach(node: HTMLElement) {
    super.attach(node);

    switch (this.node!.getAttribute("axis")) {
      case "horizontal":
        this.axis = "horizontal";
        break;
      case "vertical":
        this.axis = "vertical";
        break;
    }
    console.warn("axis", this.axis);
  }

  /// === UTILS

  /// Returns the index of a imaginary child element at the given point.
  /// NOTE: Returns undefined if no index (e.g. over other element with margin set TODO: Explain)
  getIndexAtPoint(x: number, y: number): number | undefined {
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
    if (Math.abs(closestChild.distance) < this.dropDeadZone) return undefined;

    return closestAdjusted;
  }

  /// === EVENTS

  override onDragEnter(drag: DragOperation, e: DragEvent) {
    for (const child of Array.from(this.node!.children) as Array<HTMLElement>) {
      this.styleCache.cacheMany(child, {
        transition: child.style.transition,
        transform: child.style.transform,
        margin: child.style.margin
      });
    }
    super.onDragEnter(drag, e);
    // TODO: Check & set index
  }

  override async onDragLeave(drag: DragOperation, e: DragEvent) {
    for (const child of Array.from(this.node!.children) as Array<HTMLElement>) {
      this.styleCache.applyAll(child);
    }
    super.onDragLeave(drag, e);
    // TODO: Check & set index
  }

  override onDragOver(drag: IndexedDragOperation, e: DragEvent) {
    super.onDragOver(drag, e);

    const index = this.getIndexAtPoint(e.clientX, e.clientY);
    //if (this.lastIndex === index) return;
    drag.index = index;
    this.lastIndex = index;

    const ITEM_SIZE = this.axis === "vertical" ? this.itemDomSize?.h : this.itemDomSize?.w;
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
  }

  override onDrop(drag: IndexedDragOperation, e: DragEvent) {
    for (const child of Array.from(this.node!.children) as Array<HTMLElement>) {
      this.styleCache.applyAll(child);
    }
    //const index = this.getIndexAtPoint(e.clientX, e.clientY);
    //drag.index = index;
    drag.index = this.lastIndex;
    //this.lastIndex = 0;
    super.onDrop(drag, e);
  }

  /// === ACTION

  static override action(
    node: HTMLElement,
    props: AxisDragZoneActionProps
  ): ActionReturn<AxisDragZoneActionProps, AxisDragZoneActionAttributes> {
    const controller = props.controller || new this(props.id);
    controller.attach(node);

    // TODO: Even better typing or something

    controller.on("drop", (drag: IndexedDragOperation, e: MouseEvent) => {
      node.dispatchEvent(new IndexedDragculaDragEvent("Drop", e, drag, drag.data, drag.index));
    });
    controller.on("dragenter", (drag: IndexedDragOperation, e: MouseEvent) => {
      node.dispatchEvent(new IndexedDragculaDragEvent("DragEnter", e, drag, drag.data, drag.index));
    });
    controller.on("dragover", (drag: IndexedDragOperation, e: MouseEvent) => {
      node.dispatchEvent(new IndexedDragculaDragEvent("DragOver", e, drag, drag.data, drag.index));
    });
    controller.on("dragleave", (drag: IndexedDragOperation, e: MouseEvent) => {
      node.dispatchEvent(new IndexedDragculaDragEvent("DragLeave", e, drag, drag.data, drag.index));
    });

    if (props.removeItem) controller.removeItem = props.removeItem;

    return {
      update(props: any) {
        console.log("updated axis zone", props, node.attributes);
      },

      destroy() {
        controller.detach();
      }
    };
  }
}
