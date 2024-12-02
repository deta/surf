import type { ActionReturn } from "svelte/action";
import { Dragcula, DragculaDragEvent, type DragOperation } from "./index.js";
import { assert, genId } from "./utils/internal.js";

export interface HTMLDragAreaProps {
  id?: string;
  //
  // TODO: Docs
  accepts?: (drag: DragOperation) => boolean;
}
export interface HTMLDragAreaAttributes {
  id?: string;

  "on:DragEnter"?: (drag: DragculaDragEvent) => void;
  "on:DragOver"?: (drag: DragculaDragEvent) => void;
  "on:DragLeave"?: (drag: DragculaDragEvent) => void;
  "on:DragEnd"?: (drag: DragculaDragEvent) => void;
  "on:Drop"?: (drag: DragculaDragEvent) => void;
}

/**
 * An area can be entered & exited, but never dropped into.
 */
export class HTMLDragArea {
  static AREAS = new Map<string, HTMLDragArea>();
  protected get prefix(): string {
    return `\x1B[40;97m[DragZone::${this.id}]\x1B[m`;
  }

  readonly id: string;
  readonly element: HTMLElement;

  public readonly acceptsCbk: (drag: DragOperation) => boolean = () => false;

  // === STATE
  protected _isTarget = false;
  set isTarget(value: boolean) {
    this._isTarget = value;
    if (value) {
      this.element.setAttribute("data-drag-area-target", "true");
    } else {
      this.element.removeAttribute("data-drag-area-target");
    }
  }
  get isTarget() {
    return this._isTarget;
  }

  // === CONSTRUCTOR

  constructor(node: HTMLElement, props?: HTMLDragAreaProps) {
    this.id = props?.id ?? (Boolean(node.id) ? node.id : undefined) ?? genId();
    (this.acceptsCbk as any) = props?.accepts ?? this.acceptsCbk;
    this.element = node;

    this.element.setAttribute("data-drag-area", this.id);
    //this.element.addEventListener("dragover", this.handleDragOver, { capture: false });
    this.element.addEventListener("dragenter", this.handleDragEnter, { capture: false });
    this.element.addEventListener("dragleave", this.handleDragLeave, { capture: false });

    HTMLDragArea.AREAS.set(this.id, this);
  }

  destroy() {
    //    this.element.removeEventListener("dragover", this.handleDragOver);
    this.element.removeEventListener("dragenter", this.handleDragEnter);
    this.element.removeEventListener("dragleave", this.handleDragLeave);

    HTMLDragArea.AREAS.delete(this.id);
  }

  static use(
    node: HTMLElement,
    props: HTMLDragAreaProps
  ): ActionReturn<HTMLDragAreaProps, HTMLDragAreaAttributes> {
    const area = new this(node, props);

    return {
      destroy() {
        area.destroy();
      },
      update() {}
    };
  }

  // === DOM EVENTS
  protected handleDragEnter = this._handleDragEnter.bind(this);
  protected handleDragLeave = this._handleDragLeave.bind(this);
  //protected handleDragOver = this._handleDragOver.bind(this);

  protected _handleDragOver(e: DragEvent) {
    if (!this.isTarget) return;
  }

  protected _handleDragEnter(e: DragEvent) {
    //if (e.defaultPrevented) return;
    if (this.isTarget) return;
    const drag = Dragcula.get().activeDrag!;
    assert(drag !== null, "No active drag during dragEnter! This should not happen!");

    //e.preventDefault();
    this.isTarget = true;
    drag.area = this;
    this.onDragEnter(drag, e);
  }

  protected _handleDragLeave(e: DragEvent) {
    if (!this.isTarget) return;
    const drag = Dragcula.get().activeDrag!;
    assert(drag !== null, "No active drag during dragLeave! This should not happen!");

    if (drag.area === this && this.element.contains(e?.relatedTarget)) return;
    this.isTarget = false;
    if (drag.area === this) drag.area = null;
    this.onDragLeave(Dragcula.get().activeDrag!, e);
  }

  _handleDragEnd(e?: DragEvent) {
    this.isTarget = false;
    this.onDragLeave(Dragcula.get().activeDrag!, e);
  }

  // === EVENTS

  protected onDragEnter(drag: DragOperation, e?: DragEvent) {
    const [event, _] = DragculaDragEvent.dispatch("DragEnter", this.element, {
      metaKey: e?.metaKey,
      ctrlKey: e?.ctrlKey,
      shiftKey: e?.shiftKey,
      altKey: e?.altKey,
      ...drag,
      event: e,
      bubbles: false
    }); // no fck bubbles to annoy u ;) !
  }

  protected onDragLeave(drag: DragOperation, e?: DragEvent) {
    DragculaDragEvent.dispatch("DragLeave", this.element, {
      metaKey: e?.metaKey,
      ctrlKey: e?.ctrlKey,
      shiftKey: e?.shiftKey,
      altKey: e?.altKey,
      ...drag,
      event: e,
      bubbles: false
    }); // no fck bubbles to annoy u ;) !
  }
}
