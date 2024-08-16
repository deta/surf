import { HTMLDragZone } from "$lib/DragZone.js";
import { DragculaDragEvent, type DragOperation } from "$lib/index.js";
import { MOUSE_POS } from "$lib/internal.js";

export type Axis = "horizontal" | "vertical";

export class HTMLAxisDragZone extends HTMLDragZone {
  protected axis: Axis = "vertical";
  protected dragDeadzone: number = 0;

  get children() {
    return Array.from(this.element.children).filter(
      (el) => el.hasAttribute("data-dragcula-item") && !el.hasAttribute("data-dragging-item-source")
    );
  }

  /// === STATE
  protected raf: number | null = null;

  protected lastIndex: number | undefined;

  #showDropIndicator = false;
  #dropIndicator: HTMLElement | null = null;
  #dropIndicatorOffset: number = 0;
  #childrenCache: { el: HTMLElement; rect: DOMRect }[] = [];
  get showDropIndicator() {
    return this.#showDropIndicator;
  }
  set showDropIndicator(v: boolean) {
    this.#showDropIndicator = v;
    if (v) {
      if (this.#dropIndicator !== null) {
        this.#dropIndicator.remove();
        this.#dropIndicator = null;
      }
      this.element.style.position = "relative";
      this.#dropIndicator = document.createElement("div");
      this.#dropIndicator.classList.add("dragcula-drop-indicator");
      this.#dropIndicator.classList.add(`dragcula-axis-${this.axis}`);
      this.#dropIndicator.style.position = "absolute";
      this.#dropIndicator.style.zIndex = "2147483647";
      if (this.axis === "vertical") {
        this.#dropIndicator.style.top = `${this.#dropIndicatorOffset}px`;
      } else if (this.axis === "horizontal") {
        this.#dropIndicator.style.left = `${this.#dropIndicatorOffset}px`;
      }
      this.element.appendChild(this.#dropIndicator);
    } else {
      this.#childrenCache = [];
      this.#dropIndicator?.remove();
      this.#dropIndicator = null;
    }
  }

  /// === CONSTRUCTOR

  constructor(node: HTMLElement, props: { id?: string; effectsAllowed?: DragEffect[] }) {
    super(node, props);
    this.applyDomAttributes();
  }

  override applyDomAttributes() {
    super.applyDomAttributes();

    switch (this.element.getAttribute("axis")) {
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

    // TODO: CFG
  }

  protected getIndexAtPoint(x: number, y: number): [number, number] | [undefined, undefined] {
    if (this.children.length <= 0) return [0, 0];

    const containerScroll = { x: this.element.scrollLeft, y: this.element.scrollTop };
    const containerRect = this.element.getBoundingClientRect();
    const relativePoint = {
      x: x - containerRect.left + containerScroll.x,
      y: y - containerRect.top + containerScroll.y
    };

    // From center to center -> issue dragging upwards
    const distances = this.#childrenCache.map((child) => {
      let center: number = 0;
      if (this.axis === "horizontal") {
        center = child.rect.x + containerScroll.x + child.rect.width / 2;
        return { el: child.el, dist: center - relativePoint.x };
      } else if (this.axis === "vertical") {
        center = child.rect.y + containerScroll.y + child.rect.height / 2;
        return { el: child.el, dist: center - relativePoint.y };
      }
    });

    const closestElement = distances.reduce(
      (acc, curr) => {
        if (Math.abs(curr.dist) < Math.abs(acc.dist)) {
          return curr;
        }
        return acc;
      },
      { el: null, dist: Infinity }
    );

    if (closestElement?.el == null) return [undefined, undefined];

    // Find target index of relativePoint
    /*	const targetIndex = this.#childrenCache.findIndex((child) => {
				if (this.axis === "horizontal") {
					return relativePoint.x >= child.rect.x && relativePoint.x <= child.rect.right;
				}
				else if (this.axis === "vertical") {
					return relativePoint.y >= child.rect.y && relativePoint.y <= child.rect.y + child.rect.height;
				}
			})*/

    let targetIndex = this.#childrenCache.findIndex((child) => child.el === closestElement.el);

    if (Math.sign(closestElement.dist) < 0) targetIndex++;

    console.warn(targetIndex);
    if (targetIndex === -1) return [undefined, undefined];
    return [targetIndex, closestElement.dist];
    console.warn(this.#childrenCache[targetIndex]);

    const targetEl = this.#childrenCache[targetIndex];
    const distanceFromTargetIndexElement =
      targetEl.rect[this.axis === "horizontal" ? "x" : "y"] +
      targetEl.rect[this.axis === "horizontal" ? "width" : "height"] / 2 -
      relativePoint[this.axis === "horizontal" ? "x" : "y"] +
      containerScroll[this.axis === "horizontal" ? "x" : "y"];

    //if (closestElement == null) return undefined;

    let index = targetIndex; // this.#childrenCache.findIndex((child) => child.el === closestElement);
    //console.log("Closest", index, closestElement?.dist, closestElement?.el.innerHTML);
    /*if (closestElement.dist < 0 && this.#childrenCache[index].el === closestElement.el) {
			index++;
		}*/

    return index === undefined ? [undefined, undefined] : [index, distanceFromTargetIndexElement];
  }

  /// === EVENTS

  override onDragEnter(drag?: DragOperation): Promise<boolean> {
    this.showDropIndicator = true;
    this.#childrenCache = [];
    const containerBounds = this.element.getBoundingClientRect();
    for (const child of this.children) {
      const rect = child.getBoundingClientRect();
      this.#childrenCache.push({
        el: child,
        rect: {
          x: rect.x - containerBounds.x,
          y: rect.y - containerBounds.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left
        }
      });
    }
    return super.onDragEnter(drag);
  }

  override onDragLeave(drag?: DragOperation) {
    this.showDropIndicator = false;
    this.#childrenCache = [];
    super.onDragLeave(drag);
  }

  override onDragOver(drag?: DragOperation) {
    const [index, distance] = this.getIndexAtPoint(MOUSE_POS.x, MOUSE_POS.y);

    console.log("Index", index, distance);

    if (index !== undefined && index !== this.lastIndex) {
      drag.index = index;

      const containerScroll = { x: this.element.scrollLeft, y: this.element.scrollTop };
      const containerBounds = this.element.getBoundingClientRect();

      // EDGE CAES
      this.#dropIndicatorOffset = 0;
      if (index <= 0) {
        if (this.#childrenCache.length <= 0) {
        } else {
          const firstChild = this.#childrenCache[0];
          if (this.axis === "horizontal")
            this.#dropIndicatorOffset = firstChild.rect.left - containerBounds.x;
          else if (this.axis === "vertical")
            this.#dropIndicatorOffset = firstChild.rect.top - containerBounds.y;
        }
      } else if (index >= this.#childrenCache.length) {
        const lastChild = this.#childrenCache[this.#childrenCache.length - 1];
        if (this.axis === "horizontal")
          this.#dropIndicatorOffset = lastChild.rect.right - containerBounds.x;
        else if (this.axis === "vertical")
          this.#dropIndicatorOffset = lastChild.rect.bottom - containerBounds.y;
      } else {
        const targetChild = this.#childrenCache[index];

        if (!targetChild) {
          this.#dropIndicatorOffset =
            this.#childrenCache[this.#childrenCache.length - 1].rect.right - containerBounds.x;
          if (this.axis === "horizontal")
            this.#dropIndicatorOffset =
              this.#childrenCache[this.#childrenCache.length - 1].rect.right - containerBounds.x;
          else if (this.axis === "vertical")
            this.#dropIndicatorOffset =
              this.#childrenCache[this.#childrenCache.length - 1].rect.bottom - containerBounds.y;
        } else {
          const prevChild = index > 0 ? this.#childrenCache[index - 1] : null;
          if (this.axis === "horizontal") {
            const gapToPrev = prevChild
              ? targetChild.rect.left - this.#childrenCache[index - 1].rect.right
              : 0;
            this.#dropIndicatorOffset = targetChild.rect.x - gapToPrev / 2;
          } else if (this.axis === "vertical") {
            const gapToPrev = prevChild
              ? targetChild.rect.top - this.#childrenCache[index - 1].rect.bottom
              : 0;
            this.#dropIndicatorOffset = targetChild.rect.y - gapToPrev / 2;
          }
        }
      }
      if (this.axis === "horizontal") this.#dropIndicatorOffset += containerScroll.x;
      else if (this.axis === "vertical") this.#dropIndicatorOffset += containerScroll.y;

      if (this.raf === null)
        requestAnimationFrame(
          (() => {
            if (!this.#dropIndicator) {
              this.raf = null;
              return;
            }
            if (this.axis === "vertical") {
              this.#dropIndicator.style.top = `${this.#dropIndicatorOffset}px`;
            } else if (this.axis === "horizontal") {
              this.#dropIndicator.style.left = `${this.#dropIndicatorOffset}px`;
            }
            this.raf = null;
          }).bind(this)
        );
    }
    this.lastIndex = index;
  }

  override onDrop(drag?: DragOperation) {
    this.showDropIndicator = false;
    return super.onDrop(drag);
  }
}
