import type { ActionReturn } from "svelte/action";
import { Dragcula, DragOperation } from "./Dragcula.js";
import { DragculaDragEvent } from "./Event.js";
import { type DropEffect } from "./types.type.js";
import {
  assert,
  genId,
  getParentZoneEl,
  ii_CUSTOM,
  ii_ERROR,
  ii_NATIVE,
  log
} from "./utils/internal.js";
import { DragItem, HTMLDragItem } from "./DragItem.js";
import { tick } from "svelte";

export class DragZone {
  static ZONES = new Map<string, DragZone>();

  readonly id: string;

  // TODO: Move props into this to set
  public readonly acceptsCbk: (drag: DragOperation) => boolean = () => false;

  // === STATE

  protected effectsAllowed: DropEffect[] = ["move", "copy", "link", "none"];

  // === CONSTRUCTOR

  constructor(id?: string, effectsAllowed?: DropEffect[]) {
    this.id = id ?? genId();
    this.effectsAllowed = effectsAllowed ?? this.effectsAllowed;

    DragZone.ZONES.set(this.id, this);
  }

  destroy() {
    DragZone.ZONES.delete(this.id);
  }

  // === EVENTS

  protected onDragEnter(drag: DragOperation, e?: DragEvent) {}
  protected onDragLeave(drag: DragOperation, e?: DragEvent) {}
  protected onDragOver(drag: DragOperation, e?: DragEvent) {}
  protected onDrop(drag: DragOperation, e: DragEvent) {}

  /// Called only on the source zone of a drag, before DragItem onDragEnd is called
  protected onDragEnd(drag: DragOperation, e?: DragEvent) {}
}

export interface HTMLDragZoneProps {
  id?: string;
  effectsAllowed?: DropEffect[];
  //
  // TODO: Docs
  accepts?: (drag: DragOperation) => boolean;
}
export interface HTMLDragZoneAttributes {
  id?: string;
  effectsAllowed?: string;

  "on:DragEnter"?: (drag: DragculaDragEvent) => void;
  "on:DragOver"?: (drag: DragculaDragEvent) => void;
  "on:DragLeave"?: (drag: DragculaDragEvent) => void;
  "on:DragEnd"?: (drag: DragculaDragEvent) => void;
  "on:Drop"?: (drag: DragculaDragEvent) => void;
}

export class HTMLDragZone extends DragZone {
  protected get prefix(): string {
    return `\x1B[40;97m[DragZone::${this.id}]\x1B[m`;
  }
  readonly element: HTMLElement;

  // === STATE
  protected _isTarget = false;
  set isTarget(value: boolean) {
    this._isTarget = value;
    if (value) {
      this.element.setAttribute("data-drag-target", "true");
    } else {
      this.element.removeAttribute("data-drag-target");
    }
  }
  get isTarget() {
    return this._isTarget;
  }

  constructor(node: HTMLElement, props?: HTMLDragZoneProps) {
    super(props?.id ?? (Boolean(node.id) ? node.id : undefined) ?? genId(), props?.effectsAllowed);
    (this.acceptsCbk as any) = props?.accepts ?? this.acceptsCbk;
    this.element = node;

    this.element.setAttribute("data-drag-zone", this.id);
    //this.attach(node);

    this.element.addEventListener("drop", this.handleDrop, { capture: false });
    this.element.addEventListener("dragover", this.handleDragOver, { capture: false });
    this.element.addEventListener("dragenter", this.handleDragEnter, { capture: false });
    this.element.addEventListener("dragleave", this.handleDragLeave, { capture: false });
    //this.element.addEventListener("dragend", this.handleDragEnd);

    this.configureFromDOMAttributes();
  }

  override destroy() {
    this.element.removeEventListener("drop", this.handleDrop);
    this.element.removeEventListener("dragover", this.handleDragOver);
    this.element.removeEventListener("dragenter", this.handleDragEnter);
    this.element.removeEventListener("dragleave", this.handleDragLeave);

    super.destroy();
  }

  configureFromDOMAttributes() {}

  static action(
    node: HTMLElement,
    props: HTMLDragZoneProps
  ): ActionReturn<HTMLDragZoneProps, HTMLDragZoneAttributes> {
    const zone = new this(node, props);

    return {
      destroy() {
        zone.destroy();
      },
      update() {}
    };
  }

