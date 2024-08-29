import { sanitizeHTML } from '../utils'

export class DOMExtractor {
  document: Document

  constructor(document: Document) {
    this.document = document
  }

  getElementByAttribute(atttribute: string, value?: string) {
    const selector = value ? `[${atttribute}="${value}"]` : `[${atttribute}]`
    return this.document.querySelector(selector)
  }

  private getRawHTML() {
    return this.document.documentElement.outerHTML
  }

  private getInnerText() {
    return this.document.body.innerText
  }

  getContent() {
    const html = this.getRawHTML()
    const plain = this.getInnerText()

    const cleanHTML = sanitizeHTML(html)
    const cleanPlain = sanitizeHTML(plain)

    return {
      html: cleanHTML,
      plain: cleanPlain
    }
  }

  attachEventListener(node: Document | Element | Window, event: string, callback: EventListener) {
    node.addEventListener(event, callback)

    return () => {
      node.removeEventListener(event, callback)
    }
  }
}
