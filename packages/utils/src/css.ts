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
