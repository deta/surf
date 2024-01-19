export const twoDecimalTrunc = (num: number) => Math.trunc(num * 100) / 100;

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
