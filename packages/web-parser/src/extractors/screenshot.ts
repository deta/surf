export class ScreenshotExtractor {
  url: URL | string

  constructor(url: URL | string) {
    this.url = url
  }

  private async fetchRemoteHTML() {
    const response = await fetch(this.url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'Content-Type': 'text/html'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch the page')
    }

    return response.text()
  }

  private createDocumentFromHTML = (html: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    return doc
  }

  private async takeScreenshot(document: Document) {
    const html = document.documentElement.outerHTML
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)

    const iframe = document.createElement('iframe')
    iframe.src = url
    iframe.style.width = '100vw'
    iframe.style.height = '100vh'
    iframe.style.position = 'absolute'
    iframe.style.top = '0'
    iframe.style.left = '0'
    iframe.style.zIndex = '-1'
    document.body.appendChild(iframe)

    return new Promise<string>((resolve, reject) => {
      iframe.onload = async () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = iframe.contentWindow!.innerWidth
          canvas.height = iframe.contentWindow!.innerHeight
          const context = canvas.getContext('2d')!

          context.drawImage(iframe.contentWindow!.document.body, 0, 0)
          const dataUrl = canvas.toDataURL('image/png')
          document.body.removeChild(iframe)
          resolve(dataUrl)
        } catch (error) {
          document.body.removeChild(iframe)
          reject(error)
        }
      }
    })
  }

  async extractRemote() {
    let html: string
    if (
      typeof window !== 'undefined' &&
      // @ts-ignore
      typeof window.api !== 'undefined' &&
      // @ts-ignore
      typeof window.api.fetchHTMLFromRemoteURL === 'function'
    ) {
      console.log('Using window.api')
      // @ts-ignore
      html = await window.api.fetchHTMLFromRemoteURL(this.url.href)
    } else {
      console.log('Using fetch API')
      html = await this.fetchRemoteHTML()
    }

    const document = this.createDocumentFromHTML(html)
    const screenshot = await this.takeScreenshot(document)

    return { screenshot }
  }
}
