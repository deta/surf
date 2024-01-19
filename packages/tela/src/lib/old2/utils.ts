import type { Writable } from "svelte/store";
import type { TBoardMode } from "./types/Board.type.ts";
import type { Vec2, Vec4 } from "./types/Utils.type.ts";

export const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
export const clamp = (a: number, min = 0, max = 1) => Math.min(max, Math.max(min, a));
export const invlerp = (x: number, y: number, a: number) => clamp((a - x) / (y - x));
export const map = (x1: number, y1: number, x2: number, y2: number, a: number) =>
  lerp(x2, y2, invlerp(x1, y1, a));

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

export function snapToGrid(value: number, snap: number): number {
  return Math.floor(Math.round(value / snap) * snap);
}

export function rectsIntersect(a: Vec4, b: Vec4) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

const debounceMap = new Map();
export function debounce(id: string, ms: number, callback: () => void) {
  if (debounceMap.has(id)) clearTimeout(debounceMap.get(id));
  const timer = setTimeout(callback, ms);
  debounceMap.set(id, timer);
}

export function isBrowser() {
  return typeof window !== "undefined";
}

export function randomCssColor(alpha = 1) {
  return `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${alpha})`;
}