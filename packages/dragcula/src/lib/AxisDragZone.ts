import type { ActionReturn } from "svelte/action";
import { HTMLDragZone, type HTMLDragZoneAttributes, type HTMLDragZoneProps } from "./DragZone.js";
import { HTMLDragItem, type DragOperation } from "./index.js";
import { Dragcula } from "./Dragcula.js";
import type { DropPosition } from "./types.type.js";

export type Axis = "horizontal" | "vertical" | "both";

export interface HTMLAxisDragZoneAttributes extends HTMLDragZoneAttributes {
  axis: Axis;
  dragDeadzone?: number;
}

/**
 * NOTE: All dom updates are done in the raf cbk, so we avoid layout thrashing!
 */
export class HTMLAxisDragZone extends HTMLDragZone {
  protected override get prefix(): string {
    return `\x1B[40;97m[AxisDragZone::${this.id}]\x1B[m`;
  }

  protected axis: Axis = "horizontal";
  protected dragDeadzone: number = 0;

  // === STATE

  #raf: number | null = null;
  #indicatorVisible = false;
  #indicatorEl: HTMLElement | null = null;
  #indicatorOffsetTop: number = 0;
  #indicatorOffsetLeft: number = 0;

  // Store pos to only check inside raf!
  #mousePos: { x: number; y: number } = { x: 0, y: 0 };
  #childrenCache: { el: HTMLElement; rect: DOMRect }[] = [];
  #containerCache: DOMRect | null = null;

  #lastIndex: number | null = null;
  #lastDropPosition: DropPosition | null = null;

  constructor(node: HTMLElement, props?: HTMLDragZoneProps) {
    super(node, props);
    this.configureFromDOMAttributes();
  }

  override configureFromDOMAttributes() {
    super.configureFromDOMAttributes();

    switch (this.element.getAttribute("axis")) {
      case "horizontal":
        this.axis = "horizontal";
        break;
      case "vertical":
        this.axis = "vertical";
        break;
      case "both":
        this.axis = "both";
        break;
      default:
        this.axis = "vertical";
        break;
    }

    // TODO: other
  }

  static override action(
    node: HTMLElement,
    props: HTMLDragZoneProps
  ): ActionReturn<HTMLDragZoneProps, HTMLAxisDragZoneAttributes> {
    const zone = new this(node, props);

    return {
      destroy() {
        zone.destroy();
      },
      update() {
        zone.configureFromDOMAttributes();
      }
    };
  }

