import { get } from "svelte/store";
import { ACTIVE_DRAG, DragZone } from "./controllers.js";
import type { DragOperation, DragZoneActionAttributes, DragZoneActionProps } from "./types.js";
import { createStyleCache } from "./utils.js";
import { IndexedDragculaDragEvent, type IndexedDragOperation } from "./index.js";
import type { ActionReturn } from "svelte/action";

export interface HorizontalDragZoneActionProps extends DragZoneActionProps {}
export interface HorizontalDragZoneActionAttributes extends DragZoneActionAttributes {
  // dropMargin?: number

  "on:DragEnter"?: (e: IndexedDragculaDragEvent) => void;
  "on:DragOver"?: (e: IndexedDragculaDragEvent) => void;
  "on:DragLeave"?: (e: IndexedDragculaDragEvent) => void;
  "on:Drop"?: (e: IndexedDragculaDragEvent) => void;
}

// TODO: Adjust flex justify prop -> Centered need bit diff placeholder push logic.
export class HorizontalDragZone extends DragZone {
  protected styleCache = createStyleCache();

  get domItems() {
    return this.node!.children.length;
  }
  get domItemWidth(): number | undefined {
    return this.node!.children[0]?.clientWidth || undefined;
  }

  constructor(id?: string) {
    super(id);
  }

  override attach(node: HTMLElement) {
    super.attach(node);
  }

  /// === UTILS

  getIndexAtPoint(x: number, y: number) {
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
      c.distance = (c.bounds.left + c.bounds.right) / 2 - relativePoint.x;
      childs.push(c);
    }
    //console.log("index", ...childs.map(c => c.distance), relativePoint);
    // FIX: First el, cannot insert before

    const closestChild = childs.reduce((prev, curr) => {
      if (prev === null) return curr;
      if (Math.abs(curr.distance) < Math.abs(prev.distance)) return curr;
      return prev;
    });
    const closestChildIndex = Array.from(closestChild.el.parentNode!.children).indexOf(
      closestChild.el
    );
    const closestAdjusted = closestChild.distance > 0 ? closestChildIndex : closestChildIndex + 1;
    //console.log("index, closest", get(ACTIVE_DRAG), closestChild.el, closestAdjusted);

    return closestAdjusted;
  }

  /// === EVENTS

  override onDragEnter(drag: DragOperation, e: DragEvent) {
    for (const child of this.node!.children) {
      this.styleCache.cacheMany(child, {
        transition: child.style.transition,
        transform: child.style.transform
      });
    }
    super.onDragEnter(drag, e);
    // TODO: Check & set index
  }

  override onDragLeave(drag: DragOperation, e: DragEvent) {
    for (const child of this.node!.children) {
      this.styleCache.applyAll(child as HTMLElement);
    }
    super.onDragLeave(drag, e);
    // TODO: Check & set index
  }

  lastIndex = -1;
  override onDragOver(drag: IndexedDragOperation, e: DragEvent) {
    super.onDragOver(drag, e);

    const dropAtIndex = this.getIndexAtPoint(e.clientX, e.clientY);
    drag.index = dropAtIndex;
    this.lastIndex = dropAtIndex;

    for (const child of this.node!.children) {
      const childIdx = Array.from(child.parentNode!.children).indexOf(child);
      if (childIdx < dropAtIndex) {
        child.style.transform = "translateX(0)";
        continue;
      }

      child.style.transition = "transform 0.11s ease-in-out";
      child.style.transform = `translateX(${this.domItemWidth}px)`;
    }
  }

  override onDrop(drag: DragOperation, e: DragEvent) {
    for (const child of this.node!.children) {
      this.styleCache.applyAll(child as HTMLElement);
    }
    // TODO: Rename to dropAfterIndex
    drag.index = this.lastIndex;
    super.onDrop(drag, e);
  }

  static override action(
    node: HTMLElement,
    props: HorizontalDragZoneActionProps
  ): ActionReturn<HorizontalDragZoneActionProps, HorizontalDragZoneActionAttributes> {
    const controller = props.controller || new this(props.id);
    controller.attach(node);

    controller.on("drop", (drag: DragOperation, e: MouseEvent) => {
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
        console.log("updated horizonzsl zone", props);
      },

      destroy() {
        controller.detach();
      }
    };
  }
}
