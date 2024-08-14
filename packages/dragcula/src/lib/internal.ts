export const DEBUG = false;
export const SUPPORTS_VIEW_TRANSITIONS = document.startViewTransition !== undefined;

/// GLOBAL MOUSE LISTENER
export let MOUSE_POS = { x: 0, y: 0 };
export let KEY_STATE = {
  shift: false,
  ctrl: false,
  alt: false,
  meta: false
};
let GLOBAL_mouseMoveListener: ((e: MouseEvent) => void) | null = null;
if (!GLOBAL_mouseMoveListener) {
  GLOBAL_mouseMoveListener = (e: MouseEvent) => {
    MOUSE_POS = { x: e.clientX, y: e.clientY };
    KEY_STATE.shift = e.shiftKey;
    KEY_STATE.ctrl = e.ctrlKey;
    KEY_STATE.alt = e.altKey;
    KEY_STATE.meta = e.metaKey;
  };
  window.addEventListener("mousemove", GLOBAL_mouseMoveListener, { capture: true });
}

/// EVENT SYSTEM TRICKERY
/// FIX: MEMORY LEAKKKKKS!
const EVENT_SPY_TARGETS = [
  "Drop",
  "DragStart",
  "DragEnter",
  "DragOver"
  //"onDragLeave",
];
export class EventSpy {
  // <eventType, callback>
  callbacks = new Map<
    string,
    {
      /// Whether somewhere inside the function body .continue() or .abort() is called.
      handlesDragculaEvent: boolean;
      ref: WeakRef<() => void>;
    }[]
  >();

  static hasListenerOfType(node: Node, type: string) {
    if (!EVENT_SPY.has(node)) return false;
    return EVENT_SPY.get(node)!.callbacks.has(type);
  }
  static allListenersHandleDragculaEvent(node: Node, type: string) {
    if (!EVENT_SPY.has(node)) return false;
    const callbacks = EVENT_SPY.get(node)!.callbacks.get(type);
    if (!callbacks) return false;
    return callbacks.every((cb) => cb.handlesDragculaEvent);
  }
}

var f = EventTarget.prototype.addEventListener;
const EVENT_SPY = new WeakMap<Node, EventSpy>();
EventTarget.prototype.addEventListener = function (type, fn: any, capture) {
  this.f = f;

  if (EVENT_SPY_TARGETS.includes(type)) {
    if (!EVENT_SPY.has(this)) {
      EVENT_SPY.set(this, new EventSpy());
    }

    const spy = EVENT_SPY.get(this)!;
    if (!spy.callbacks.has(type)) spy.callbacks.set(type, []);
    spy.callbacks.get(type)!.push({
      handlesDragculaEvent:
        fn.toString().includes(".continue()") || fn.toString().includes(".abort()"),
      ref: new WeakRef(fn)
    });

    //console.warn('Added Event Spy: ', type, fn);
    //console.warn(EVENT_SPY);

    this.f(
      type,
      (...args: any[]) => {
        //console.warn("Called listener", type, args);
        fn(...args);
      },
      capture
    );
  } else {
    this.f(type, fn, capture);
  }
};
