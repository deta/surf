import type { ActionReturn } from "svelte/action";
import { HTMLDragZone, type HTMLDragZoneAttributes, type HTMLDragZoneProps } from "./DragZone.js";
import { HTMLDragItem, type DragOperation } from "./index.js";

export type Axis = "horizontal" | "vertical";

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
  #indicatorOffset: number = 0;

  // Store pos to only check inside raf!
  #mousePos: { x: number; y: number } = { x: 0, y: 0 };
  #childrenCache: { el: HTMLElement; rect: DOMRect }[] = [];
  #containerCache: DOMRect | null = null;

  #lastIndex: number | null = null;

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

  /// Returns index of child element at position and distance to it.
  protected getIndexAtPoint(x: number, y: number): [number, number] | [undefined, undefined] {
    if (this.#childrenCache.length <= 0) return [0, 0];
    if (this.#containerCache === null) this.#containerCache = this.element.getBoundingClientRect();

    const containerScroll = { x: this.element.scrollLeft, y: this.element.scrollTop };
    const relativePoint = {
      x: x - this.#containerCache.left + containerScroll.x,
      y: y - this.#containerCache.top + containerScroll.y
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
    // TODO: (old) remove
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

    if (targetIndex === -1) return [undefined, undefined];
    return [targetIndex, closestElement.dist];
  }

  protected boundRafCbk = this.rafCbk.bind(this);
  protected rafCbk() {
    // Query DOM
    const [index, distance] = this.getIndexAtPoint(this.#mousePos.x, this.#mousePos.y);

    if (index !== undefined && index !== this.#lastIndex) {
      if (this.#containerCache === null)
        this.#containerCache = this.element.getBoundingClientRect();
      const containerScroll = { x: this.element.scrollLeft, y: this.element.scrollTop };

      // Calc offset
      this.#indicatorOffset = 0;
      if (index <= 0) {
        if (this.#childrenCache.length <= 0) {
        } else {
          const firstChild = this.#childrenCache[0];
          if (this.axis === "horizontal")
            this.#indicatorOffset = firstChild.rect.left - this.#containerCache.x;
          else if (this.axis === "vertical")
            this.#indicatorOffset = firstChild.rect.top - this.#containerCache.y;
        }
      } else if (index >= this.#childrenCache.length) {
        const lastChild = this.#childrenCache[this.#childrenCache.length - 1];
        if (this.axis === "horizontal")
          this.#indicatorOffset = lastChild.rect.right - this.#containerCache.x;
        else if (this.axis === "vertical")
          this.#indicatorOffset = lastChild.rect.bottom - this.#containerCache.y;
      } else {
        const targetChild = this.#childrenCache[index];

        if (!targetChild) {
          this.#indicatorOffset =
            this.#childrenCache[this.#childrenCache.length - 1].rect.right - this.#containerCache.x;
          if (this.axis === "horizontal")
            this.#indicatorOffset =
              this.#childrenCache[this.#childrenCache.length - 1].rect.right -
              this.#containerCache.x;
          else if (this.axis === "vertical")
            this.#indicatorOffset =
              this.#childrenCache[this.#childrenCache.length - 1].rect.bottom -
              this.#containerCache.y;
        } else {
          const prevChild = index > 0 ? this.#childrenCache[index - 1] : null;
          if (this.axis === "horizontal") {
            const gapToPrev = prevChild
              ? targetChild.rect.left - this.#childrenCache[index - 1].rect.right
              : 0;
            this.#indicatorOffset = targetChild.rect.x - gapToPrev / 2;
          } else if (this.axis === "vertical") {
            const gapToPrev = prevChild
              ? targetChild.rect.top - this.#childrenCache[index - 1].rect.bottom
              : 0;
            this.#indicatorOffset = targetChild.rect.y - gapToPrev / 2;
          }
        }
      }
      if (this.axis === "horizontal") this.#indicatorOffset += containerScroll.x;
      else if (this.axis === "vertical") this.#indicatorOffset += containerScroll.y;
    }

    // Apply dom
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

    if (index !== undefined && this.#lastIndex !== index && this.#indicatorEl !== null) {
      let prop =
        this.axis === "horizontal" ? this.#indicatorEl.style.left : this.#indicatorEl.style.top;
      prop = `${this.#indicatorOffset}px`;
      if (this.axis === "vertical") {
        this.#indicatorEl.style.top = `${this.#indicatorOffset}px`;
      } else if (this.axis === "horizontal") {
        this.#indicatorEl.style.left = `${this.#indicatorOffset}px`;
      }

      this.#lastIndex = index;
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
    /*if (HTMLDragItem.activeTransition) setTimeout(this.boundRafCbk);
		else*/ if (this.#raf === null) requestAnimationFrame(this.boundRafCbk);
    super.onDragLeave(drag, e);
  }

  protected override onDragOver(drag: DragOperation, e?: DragEvent) {
    if (!this.isTarget) return;
    if (e && (this.#mousePos.x !== e.clientX || this.#mousePos.y !== e.clientY)) {
      this.#mousePos = { x: e.clientX, y: e.clientY };
      if (this.#raf === null) requestAnimationFrame(this.boundRafCbk);
    }
    //if (HTMLDragItem.activeTransition) setTimeout(this.boundRafCbk);
    super.onDragOver(drag, e);
  }

  protected override async onDrop(drag: DragOperation, e: DragEvent) {
    if (e) this.#mousePos = { x: e.clientX, y: e.clientY };
    this.#indicatorVisible = false;
    this.#childrenCache = [];
    this.#containerCache = null;
    /*if (HTMLDragItem.activeTransition) setTimeout(this.boundRafCbk);
		else*/ if (this.#raf === null) requestAnimationFrame(this.boundRafCbk);
    drag.index = this.#lastIndex;
    this.#lastIndex = null;
    super.onDrop(drag, e);
  }

  /*protected override onDragEnd(drag: DragOperation, e: DragEvent) {
		if (e) this.#mousePos = { x: e.clientX, y: e.clientY };
		this.#indicatorVisible = false;
		this.#childrenCache = [];
		this.#containerCache = null;
		if (HTMLDragItem.activeTransition) this.rafCbk();
		else if (this.#raf === null) requestAnimationFrame(this.boundRafCbk);
		super.onDragEnd(drag, e);
	}*/
}
