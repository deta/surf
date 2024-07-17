import { get } from "svelte/store";
import { DragElement, DRAGGABLES, type DragZone } from "./dragcula.js";
import { DRAG_ZONES } from "./controllers.js";

const ZONE_ID_ATTR = "dragculaZone";

export function findClosestDragZone(pageX: number, pageY: number): DragZone | null {
  const posX = pageX - window.scrollX;
  const posY = pageY - window.scrollY;
  const target = document.elementFromPoint(posX, posY);
  let el = target;
  while (el) {
    if (el.dataset[ZONE_ID_ATTR] !== undefined) {
      const id = el.dataset[ZONE_ID_ATTR];
      return get(DRAG_ZONES).get(id);
    }
    el = el.parentElement;
  }
  return null;
}
export function findClosestDragZoneFromEl(target: HTMLElement): DragZone | null {
  let el = target;
  while (el) {
    if (el.dataset[ZONE_ID_ATTR] !== undefined) {
      const id = el.dataset[ZONE_ID_ATTR];
      return get(DRAG_ZONES).get(id);
    }
    el = el.parentElement;
  }
  return null;
}

export function parseDataTransfer(dataTransfer: DataTransfer): DragElement | null {
  const id = dataTransfer.getData("dragcula/draggable");
  if (id === "") {
    return null;
  }
  return get(DRAGGABLES).get(id);
}

/*type EventHandlerDefinitions = {
	[key: string]: (...args: any[]) => any;
};
type EventHandlers<T extends EventHandlerDefinitions> = {
	[K in keyof T]: T[K][];
};
export function createHandlers<T extends EventHandlerDefinitions>(events: T): FunctionArrayMap<T> {
	/*const result: Record<T, number[]> = {} as Record<T, number[]>;

	strings.forEach(str => {
		result[str] = [];
	});

return result;
}*/

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
      node.style.setProperty(prop, cache[prop]);
      delete cache[prop];
    }
    if (Object.entries(cache).length <= 0) {
      items.delete(node);
    }
  }
  function applyAll(node: HTMLElement) {
    const cache = items.get(node);
    if (!cache) return;
    for (const key in cache) {
      apply(node, key);
    }
    items.delete(node);
  }

  return {
    items,
    cache,
    cacheMany,
    apply,
    applyAll
  };
}
