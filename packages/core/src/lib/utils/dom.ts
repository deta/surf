export function hasParent(node: HTMLElement | EventTarget | null, el: HTMLElement) {
  let test: HTMLElement | null = node as HTMLElement | null
  while (test && test !== el) {
    test = test.parentElement
  }

  if (test) return true
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
