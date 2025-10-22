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

/** Not really polyfill, but mimicing the @starting-style functioality, but
 * manually removing the "_starting" class until Svelte and vite get their shit
 * together!
 */
export function startingClass(node: HTMLElement, opts?: { customClassName?: string }) {
  const clazz = opts?.customClassName ?? '_starting'
  node.classList.add(clazz)
  //tick().then(() => node.classList.remove(clazz))
  setTimeout(() => node.classList.remove(clazz), 20)
}
