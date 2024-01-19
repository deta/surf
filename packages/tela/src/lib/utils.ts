import type { Vec4 } from "./types/Utils.type.js";

export function getDevicePixelRatio() {
  return window?.devicePixelRatio || 1;
}

const _debounceMap = new Map();
export function debounce(id: string, ms: number, callback: () => void) {
  if (_debounceMap.has(id)) clearTimeout(_debounceMap.get(id));
  const timer = setTimeout(callback, ms);
  _debounceMap.set(id, timer);
}

export const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
export const clamp = (a: number, min = 0, max = 1) => Math.min(max, Math.max(min, a));
export const invlerp = (x: number, y: number, a: number) => clamp((a - x) / (y - x));
export const map = (x1: number, y1: number, x2: number, y2: number, a: number) =>
  lerp(x2, y2, invlerp(x1, y1, a));

export function posToAbsolute(
  x: number,
  y: number,
  viewX: number,
  viewY: number,
  viewPort: Vec4,
  zoom: number
) {
  // TODO: page scroll?
  // TODO: zoom?
  return {
    x: x / zoom + viewX - viewPort.x,
    y: y / zoom + viewY - viewPort.y
  };
}

/**
   * @param x
   * @param y
   * @param width
   * @param height
   * @param viewX
   * @param viewY
   * @param viewPort
   * @param zoom
   * @param CULL_MARGIN_WIDHT
   * @param CULL_MARGIN_HEIGHT
   */
  export function isInsideViewport(x: number, y: number, width: number, height: number, viewX: number, viewY: number, viewPort: Vec4, zoom: number, marginWidth = 0, marginHeight = 0) {
    return x + width + marginWidth >= viewX && y + height + marginHeight >= viewY && x - marginWidth <= viewX + viewPort.w / (zoom * 1) && y - marginHeight <= viewY + viewPort.h / (zoom * 1);
  }

export function hasClassOrParentWithClass(element: HTMLElement, className: string): boolean {
  if (!element) {
    return false;
  }

  if (element.classList.contains(className)) {
    return true;
  }

  if (element.parentElement) return hasClassOrParentWithClass(element.parentElement, className);
  else return false;
}
export function isTagOrParentWithTag(element: HTMLElement, tagName: string): boolean {
  if (!element) {
    return false;
  }

  if (element.tagName === tagName) {
    return true;
  }

  if (element.parentElement) return isTagOrParentWithTag(element.parentElement, tagName);
  else return false;
}
export function isTagsOrParentWithTags(element: HTMLElement, tagNames: string[]): boolean {
  if (!element) {
    return false;
  }

  if (tagNames.includes(element.tagName)) {
    return true;
  }

  if (element.parentElement) return isTagsOrParentWithTags(element.parentElement, tagNames);
  else return false;
}

export function isInsidePositionable(e: HTMLElement) {
  if (!e) {
    return false;
  }

  if (e.classList.contains("positionable")) {
    return e.dataset.id || false;
  }

  if (e.parentElement) return isInsidePositionable(e.parentElement);
  else return false;
}

export function snapToGrid(value: number, snap: number): number {
  return Math.floor(Math.round(value / snap) * snap);
}

export function rectsIntersect(a: Vec4, b: Vec4) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function randomCssColor(alpha = 1) {
  return `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(
    Math.random() * 255
  )}, ${alpha})`;
}

/**
 * Use raw for loop for performance increase.
 */
export const fastFilter = <T>(fn: (e: T) => boolean, arr: T[]) => {
  const f = new Array<T>();
  for (let i = 0; i < arr.length; i++) {
    if (fn(arr[i])) {
      f.push(arr[i]);
    }
  }
  return f;
};

export function hoistPositionable(key: string, el: HTMLElement) {
  el.dispatchEvent(new CustomEvent("tela_hoist", { detail: key, bubbles: true }));
}
export function unHoistPositionable(key: string, el: HTMLElement) {
  el.dispatchEvent(new CustomEvent("tela_unhoist", { detail: key, bubbles: true }));
}