  // === DOM EVENTS
  protected handleDrop = this._handleDrop.bind(this);
  protected handleDragEnter = this._handleDragEnter.bind(this);
  protected handleDragLeave = this._handleDragLeave.bind(this);
  protected handleDragOver = this._handleDragOver.bind(this);

  protected _handleDrop(e: DragEvent) {
    if (!this.isTarget) return;
    e.preventDefault();
    // NOTE: We still need to stop propagation here, so we can await the Drop handler
    // and decide whether to re-dispatch it on the parent.
    // // TODO: FIGURE OTU ^ this

    log.debug(
      `${this.prefix}:${e.isTrusted && Dragcula.get().activeDrag?.isNative ? ii_NATIVE : ii_CUSTOM}:drop `,
      e
    );

    const drag = Dragcula.get().activeDrag;
    assert(drag !== null, "No active drag during handleDrop! This should not happen!");

    this.isTarget = false;

    this.onDrop(drag, e);
  }

  protected _handleDragOver(e: DragEvent) {
    if (!this.isTarget) return;

    const drag = Dragcula.get().activeDrag;
    assert(drag !== null, "No active drag during dragOver! This should not happen!");

    if (drag.to !== this) return;

    //if (!this.element.contains((drag.item as HTMLDragItem).element)) {
    if (!this.acceptsCbk(drag)) return;
    //}
    e.preventDefault();

    this.onDragOver(drag, e);
  }

  protected _handleDragEnter(e: DragEvent) {
    if (e.defaultPrevented) return;

    // Bootsteap deag as this is native entry point.
    if (e.isTrusted && Dragcula.get().activeDrag === null) {
      log.debug(`${this.prefix}:dragEnter Initializing drag for native event!`);
      Dragcula.get().activeDrag = DragOperation.new({
        to: this,
        dataTransfer: e.dataTransfer ?? new DataTransfer()
      });
      Dragcula.get().prepareDragOperation();
      Dragcula.get().callHandlers("dragstart", Dragcula.get().activeDrag);
    }
    const drag = Dragcula.get().activeDrag!;
    assert(drag !== null, "No active drag during dragEnter! This should not happen!");

    const accepted = this.acceptsCbk(drag);
    if (!accepted) return;

    /*
        if (this.isTarget) {
          e.preventDefault();
          return;
        }
        if (e.defaultPrevented) return
    */
    // @ts-ignore, fck webdev it actually exists in Chrome!
    const toEl = e.toElement as HTMLElement;
    // ONly enter if toEl closest zone is self
    //if ((this.element.contains(toEl) && this.element !== toEl && this.isTarget)
    //	|| this.element.contains(toEl) && getParentZoneEl(toEl) !== this.element) return

    //if ((this.element.contains(toEl) && this.element !== toEl && this.isTarget)) return
    /////if (getParentZoneEl(toEl) === this.element) return

    const fromZone = DragZone.ZONES.get((e.relatedTarget as HTMLElement)?.id);
    log.debug(
      `${this.prefix}:${e.isTrusted && (Dragcula.get().activeDrag === null || Dragcula.get().activeDrag?.isNative) ? ii_NATIVE : ii_CUSTOM}:dragEnter ${fromZone ? `| from: ${fromZone.id}` : ""}`,
      e
    );

    drag.to = this;
    e.preventDefault();
    //e.stopPropagation();
    this.isTarget = true;

    this.onDragEnter(drag, e);
  }

  protected _handleDragLeave(e: DragEvent) {
    /*// @ts-ignore, fck webdev it actually exists in Chrome!
    const fromEl = e.fromElement as HTMLElement;
    // @ts-ignore, fck webdev it actually exists in Chrome!
    const toEl = e.toElement as HTMLElement;*/

    const drag = Dragcula.get().activeDrag!;
    assert(drag !== null, "No active drag during dragLeave! This should not happen!");

    if (!this.acceptsCbk(drag)) return;
    if (drag.to === this && this.element.contains(e?.relatedTarget)) return;

    //console.warn("leave pre el", this.id, fromEl, getParentZoneEl(fromEl))
    //if (this.element.contains(fromEl) && getParentZoneEl(fromEl) !== this.element) return;
    //if (this.element.contains(fromEl) && this.element !== fromEl) return;
    //if (getParentZoneEl(fromEl) === this.element) return; // && drag.to === this
    //if (getParentZoneEl(toEl) === this.element) return

    // false true -> now target?

    /*if (drag.to !== null && drag.to !== this) {
      console.warn("bookmark", this.id, " >> ", drag.to.id)
      if (!drag.to.acceptsCbk(drag)) {
        return;
      }
    }*/

    //if (e.defaultPrevented) return

    //e.preventDefault(); ! not worky with them.?
    //e.stopPropagation(); //!not worky with them.?

    log.debug(`${this.prefix}:${drag.isNative ? ii_NATIVE : ii_CUSTOM}:dragLeave `, e);

    this.isTarget = false;

    if (drag.to === this) drag.to = null;

    this.onDragLeave(Dragcula.get().activeDrag!, e);
  }

