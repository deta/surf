export const DEV = import.meta.env.DEV
const VITE_LOG_LEVEL = import.meta.env.R_VITE_LOG_LEVEL
const logLevelMap = ["verbose", "debug", "info", "warn", "error"]
export const LOG_LEVEL =
  DEV === true ? logLevelMap.indexOf("verbose") : logLevelMap.indexOf(VITE_LOG_LEVEL ?? "info")
type LogLevel = "verbose" | "debug" | "info" | "warn" | "error"

export const SUPPORTS_VIEW_TRANSITIONS = document.startViewTransition !== undefined

export const log = {
  log: (...data: any[]) => {
    if (LOG_LEVEL <= logLevelMap.indexOf("verbose")) {
      console.log(...args)
    }
  },
  trace: (...args: any[]) => {
    if (LOG_LEVEL <= logLevelMap.indexOf("trace")) {
      console.trace(...args)
    }
  },
  debug: (...args: any[]) => {
    if (LOG_LEVEL <= logLevelMap.indexOf("debug")) {
      console.debug(...args)
    }
  },
  info: (...args: any[]) => {
    if (LOG_LEVEL <= logLevelMap.indexOf("info")) {
      console.info(...args)
    }
  },
  warn: (...args: any[]) => {
    if (LOG_LEVEL <= logLevelMap.indexOf("warn")) {
      console.warn(...args)
    }
  },
  error: (...args: any[]) => {
    if (LOG_LEVEL <= logLevelMap.indexOf("error")) {
      console.error(...args)
    }
  }
}

/// GLOBAL MOUSE LISTENER
export let MOUSE_POS = { x: 0, y: 0 }
export let KEY_STATE = {
  shift: false,
  ctrl: false,
  alt: false,
  meta: false
}
let GLOBAL_mouseMoveListener: ((e: MouseEvent) => void) | null = null
if (!GLOBAL_mouseMoveListener) {
  GLOBAL_mouseMoveListener = (e: MouseEvent) => {
    MOUSE_POS = { x: e.clientX, y: e.clientY }
    KEY_STATE.shift = e.shiftKey
    KEY_STATE.ctrl = e.ctrlKey
    KEY_STATE.alt = e.altKey
    KEY_STATE.meta = e.metaKey
  }
  window.addEventListener("mousemove", GLOBAL_mouseMoveListener, { capture: true })
}

/// EVENT SYSTEM TRICKERY
/// FIX: MEMORY LEAKKKKKS!
const EVENT_SPY_TARGETS = [
  "Drop",
  "DragStart",
  "DragEnter",
  "DragOver"
  //"onDragLeave",
]
export class EventSpy {
  // <eventType, callback>
  callbacks = new Map<
    string,
    {
      /// Whether somewhere inside the function body .continue() or .abort() is called.
      handlesDragculaEvent: boolean
      ref: WeakRef<() => void>
    }[]
  >()

  static hasListenerOfType(node: Node, type: string) {
    if (!EVENT_SPY.has(node)) return false
    return EVENT_SPY.get(node)!.callbacks.has(type)
  }
  static allListenersHandleDragculaEvent(node: Node, type: string) {
    if (!EVENT_SPY.has(node)) return false
    const callbacks = EVENT_SPY.get(node)!.callbacks.get(type)
    if (!callbacks) return false
    return callbacks.every((cb) => cb.handlesDragculaEvent)
  }
}

var f = EventTarget.prototype.addEventListener
const EVENT_SPY = new WeakMap<Node, EventSpy>()
EventTarget.prototype.addEventListener = function (type, fn: any, capture) {
  this.f = f

  if (EVENT_SPY_TARGETS.includes(type)) {
    if (!EVENT_SPY.has(this)) {
      EVENT_SPY.set(this, new EventSpy())
    }

    const spy = EVENT_SPY.get(this)!
    if (!spy.callbacks.has(type)) spy.callbacks.set(type, [])
    spy.callbacks.get(type)!.push({
      handlesDragculaEvent:
        fn.toString().includes(".continue()") || fn.toString().includes(".abort()"),
      ref: new WeakRef(fn)
    })

    log.debug("Added Event Spy: ", type, fn)
    //console.warn(EVENT_SPY);

    this.f(
      type,
      (...args: any[]) => {
        log.debug("Called listener", type, args)
        fn(...args)
      },
      capture
    )
  } else {
    this.f(type, fn, capture)
  }
}
