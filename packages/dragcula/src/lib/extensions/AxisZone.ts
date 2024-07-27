/*import { createStyleCache, DEBUG, DRAG_ZONES, DragZone, IndexedDragculaCustomDragEvent, IndexedDragculaNativeDragEvent, type DragOperation, type DragZoneActionAttributes, type DragZoneActionProps, type IndexedDragculaDragEvent } from "$lib/index.js";*/
import {
  createStyleCache,
  DragculaDragEvent,
  HTMLDragZone,
  type DragOperation
} from "$lib/index.js";
import { ACTIVE_DRAG_OPERATION } from "$lib/internal.js";
import { tick } from "svelte";
import type { ActionReturn } from "svelte/action";
import { get } from "svelte/store";

// TODO: dragDeadzone should be percentage -> cal for each element -> if element sizes differe, 0 = only otuside element, inside element is strict, 100% no deadzone inside element

export type Axis = "horizontal" | "vertical";

/*export interface AxisDragZoneActionProps extends DragZoneActionProps { }

export interface AxisDragZoneActionAttributes extends DragZoneActionAttributes<IndexedDragculaDragEvent> {
	axis?: Axis;
	dragdeadzone?: number;

	'on:DragEnter'?: (e: IndexedDragculaDragEvent) => void,
	'on:DragOver'?: (e: IndexedDragculaDragEvent) => void,
	'on:DragLeave'?: (e: IndexedDragculaDragEvent) => void,
	'on:DragEnd'?: (e: IndexedDragculaDragEvent) => void,
	'on:Drop'?: (e: IndexedDragculaDragEvent) => void

}*/

export class HTMLAxisDragZone extends HTMLDragZone {
  /// === CONFIG

  protected axis: Axis = "vertical";
  protected dragDeadzone: number = 0;

  /// === STATE

  protected styles = createStyleCache();

  protected lastIndex: number | undefined = undefined;

  /// === CONSTRUCTOR

  constructor(node: HTMLElement, props: { id?: string }) {
    super(node, props);
  }

  static override action(node: HTMLElement, props: { id?: string }) {
    const controller = new this(node, props);

    return {
      destroy() {
        controller.destroy();
      },
      updated(props: any) {}
    };
  }

  /*override applyNodeAttributes() {
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
	}*/

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

  override onDragEnter(drag: DragOperation) {
    console.error("ENTER");
    for (const child of Array.from(this.node!.children) as Array<HTMLElement>) {
      this.styles.cacheMany(child, {
        transition: child.style.transition,
        transform: child.style.transform,
        margin: child.style.margin
      });
    }
    return super.onDragEnter(drag);
  }

  override onDragLeave(drag: DragOperation) {
    console.error("LEAVE");
    //document.startViewTransition(() => {
    for (const child of Array.from(this.node!.children) as Array<HTMLElement>) {
      this.styles.applyAll(child);
    }
    //	});
    super.onDragLeave(drag);
  }

  protected override _handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.debug(`[HTMLAxisDragZone::${this.id}] DragOver`, e);
    // TODO: What if null?

    const index = this.getIndexAtPoint(e.clientX, e.clientY);
    this.lastIndex = index;
    //if (this.lastIndex === index) return;
    const drag = get(ACTIVE_DRAG_OPERATION);

    // TODO: ENABLE const ITEM_SIZE = this.axis === "vertical" ? this.childDomSize?.h : this.childDomSize?.w;
    const ITEM_SIZE = 20;
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

    return super.onDragOver(drag);
  }

  protected override async _handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.debug(`[HTMLAxisDragZone::${this.id}] Drop`, e);

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

    for (const child of Array.from(this.node!.children) as Array<HTMLElement>) {
      this.styles.applyAll(child);
    }

    // TODO: Possibly wrap in try catch & set completed based on that?
    const completed = this.node.dispatchEvent(
      new DragculaDragEvent("Drop", {
        id: drag.id,
        item: drag.item,
        from: drag.from || undefined,
        to: drag.to || undefined,
        index: this.lastIndex
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
  }
}
