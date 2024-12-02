import { DragZone, HTMLDragArea } from "$lib/index.js";

/// === FEATURES
export const SUPPORTS_VIEW_TRANSITIONS = document.startViewTransition !== undefined;

/// === LOGGING
export const DEV = import.meta.env.DEV;
const VITE_LOG_LEVEL = import.meta.env.R_VITE_LOG_LEVEL;
const logLevels = ["trace", "debug", "info", "warn", "error"];
export const LOG_LEVEL =
  DEV === true ? logLevels.indexOf("trace") : logLevels.indexOf(VITE_LOG_LEVEL ?? "info");

export const log = Object.fromEntries(
  logLevels.map((level) => [
    level,
    (...args: any[]) => {
      if (LOG_LEVEL <= logLevels.indexOf(level)) {
        // @ts-ignore this works ;)
        console[level](...args);
      }
    }
  ])
);

/// Escaped ANS(II) strings
export const ii_DRAGCULA = "\x1B[40;97m[Dragcula]\x1B[m";
export const ii_TRACE = "\x1B[106;30;3;1mTRACE\x1B[m";
export const ii_ERROR = "\x1B[48;2;180;20;20;38;2;255;255;255;1mERROR\x1B[m";
export const ii_NATIVE = "\x1B[48;2;20;20;1800;38;2;255;255;255;1mNATIVE\x1B[m";
export const ii_CUSTOM = "\x1B[48;2;40;140;20;38;2;255;255;255;1mCUSTOM\x1B[m";

/// Mouse spy
// NOTE: Can't use as mouse events dont fire during a drag!
/*export let SPY_MOUSE_POS = { x: 0, y: 0, screenX: 0, screenY: 0, pageX: 0, pageY: 0 };
let GLOBAL_mouseMoveListener: ((e: MouseEvent) => void) | null = null;
if (!GLOBAL_mouseMoveListener) {
  GLOBAL_mouseMoveListener = (e: MouseEvent) => {
    SPY_MOUSE_POS = {
      x: e.clientX,
      y: e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
      pageX: e.pageX,
      pageY: e.pageY
    };
  };
  window.addEventListener("mousemove", GLOBAL_mouseMoveListener, { capture: true, passive: true });
}*/

/// === UTILS
export const genId = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
export function assert(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(`${ii_DRAGCULA} ${msg}`);
  }
}
export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function getParentZoneEl(el?: HTMLElement) {
  return el?.closest("[data-drag-zone]") as HTMLElement | null;
}
export function getParentZone(el?: HTMLElement) {
  const id = getParentZoneEl(el)?.getAttribute("data-drag-zone");
  return DragZone.ZONES.get(id ?? "") ?? null;
}

export function getParentAreaEl(el?: HTMLElement) {
  return el?.closest("[data-drag-area]") as HTMLElement | null;
}
export function getParentArea(el?: HTMLElement) {
  const id = getParentAreaEl(el)?.getAttribute("data-drag-area");
  return HTMLDragArea.AREAS.get(id ?? "") ?? null;
}
