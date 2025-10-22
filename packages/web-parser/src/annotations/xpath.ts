export function getXPath(node: Node): string | undefined {
  if (node.nodeType === Node.TEXT_NODE) {
    let count: number = 0
    let sibling: Node | null = node.previousSibling

    while (sibling) {
      if (sibling.nodeType === Node.TEXT_NODE) {
        count++
      }
      sibling = sibling.previousSibling
    }

    return getXPath(node.parentNode as Node) + '/text()[' + (count + 1) + ']'
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    let elem: Element = node as Element
    if (elem.id && document.getElementById(elem.id) === elem) {
      return 'id("' + elem.id + '")'
    } else if (elem === document.documentElement) {
      return elem.tagName.toLowerCase()
    } else {
      let siblingIndex: number = getSiblingIndex(elem)
      return `${getXPath(elem.parentNode as Node)}/${elem.tagName.toLowerCase()}[${siblingIndex}]`
    }
  } else {
    return
  }
}

function getSiblingIndex(node: Node): number {
  let index: number = 1 // XPath is 1-indexed
  let sibling: Node | null = node.previousSibling

  while (sibling) {
    if (
      sibling.nodeType === node.nodeType &&
      (node.nodeType === Node.TEXT_NODE ||
        (node.nodeType === Node.ELEMENT_NODE &&
          (sibling as Element).tagName === (node as Element).tagName))
    ) {
      index++
    }

    sibling = sibling.previousSibling
  }

  return index
}
