import { WebViewExtractor } from '../extractors'

export type SearchResultLink = {
  title: string
  url: string
}

export interface BochaSearchConfig {
  apiKey: string
  baseUrl?: string
  country?: string
  language?: string
}

/**
 * 博查 Web Search API - 兼容 Bing Search API
 * 文档参考：https://docs.bochaai.com/
 */
export class BochaSearchAPI {
  private apiKey: string
  private baseUrl: string
  private country: string
  private language: string

  constructor(config?: BochaSearchConfig) {
    this.apiKey = config?.apiKey || ''
    this.baseUrl = config?.baseUrl || 'https://api.bochaai.com/api/v1/web-search'
    this.country = config?.country || 'CN'
    this.language = config?.language || 'zh-CN'
  }

  /**
   * 调用博查搜索 API 进行搜索
   * @param query 搜索查询
   * @param limit 返回结果数量限制
   * @returns 搜索结果数组
   */
  async search(query: string, limit = 5): Promise<SearchResultLink[]> {
    const url = new URL(this.baseUrl)
    url.searchParams.append('query', query)
    url.searchParams.append('count', limit.toString())
    url.searchParams.append('country', this.country)
    url.searchParams.append('language', this.language)

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          query: query,
          count: limit,
          country: this.country,
          language: this.language
        })
      })

      if (!response.ok) {
        throw new Error(`Search API request failed with status: ${response.status}`)
      }

      const data = await response.json()
      
      // 解析博查 API 返回的搜索结果
      const results: SearchResultLink[] = []
      
      if (data.data && Array.isArray(data.data.webPages)) {
        for (const page of data.data.webPages.value || data.data.webPages) {
          results.push({
            title: page.name || page.title || '',
            url: page.url || page.link || ''
          })
        }
      } else if (data.results && Array.isArray(data.results)) {
        // 兼容不同的返回格式
        for (const item of data.results) {
          results.push({
            title: item.title || item.name || '',
            url: item.url || item.link || ''
          })
        }
      }

      return results.slice(0, limit)
    } catch (error: any) {
      console.error('Bocha Search API error:', error)
      throw new Error(`Search failed: ${error.message}`)
    }
  }

  /**
   * 使用 HTML 解析方式提取搜索结果（备用方案）
   * @param html 搜索结果的 HTML 内容
   * @returns 搜索结果数组
   */
  async extractSearchResults(html: string): Promise<SearchResultLink[]> {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // 博查搜索结果的 CSS 选择器（根据实际情况调整）
    const links = doc.querySelectorAll('a.result-title, a[data-title], h3 a')

    const results: SearchResultLink[] = []

    links.forEach((link) => {
      const title = link.textContent?.trim() || ''
      const url = (link as HTMLAnchorElement).href || ''
      
      if (title && url) {
        results.push({ title, url })
      }
    })

    return results
  }

  /**
   * 创建博查搜索 API 实例的工厂方法
   * @param config 配置选项
   * @returns BochaSearchAPI 实例
   */
  static createBochaSearchAPI(config?: BochaSearchConfig) {
    return new BochaSearchAPI(config)
  }
}

export const createBochaSearchAPI = BochaSearchAPI.createBochaSearchAPI
