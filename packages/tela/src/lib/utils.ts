import { get, type Writable } from 'svelte/store'
import type { IPositionable } from './Positionable.svelte'
import type { Vec4 } from './types/Utils.type.js'
import type { IBoardSettings } from './index.js'

export function getDevicePixelRatio() {
  return window?.devicePixelRatio || 1
}

const _debounceMap = new Map()
export function debounce(id: string, ms: number, callback: () => void) {
  if (_debounceMap.has(id)) clearTimeout(_debounceMap.get(id))
  const timer = setTimeout(callback, ms)
  _debounceMap.set(id, timer)
}

export const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t
export const clamp = (a: number, min = 0, max = 1) => Math.min(max, Math.max(min, a))
export const invlerp = (x: number, y: number, a: number) => clamp((a - x) / (y - x))
export const map = (x1: number, y1: number, x2: number, y2: number, a: number) =>
  lerp(x2, y2, invlerp(x1, y1, a))

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
  }
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
export function isInsideViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  viewX: number,
  viewY: number,
  viewPort: Vec4,
  zoom: number,
  marginWidth = 0,
  marginHeight = 0
) {
  return (
    x + width + marginWidth >= viewX &&
    y + height + marginHeight >= viewY &&
    x - marginWidth <= viewX + viewPort.w / (zoom * 1) &&
    y - marginHeight <= viewY + viewPort.h / (zoom * 1)
  )
}

export function hasClassOrParentWithClass(element: HTMLElement, className: string): boolean {
  if (!element) {
    return false
  }

  if (element.classList.contains(className)) {
    return true
  }

  if (element.parentElement) return hasClassOrParentWithClass(element.parentElement, className)
  else return false
}
export function isTagOrParentWithTag(element: HTMLElement, tagName: string): boolean {
  if (!element) {
    return false
  }

  if (element.tagName === tagName) {
    return true
  }

  if (element.parentElement) return isTagOrParentWithTag(element.parentElement, tagName)
  else return false
}
export function isTagsOrParentWithTags(element: HTMLElement, tagNames: string[]): boolean {
  if (!element) {
    return false
  }

  if (tagNames.includes(element.tagName)) {
    return true
  }

  if (element.parentElement) return isTagsOrParentWithTags(element.parentElement, tagNames)
  else return false
}

export function isInsidePositionable(e: HTMLElement) {
  if (!e) {
    return false
  }

  if (e.classList.contains('positionable')) {
    return e.dataset.id || false
  }

  if (e.parentElement) return isInsidePositionable(e.parentElement)
  else return false
}

export function snapToGrid(value: number, snap: number): number {
  return Math.floor(Math.round(value / snap) * snap)
}

/**
 * Snaps positionable to edges of other positionables.
 */
