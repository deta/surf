import { get } from "svelte/store";
import { DragZone } from "./index.js";

export const DEBUG = false;
export const SUPPORTS_VIEW_TRANSITIONS = document.startViewTransition !== undefined; // TODO: test & check in startVT method

export function createDragData(data: Omit<IDragData, "getDataTransfer">): IDragData {
  const d = {
    ...data,
    getDataTransfer: () => {
      console.log(this);
      const dt = new DataTransfer();
      // TODO: Fails on objects, we need some serialization / warning here!
      for (const [key, value] of Object.entries(this)) {
        if (key === "getDataTransfer") continue;
        dt.setData(key, value);
      }
      return dt;
    }
  };
  return d;
}

/**
 * Creates a style cache which can be used to cache and re-apply styles for specific elements.
 */
export function createStyleCache() {
  const items = new Map<HTMLElement, Record<string, string>>();

  function cache(node: HTMLElement, prop: string, newVal?: string) {
    if (!items.has(node)) items.set(node, {});
    const cache = items.get(node);
    cache![prop] = node.style.getPropertyValue(prop);
    if (newVal) node.style.setProperty(prop, newVal);
  }
  function cacheMany(node: HTMLElement, styles: Record<string, string>) {
    for (const [prop, newVal] of Object.entries(styles)) {
      cache(node, prop, newVal);
    }
  }
  function apply(node: HTMLElement, prop: string) {
    const cache = items.get(node);
    if (!cache) return;
    if (cache[prop] !== undefined) {
      if (cache[prop] === "") node.style.removeProperty(prop);
      else node.style.setProperty(prop, cache[prop]);
      delete cache[prop];
    }
    if (Object.entries(cache).length <= 0) {
      items.delete(node);
    }
  }
  function applyAll(node: HTMLElement, omit?: string[]) {
    const cache = items.get(node);
    if (!cache) return;
    for (const key in cache) {
      if (omit && omit.includes(key)) continue;
      apply(node, key);
    }
    if (Object.entries(cache).length <= 0) {
      items.delete(node);
    }
  }
  function dump(label = "") {
    return; // debug
    console.trace("Dumping style cache", label, items.size);
    for (const [node, cache] of items.entries()) {
      console.group(`[StyleCache] ${label} :: Node`, node);
      console.table(cache);
      console.groupEnd();
    }
  }

  return {
    items,
    cache,
    cacheMany,
    apply,
    applyAll,
    dump
  };
}

export function findClosestDragZoneFromPoint(pageX: number, pageY: number): DragZone | null {
  const posX = pageX - window.scrollX;
  const posY = pageY - window.scrollY;
  const target = document.elementFromPoint(posX, posY);
  let el: HTMLElement | null = target as HTMLElement;
  while (el) {
    if (el.getAttribute("data-dragcula-zone") !== null) {
      const id = el.getAttribute("data-dragcula-zone")!;
      return DragZone.ZONES.get(id) || null;
    }
    el = el.parentElement;
  }
  return null;
}
export function findClosestDragZoneFromEl(target: HTMLElement): DragZone | null {
  let el: HTMLElement | null = target;
  while (el !== null) {
    if (el.getAttribute("data-dragcula-zone") !== null) {
      const id = el.getAttribute("data-dragcula-zone")!;
      return DragZone.ZONES.get(id) || null;
    }
    el = el.parentElement;
  }
  return null;
}
