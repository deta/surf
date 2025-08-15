const SUPPORTED_WIKI_LANGUAGES = [
  'en',
  'de',
  'fr',
  'es',
  'it',
  'nl',
  'pl',
  'pt',
  'ru',
  'ja',
  'zh',
  'ar',
  'hi'
]

export class WikipediaAPI {
  constructor() {}

  private async localFetch(url: string, init?: RequestInit) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'Content-Type': 'text/html'
      },
      ...init
    })

    if (!response.ok) {
      throw new Error('Failed to fetch the page')
    }

    return response.json()
  }

  private async fetchJSON(url: string, init?: RequestInit) {
    if (
      typeof window !== 'undefined' &&
      // @ts-ignore
      typeof window.api !== 'undefined' &&
      // @ts-ignore
      typeof window.api.fetchJSON === 'function'
    ) {
      console.log('Using window.api')
      // @ts-ignore
      return window.api.fetchJSON(url, init)
    } else {
      console.log('Using fetch API')
      return this.localFetch(url, init)
    }
  }

  getLangCode(lang?: string) {
    if (!lang) {
      return 'en'
    }

    const code = lang.toLowerCase().trim()
    if (SUPPORTED_WIKI_LANGUAGES.includes(code)) {
      return code
    }

    return 'en'
  }

  /* Call the Wikipedia API to search for articles based on the query */
  async search(query: string, lang?: string) {
    const langCode = this.getLangCode(lang)
    const url = `https://${langCode}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${query}&format=json`

    const data = await this.fetchJSON(url)

    console.log('Search results:', data.query.search)

    return data.query.search
  }

  async getPage(id: string, lang?: string) {
    const langCode = this.getLangCode(lang)
    const url = `https://${langCode}.wikipedia.org/w/api.php?action=parse&pageid=${id}&format=json&prop=text|properties|pageImages`

    const data = await this.fetchJSON(url)
    const page = data.parse

    console.log('Page data:', page)

    const properties = page.properties
    const description = properties.find((prop: any) => prop.name === 'wikibase-shortdesc')?.['*']

    // "page_image_free"
    const imageName = properties.find((prop: any) => prop.name === 'page_image_free')?.['*']
    const imageUrl = imageName ? `https://${langCode}.wikipedia.org/wiki/File:${imageName}` : null

    return {
      id: page.pageid,
      url: `https://${langCode}.wikipedia.org/?curid=${id}`,
      title: page.title,
      description: description,
      image: imageUrl,
      content: page.text['*']
    }
  }

  async getFirstPage(query: string, lang?: string) {
    const results = await this.search(query, lang)

    if (results.length === 0) {
      return null
    }

    const firstResult = results[0]

    const page = await this.getPage(firstResult.pageid, lang)

    return page
  }

  async getPages(query: string, limit = 5, lang?: string) {
    const results = await this.search(query, lang)

    const pages = await Promise.all(
      results.slice(0, limit).map((result: any) => this.getPage(result.pageid, lang))
    )

    return pages
  }

  static createWikipediaAPI() {
    return new WikipediaAPI()
  }
}

export const createWikipediaAPI = WikipediaAPI.createWikipediaAPI