  /// Returns index of child element at position, distance to it, and drop position.
  protected getIndexAtPoint(
    x: number,
    y: number
  ): [number, number, DropPosition] | [undefined, undefined, undefined] {
    if (this.#childrenCache.length <= 0) return [0, 0, "before"];
    if (this.#containerCache === null) this.#containerCache = this.element.getBoundingClientRect();

    const containerScroll = { x: this.element.scrollLeft, y: this.element.scrollTop };
    const relativePoint = {
      x: x - this.#containerCache.left + containerScroll.x,
      y: y - this.#containerCache.top + containerScroll.y
    };

    if (this.axis === "both") {
      // For "both" axis (grid layout), we need a different approach

      // First, check if we're before the first item
      const firstChild = this.#childrenCache[0];
      if (
        firstChild &&
        (relativePoint.x < firstChild.rect.x ||
          (relativePoint.x < firstChild.rect.x + firstChild.rect.width &&
            relativePoint.y < firstChild.rect.y))
      ) {
        return [0, 0, "before"];
      }

      // Check if we're after the last item
      const lastChild = this.#childrenCache[this.#childrenCache.length - 1];
      if (
        lastChild &&
        (relativePoint.y > lastChild.rect.y + lastChild.rect.height ||
          (relativePoint.x > lastChild.rect.x + lastChild.rect.width &&
            relativePoint.y > lastChild.rect.y))
      ) {
        return [this.#childrenCache.length, 0, "after"];
      }

      // Find the item we're hovering over or closest to
      for (let i = 0; i < this.#childrenCache.length; i++) {
        const child = this.#childrenCache[i];
        const nextChild = i < this.#childrenCache.length - 1 ? this.#childrenCache[i + 1] : null;

        // Check if we're inside this item's bounds
        if (
          relativePoint.x >= child.rect.x &&
          relativePoint.x <= child.rect.x + child.rect.width &&
          relativePoint.y >= child.rect.y &&
          relativePoint.y <= child.rect.y + child.rect.height
        ) {
          // We're inside this item - determine if we're in the left or right half
          const midX = child.rect.x + child.rect.width / 2;
          if (relativePoint.x < midX) {
            return [i, 0, "before"]; // Left half - insert at this index
          } else {
            return [i + 1, 0, "after"]; // Right half - insert after this index
          }
        }

        // Check if we're between this item and the next one horizontally
        // (in the same row)
        if (
          nextChild &&
          Math.abs(child.rect.y - nextChild.rect.y) < 10 && // Same row (with small tolerance)
          relativePoint.x > child.rect.x + child.rect.width &&
          relativePoint.x < nextChild.rect.x &&
          relativePoint.y >= child.rect.y &&
          relativePoint.y <= child.rect.y + child.rect.height
        ) {
          return [i + 1, 0, "after"]; // Between items horizontally
        }

        // Check if we're between rows
        if (i < this.#childrenCache.length - 1) {
          const nextRowStart = this.#childrenCache
            .slice(i + 1)
            .find((c) => c.rect.y > child.rect.y + child.rect.height);

          if (
            nextRowStart &&
            relativePoint.y > child.rect.y + child.rect.height &&
            relativePoint.y < nextRowStart.rect.y
          ) {
            // Find the correct horizontal position
            const rowEndIndex = this.#childrenCache.indexOf(nextRowStart);
            for (let j = i; j < rowEndIndex; j++) {
              if (
                relativePoint.x <=
                this.#childrenCache[j].rect.x + this.#childrenCache[j].rect.width
              ) {
                return [j + 1, 0, "after"]; // Insert after this item in the row
              }
            }
            return [rowEndIndex, 0, "before"]; // Insert at the start of the next row
          }
        }
      }

      // If we got here, find the closest item by distance
      let closestIndex = 0;
      let closestDistance = Infinity;

      for (let i = 0; i < this.#childrenCache.length; i++) {
        const child = this.#childrenCache[i];
        const childCenterX = child.rect.x + child.rect.width / 2;
        const childCenterY = child.rect.y + child.rect.height / 2;

        const distance = Math.sqrt(
          Math.pow(childCenterX - relativePoint.x, 2) + Math.pow(childCenterY - relativePoint.y, 2)
        );

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }

      // Check if we should insert before or after the closest item
      const closestChild = this.#childrenCache[closestIndex];
      const childCenterX = closestChild.rect.x + closestChild.rect.width / 2;
      return [
        relativePoint.x < childCenterX ? closestIndex : closestIndex + 1,
        closestDistance,
        relativePoint.x < childCenterX ? "before" : "after"
      ];
    } else if (this.axis === "horizontal") {
      // Improved algorithm: check if mouse is within element bounds first, then use edges for better precision
      for (let i = 0; i < this.#childrenCache.length; i++) {
        const child = this.#childrenCache[i];
        const childLeft = child.rect.x + containerScroll.x;
        const childRight = childLeft + child.rect.width;

        // Check if mouse is within this element's bounds
        if (relativePoint.x >= childLeft && relativePoint.x <= childRight) {
          const childCenter = childLeft + child.rect.width / 2;
          if (relativePoint.x < childCenter) {
            // Mouse in left half - insert before this element
            return [i, 0, "before"];
          } else {
            // Mouse in right half - insert after this element
            return [i + 1, 0, "after"];
          }
        }
      }

      // If not within any element, find the closest edge (not center)
      let closestIndex = 0;
      let closestDistance = Infinity;
      let closestPosition: DropPosition = "before";

      for (let i = 0; i < this.#childrenCache.length; i++) {
        const child = this.#childrenCache[i];
        const childLeft = child.rect.x + containerScroll.x;
        const childRight = childLeft + child.rect.width;

        // Distance to left edge
        const distToLeft = Math.abs(childLeft - relativePoint.x);
        if (distToLeft < closestDistance) {
          closestDistance = distToLeft;
          closestIndex = i;
          closestPosition = "before";
        }

        // Distance to right edge
        const distToRight = Math.abs(childRight - relativePoint.x);
        if (distToRight < closestDistance) {
          closestDistance = distToRight;
          closestIndex = i + 1;
          closestPosition = "after";
        }
      }

      return [closestIndex, closestDistance, closestPosition];
    } else if (this.axis === "vertical") {
      // From center to center
      const distances = this.#childrenCache.map((child) => {
        const center = child.rect.y + containerScroll.y + child.rect.height / 2;
        return { el: child.el, dist: center - relativePoint.y };
      });

      const closestElement = distances.reduce(
        (acc, curr) => {
          if (Math.abs(curr?.dist ?? Infinity) < Math.abs(acc.dist)) {
            return curr;
          }
          return acc;
        },
        { el: null, dist: Infinity }
      );

      if (closestElement?.el == null) return [undefined, undefined, undefined];

      let targetIndex = this.#childrenCache.findIndex((child) => child.el === closestElement.el);
      const dropPosition: DropPosition = Math.sign(closestElement.dist) < 0 ? "after" : "before";
      if (Math.sign(closestElement.dist) < 0) targetIndex++;

      if (targetIndex === -1) return [undefined, undefined, undefined];
      return [targetIndex, closestElement.dist, dropPosition];
    }

    return [undefined, undefined, undefined];
  }

  /**
   * Check if the drop indicator should be shown at the given index
   */
  protected shouldShowIndicatorAtIndex(index: number | undefined): boolean {
    if (index === undefined) return false;

    const activeDrag = Dragcula.get().activeDrag;
    if (!activeDrag) return false;

    // Temporarily modify index to test acceptance, then restore
    const originalIndex = activeDrag.index;
    activeDrag.index = index;

    const isAccepted = this.acceptsCbk(activeDrag);

    // Always restore original index
    activeDrag.index = originalIndex;

    return isAccepted;
  }

  protected boundRafCbk = this.rafCbk.bind(this);
  protected rafCbk() {
    // Query DOM
    const [index, distance, dropPosition] = this.getIndexAtPoint(
      this.#mousePos.x,
      this.#mousePos.y
    );

    // Check if the indicator should be shown based on accepts callback
    const shouldShowIndicator = this.shouldShowIndicatorAtIndex(index);
    if (!shouldShowIndicator) {
      this.#indicatorVisible = false;
      if (this.#raf === null) requestAnimationFrame(this.boundRafCbk);
      return;
    }

    if (
      index !== undefined &&
      (index !== this.#lastIndex || dropPosition !== this.#lastDropPosition)
    ) {
      if (this.#containerCache === null)
        this.#containerCache = this.element.getBoundingClientRect();
      const containerScroll = { x: this.element.scrollLeft, y: this.element.scrollTop };

      // Calc offset
      this.#indicatorOffsetLeft = 0;
      this.#indicatorOffsetTop = 0;

      if (index <= 0) {
        // Before the first item
        if (this.#childrenCache.length <= 0) {
          // Empty container
          this.#indicatorOffsetLeft = 0;
          this.#indicatorOffsetTop = 0;
        } else {
          const firstChild = this.#childrenCache[0];
          if (this.axis === "horizontal") {
            this.#indicatorOffsetLeft = firstChild.rect.left - this.#containerCache.x;
          } else if (this.axis === "vertical") {
            this.#indicatorOffsetTop = firstChild.rect.top - this.#containerCache.y;
          } else if (this.axis === "both") {
            this.#indicatorOffsetLeft = firstChild.rect.left - this.#containerCache.x;
            // Position vertically centered on the row for the "both" axis
            this.#indicatorOffsetTop =
              firstChild.rect.top + firstChild.rect.height / 2 - this.#containerCache.y;
          }
        }
      } else if (index >= this.#childrenCache.length) {
        // After the last item
        const lastChild = this.#childrenCache[this.#childrenCache.length - 1];
        if (this.axis === "horizontal") {
          this.#indicatorOffsetLeft = lastChild.rect.right - this.#containerCache.x;
        } else if (this.axis === "vertical") {
          this.#indicatorOffsetTop = lastChild.rect.bottom - this.#containerCache.y;
        } else if (this.axis === "both") {
          // For grid layout, position after the last item
          this.#indicatorOffsetLeft = lastChild.rect.right - this.#containerCache.x;
          this.#indicatorOffsetTop =
            lastChild.rect.top + lastChild.rect.height / 2 - this.#containerCache.y;
        }
      } else {
        // Between items
        const currentChild = this.#childrenCache[index - 1];
        const nextChild = this.#childrenCache[index];

        if (!currentChild || !nextChild) {
          if (this.axis === "horizontal") {
            this.#indicatorOffsetLeft =
              this.#childrenCache[this.#childrenCache.length - 1].rect.right -
              this.#containerCache.x;
          } else if (this.axis === "vertical") {
            this.#indicatorOffsetTop =
              this.#childrenCache[this.#childrenCache.length - 1].rect.bottom -
              this.#containerCache.y;
          } else if (this.axis === "both") {
            this.#indicatorOffsetLeft =
              this.#childrenCache[this.#childrenCache.length - 1].rect.right -
              this.#containerCache.x;
            this.#indicatorOffsetTop =
              this.#childrenCache[this.#childrenCache.length - 1].rect.bottom -
              this.#containerCache.y;
          }
        } else {
          if (this.axis === "horizontal") {
            // Position in the gap between items
            const gap = nextChild.rect.left - currentChild.rect.right;
            this.#indicatorOffsetLeft = currentChild.rect.right + gap / 2 - this.#containerCache.x;
          } else if (this.axis === "vertical") {
            // Position in the gap between items
            const gap = nextChild.rect.top - currentChild.rect.bottom;
            this.#indicatorOffsetTop = currentChild.rect.bottom + gap / 2 - this.#containerCache.y;
          } else if (this.axis === "both") {
            // For grid layout, we need to handle rows
            if (Math.abs(currentChild.rect.y - nextChild.rect.y) < 10) {
              // Same row - position horizontally between items
              const gap = nextChild.rect.left - currentChild.rect.right;
              this.#indicatorOffsetLeft =
                currentChild.rect.right + gap / 2 - this.#containerCache.x;
              this.#indicatorOffsetTop =
                currentChild.rect.top + currentChild.rect.height / 2 - this.#containerCache.y;
            } else {
              // Between rows - position at the start of the next row
              this.#indicatorOffsetLeft = nextChild.rect.left - this.#containerCache.x;

              // Always align with the next row's vertical midpoint, not between rows
              this.#indicatorOffsetTop =
                nextChild.rect.top + nextChild.rect.height / 2 - this.#containerCache.y;
            }
          }
        }
      }

      // Apply scroll offset
      if (this.axis === "horizontal") {
        this.#indicatorOffsetLeft += containerScroll.x;
      } else if (this.axis === "vertical") {
        this.#indicatorOffsetTop += containerScroll.y;
      } else if (this.axis === "both") {
        this.#indicatorOffsetTop += containerScroll.y;
        this.#indicatorOffsetLeft += containerScroll.x;
      }
    }

    // Apply DOM updates
    if (!this.#indicatorVisible && this.#indicatorEl !== null) {
      this.#indicatorEl.remove();
      this.#indicatorEl = null;
    } else if (this.#indicatorVisible && this.#indicatorEl === null) {
      this.element.style.position = "relative";
      this.#indicatorEl = document.createElement("div");
      this.#indicatorEl.classList.add("dragcula-drop-indicator");
      this.#indicatorEl.classList.add(`dragcula-axis-${this.axis}`);

      this.#indicatorEl.style.position = "absolute";
      this.#indicatorEl.style.zIndex = "2147483647";
      this.element.appendChild(this.#indicatorEl);
    }

    if (
      index !== undefined &&
      (this.#lastIndex !== index || this.#lastDropPosition !== dropPosition) &&
      this.#indicatorEl !== null
    ) {
      if (this.axis === "vertical") {
        this.#indicatorEl.style.top = `${this.#indicatorOffsetTop}px`;
      } else if (this.axis === "horizontal") {
        this.#indicatorEl.style.left = `${this.#indicatorOffsetLeft}px`;
      } else if (this.axis === "both") {
        this.#indicatorEl.style.left = `${this.#indicatorOffsetLeft}px`;
        this.#indicatorEl.style.top = `${this.#indicatorOffsetTop}px`;
      }

      // Add data attribute for visual debugging
      if (dropPosition) {
        this.#indicatorEl.setAttribute("data-drop-position", dropPosition);
      }

      this.#lastIndex = index;
      this.#lastDropPosition = dropPosition;
    }

    this.#raf = null;
  }

  // === EVENTS

  protected override onDragEnter(drag: DragOperation, e?: DragEvent) {
    if (e) this.#mousePos = { x: e.clientX, y: e.clientY };

    this.#containerCache = this.element.getBoundingClientRect();
    const children = Array.from(this.element.children).filter(
      (el) => el.hasAttribute("data-drag-item") && !el.hasAttribute("data-dragging-item")
    );

    this.#childrenCache = children.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        el: el as HTMLElement,
        rect: {
          x: rect.x - this.#containerCache!.x,
          y: rect.y - this.#containerCache!.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right
        } as DOMRect
      };
    });

    this.#indicatorVisible = true;
    if (this.#raf === null) requestAnimationFrame(this.boundRafCbk);

    this.rafCbk();

    super.onDragEnter(drag, e);
  }

  protected override onDragLeave(drag: DragOperation, e?: DragEvent) {
    if (e) this.#mousePos = { x: e.clientX, y: e.clientY };
    this.#indicatorVisible = false;
    this.#childrenCache = [];
    this.#containerCache = null;
    if (this.#raf === null) requestAnimationFrame(this.boundRafCbk);
    super.onDragLeave(drag, e);
  }

  protected override onDragOver(drag: DragOperation, e?: DragEvent) {
    if (!this.isTarget) return;
    if (e && (this.#mousePos.x !== e.clientX || this.#mousePos.y !== e.clientY)) {
      this.#mousePos = { x: e.clientX, y: e.clientY };
      if (this.#raf === null) requestAnimationFrame(this.boundRafCbk);
    }
    super.onDragOver(drag, e);
  }

  protected override async onDrop(drag: DragOperation, e: DragEvent) {
    if (e) this.#mousePos = { x: e.clientX, y: e.clientY };
    this.#indicatorVisible = false;
    this.#childrenCache = [];
    this.#containerCache = null;
    if (this.#raf === null) requestAnimationFrame(this.boundRafCbk);
    drag.index = this.#lastIndex;
    drag.dropPosition = this.#lastDropPosition;
    this.#lastIndex = null;
    this.#lastDropPosition = null;
    super.onDrop(drag, e);
  }
}
