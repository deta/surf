export function hasParent(node: HTMLElement | EventTarget | null, el: HTMLElement) {
  let test: HTMLElement | null = node as HTMLElement | null
  while (test && test !== el) {
    test = test.parentElement
  }

  if (test) return true
  else return false
}
