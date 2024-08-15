export class DOMExtractor {
  document: Document

  constructor(document: Document) {
    this.document = document
  }

  getElementByAttribute(atttribute: string, value?: string) {
    const selector = value ? `[${atttribute}="${value}"]` : `[${atttribute}]`
    return this.document.querySelector(selector)
  }

  getRawHTML() {
    return this.document.documentElement.outerHTML
  }

  getInnerText() {
    return this.document.body.innerText
  }

  attachEventListener(node: Document | Element | Window, event: string, callback: EventListener) {
    node.addEventListener(event, callback)

    return () => {
      node.removeEventListener(event, callback)
    }
  }
}