  // === EVENTS

  protected override async onDrop(drag: DragOperation, e: DragEvent) {
    super.onDrop(drag, e);
    log.debug(`${this.prefix}:${drag.isNative ? ii_NATIVE : ii_CUSTOM}:Drop `, drag);

    const [event, dispatchPromise] = DragculaDragEvent.dispatch("Drop", this.element, {
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      ...drag,
      to: drag.to,
      event: e,
      bubbles: false
    });
    if (event.stoppedPropagation) e.stopPropagation();
    try {
      await dispatchPromise;
      log.debug(
        `${this.prefix}:${drag.isNative ? ii_NATIVE : ii_CUSTOM}:Drop \x1B[102;30maccepted\x1B[m item ${drag.isNative ? "DataTransfer" : drag.item?.id}!`
      );

      if (drag.from !== null && drag.from instanceof HTMLDragZone) {
        drag.from.onDragEnd(drag, e);
      }
    } catch (_) {
      log.debug(
        `${this.prefix}:${drag.isNative ? ii_NATIVE : ii_CUSTOM}:Drop \x1B[43;30mrejected\x1B[m item ${drag.isNative ? "DataTransfer" : drag.item?.id}!`
      );
    } finally {
      //await tick();

      if (drag.isNative) {
        Dragcula.get().cleanupDragOperation();
      }
    }
  }

  protected override onDragEnter(drag: DragOperation, e?: DragEvent) {
    super.onDragEnter(drag);

    const [event, _] = DragculaDragEvent.dispatch("DragEnter", this.element, {
      metaKey: e?.metaKey,
      ctrlKey: e?.ctrlKey,
      shiftKey: e?.shiftKey,
      altKey: e?.altKey,
      ...drag,
      event: e,
      bubbles: false
    }); // no fck bubbles to annoy u ;) !

    /*if (event.isContinued) {
      e?.preventDefault();
      drag.to = this;
      this.isTarget = true;
    }*/

    if (drag.item instanceof DragItem) drag.item.onDragTargetEnter(drag, e);
  }

  protected override onDragLeave(drag: DragOperation, e?: DragEvent) {
    super.onDragLeave(drag);
    DragculaDragEvent.dispatch("DragLeave", this.element, {
      metaKey: e?.metaKey,
      ctrlKey: e?.ctrlKey,
      shiftKey: e?.shiftKey,
      altKey: e?.altKey,
      ...drag,
      event: e,
      bubbles: false
    }); // no fck bubbles to annoy u ;) !

    if (drag.item instanceof DragItem) drag.item.onDragTargetLeave(drag, e);
  }

  protected override onDragOver(drag: DragOperation, e?: DragEvent) {
    super.onDragOver(drag);
    const [event, _] = DragculaDragEvent.dispatch("DragOver", this.element, {
      metaKey: e?.metaKey,
      ctrlKey: e?.ctrlKey,
      shiftKey: e?.shiftKey,
      altKey: e?.altKey,
      ...drag,
      event: e,
      bubbles: false
    }); // no fck bubbles to annoy u ;) !

    //if (event.isContinued) e?.preventDefault();
  }

  protected override onDragEnd(drag: DragOperation, e?: DragEvent) {
    super.onDragEnd(drag);
    log.debug(
      `${this.prefix}:${drag.item instanceof DataTransfer ? ii_NATIVE : ii_CUSTOM}:DragEnd `,
      drag
    );
    DragculaDragEvent.dispatch("DragEnd", this.element, {
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
