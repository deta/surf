import { WebViewExtractor } from '../extractors'

export type SearchResultLink = {
  title: string
  url: string
}

export class DuckDuckGoAPI {
  constructor() {}

  async extractSearchResults(html: string) {
    // parse html to extract search result links
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const links = doc.querySelectorAll('a[data-testid="result-title-a"]')

    const results = []

    links.forEach((link) => {
      results.push({
        title: link.textContent,
        url: (link as any).href
      })
    })

    return links
  }

  /* Call the Search API to search for links based on the query */
  async search(query: string, limit = 5) {
    const url = new URL(`https://duckduckgo.com/?q=${query}&kl=us-en`)

    const webviewParser = new WebViewExtractor(url, document)

    await webviewParser.initializeWebview()

    const output = await webviewParser.executeJavaScript<SearchResultLink[]>(
      `Array.from(document.querySelectorAll('li[data-layout="organic"] a[data-testid="result-title-a"]')).map(elem => ({ url: elem.href, title: elem.textContent }))`
    )

    console.log('Search results:', output)

    return output.slice(0, limit)
  }

  static createDuckDuckGoAPI() {
    return new DuckDuckGoAPI()
  }
}

export const createDuckDuckGoAPI = DuckDuckGoAPI.createDuckDuckGoAPI
