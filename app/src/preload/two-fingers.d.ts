export declare global {
  /*
      TouchEvent' `scale` and `rotation` properties aren't standardized:
      https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent
    */
  interface TouchEvent {
    scale?: number
    rotation?: number
  }

  /*
      GestureEvents aren't standardized:
      https://developer.mozilla.org/en-US/docs/Web/API/GestureEvent
      https://developer.apple.com/documentation/webkitjs/gestureevent
    */
  interface GestureEvent extends UIEvent {
    altKey: boolean
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    scale: number
    rotation: number
    clientX: number
    clientY: number
    screenX: number
    screenY: number
  }

  // extends the original ElementEventMap
  interface ElementEventMap {
    gesturestart: GestureEvent
    gesturechange: GestureEvent
    gestureend: GestureEvent
  }

  // required to check for its existence
  interface Window {
    GestureEvent?: GestureEvent
  }
}