export function snapToEdges(
  src: IPositionable<any>,
  snapSources: Writable<IPositionable<any>>[],
  POSITIONABLE_KEY: string,
  GRID_SIZE: number,
  EDGE_SNAP_FACTOR: number
) {
  {
    // Snap Y
    const snapTargetsTop = snapSources.filter((c) => {
      const _c = get(c)
      return (
        _c[POSITIONABLE_KEY] !== src[POSITIONABLE_KEY] &&
        Math.abs(_c.y - src.y) < GRID_SIZE * EDGE_SNAP_FACTOR
      )
    })
    if (snapTargetsTop.length > 0) {
      src.y = get(snapTargetsTop[0]).y
    }
    // TODO: Rename all of this to make it more clear which edges are found / snapped
    const snapTargetsBotEdge = snapSources.filter((c) => {
      const _c = get(c)
      return (
        _c[POSITIONABLE_KEY] !== src[POSITIONABLE_KEY] &&
        Math.abs(_c.y + _c.height - src.y) < GRID_SIZE * EDGE_SNAP_FACTOR
      )
    })
    if (snapTargetsBotEdge.length > 0) {
      src.y = get(snapTargetsBotEdge[0]).y + get(snapTargetsBotEdge[0]).height + GRID_SIZE
    }
    const snapTargetsBot = snapSources.filter((c) => {
      const _c = get(c)
      return (
        _c[POSITIONABLE_KEY] !== src[POSITIONABLE_KEY] &&
        Math.abs(_c.y + _c.height - (src.y + src.height)) < GRID_SIZE * EDGE_SNAP_FACTOR
      )
    })
    if (snapTargetsBot.length > 0) {
      src.y = get(snapTargetsBot[0]).y + get(snapTargetsBot[0]).height - src.height
    }
  }
  {
    // Snap X
    const snapTargetsRight = snapSources.filter((c) => {
      const _c = get(c)
      return (
        _c[POSITIONABLE_KEY] !== src[POSITIONABLE_KEY] &&
        Math.abs(_c.x + _c.width + GRID_SIZE - src.x) < GRID_SIZE * EDGE_SNAP_FACTOR
      )
    })
    if (snapTargetsRight.length > 0) {
      src.x = get(snapTargetsRight[0]).x + get(snapTargetsRight[0]).width + GRID_SIZE
    }
    const snapTargetsLeft = snapSources.filter((c) => {
      const _c = get(c)
      return (
        _c[POSITIONABLE_KEY] !== src[POSITIONABLE_KEY] &&
        Math.abs(_c.x - src.x) < GRID_SIZE * EDGE_SNAP_FACTOR
      )
    })
    if (snapTargetsLeft.length > 0) {
      src.x = get(snapTargetsLeft[0]).x
    }
  }
  {
    // Snap X + Width
    const snapTargetsRight = snapSources.filter((c) => {
      const _c = get(c)
      return (
        _c[POSITIONABLE_KEY] !== src[POSITIONABLE_KEY] &&
        Math.abs(_c.x + _c.width - (src.x + src.width)) < GRID_SIZE * EDGE_SNAP_FACTOR
      )
    })
    if (snapTargetsRight.length > 0) {
      src.x = get(snapTargetsRight[0]).x + get(snapTargetsRight[0]).width - src.width
    }
    const snapTargetsLeft = snapSources.filter((c) => {
      const _c = get(c)
      return (
        _c[POSITIONABLE_KEY] !== src[POSITIONABLE_KEY] &&
        Math.abs(_c.x - GRID_SIZE - (src.x + src.width)) < GRID_SIZE * EDGE_SNAP_FACTOR
      )
    })
    if (snapTargetsLeft.length > 0) {
      src.x = get(snapTargetsLeft[0]).x - src.width - GRID_SIZE
    }
  }
}

export function rectsIntersect(a: Vec4, b: Vec4) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function randomCssColor(alpha = 1) {
  return `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(
    Math.random() * 255
  )}, ${alpha})`
}

/**
 * Use raw for loop for performance increase.
 */
export const fastFilter = <T>(fn: (e: T) => boolean, arr: T[]) => {
  const f = new Array<T>()
  for (let i = 0; i < arr.length; i++) {
    if (fn(arr[i])) {
      f.push(arr[i])
    }
  }
  return f
}

export function hoistPositionable(key: string, el: HTMLElement) {
  el.dispatchEvent(new CustomEvent('tela_hoist', { detail: key, bubbles: true }))
}
export function unHoistPositionable(key: string, el: HTMLElement) {
  el.dispatchEvent(new CustomEvent('tela_unhoist', { detail: key, bubbles: true }))
}

/**
 * Bound x,y,width,height by boundaries from settings.
 * // TODO: This should be named differently -> calcBoundOffset or sth calcBoundPos
 * @param x
 * @param y
 * @param width
 * @param height
 */
export function applyBounds(
  o: { x: number; y: number; width: number; height: number },
  settings: IBoardSettings
) {
  let outX = o.x
  let outY = o.y
  if (settings.BOUNDS?.minX !== null && o.x < settings.BOUNDS!.minX) {
    outX = settings.BOUNDS!.minX
  } else if (settings.BOUNDS?.maxX !== null && o.x + o.width > settings.BOUNDS!.maxX) {
    outX = settings.BOUNDS!.maxX - o.width
  }

  if (settings.BOUNDS?.minY !== null && o.y < settings.BOUNDS!.minY) {
    outY = settings.BOUNDS!.minY
  } else if (settings.BOUNDS?.maxY !== null && o.y + o.height > settings.BOUNDS!.maxY) {
    outY = settings.BOUNDS!.maxY - o.height
  }
  return { x: outX, y: outY }
}
