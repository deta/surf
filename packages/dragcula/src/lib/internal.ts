import { writable } from "svelte/store";
import type { DragOperation } from "./types.js";

/// GLOBAL MOUSE LISTENER
export let mousePos = { x: 0, y: 0 };
let GLOBAL_mouseMoveListener: ((e: MouseEvent) => void) | null = null;
if (!GLOBAL_mouseMoveListener) {
  GLOBAL_mouseMoveListener = (e: MouseEvent) => {
    mousePos = { x: e.clientX, y: e.clientY };
  };
  window.addEventListener("mousemove", GLOBAL_mouseMoveListener, { capture: true });
}

export const ACTIVE_DRAG_OPERATION = writable<DragOperation | null>(null);
