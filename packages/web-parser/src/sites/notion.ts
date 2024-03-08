import { ResourceTypes, type ResourceDataDocument } from '@horizon/types'
import type { DetectedWebApp, WebService } from '../types'
import { APIExtractor, WebAppExtractor } from '../extractors'

export const NotionRegexPatterns = {
  page: /^\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/
}

export class NotionParser extends WebAppExtractor {
  constructor(app: WebService, url: URL) {
    super(app, url)
  }

  detectResourceType() {
    console.log('Detecting resource type')

    const pathname = this.url.pathname
    if (NotionRegexPatterns.page.test(pathname)) {
      console.log('Detected page')
      return ResourceTypes.DOCUMENT_NOTION
    } else {
      console.log('Unknown resource type')
      return null
    }
  }

  private getPageID() {
    const rawPageId = this.url.pathname.split('/').pop()?.split('-').pop()
    if (!rawPageId) return null

    return `${rawPageId.substring(0, 8)}-${rawPageId.substring(8, 12)}-${rawPageId.substring(12, 16)}-${rawPageId.substring(16, 20)}-${rawPageId.substring(20)}`
  }

  getInfo(): DetectedWebApp {
    const resourceType = this.detectResourceType()
    const appResourceIdentifier =
      resourceType === ResourceTypes.DOCUMENT_NOTION ? this.url.pathname : null

    return {
      appId: this.app?.id ?? null,
      appName: this.app?.name ?? null,
      hostname: this.url.hostname,
      resourceType: resourceType,
      appResourceIdentifier: appResourceIdentifier,
      resourceNeedsPicking: false
    }
  }

  async extractResourceFromDocument(document: Document) {
    const type = this.detectResourceType()
    if (type === ResourceTypes.DOCUMENT_NOTION) {
      const page = await this.getPage(document)
      if (!page) return null

      console.log('normalized page', page)

      return {
        data: page,
        type: ResourceTypes.DOCUMENT_NOTION
      }
    } else {
      console.log('Unknown resource type')
      return Promise.resolve(null)
    }
  }

  private async getPage(document: Document) {
    try {
      const pageId = this.getPageID()
      if (!pageId) {
        console.log('No page id found')
        return null
      }

      const api = new APIExtractor(this.url.origin)

      const jsonResponse = await api.postJSON('/api/v3/loadCachedPageChunk', {
        page: {
          id: pageId
        },
        limit: 30,
        cursor: {
          stack: []
        },
        chunkNumber: 0,
        verticalColumns: false
      })

      const pageData = jsonResponse.recordMap.block[pageId].value
      const pageProperties = pageData.properties

      const createdAt = new Date(pageData.created_time).toISOString()
      const lastEditedTime = new Date(pageData.last_edited_time).toISOString()

      const pageTitle = pageProperties.title[0][0]
      const createdByNotionUserId = pageData.created_by_id

      const userResponse = await api.postJSON('/api/v3/getRecordValues', {
        requests: [
          {
            id: createdByNotionUserId,
            table: 'notion_user',
            version: -1
          }
        ]
      })

      const user = userResponse.recordMapWithRoles.notion_user[createdByNotionUserId].value
      const author = user.email
      const author_fullname = user.name
      const author_image = user.profile_photo

      const contentElem = document.querySelector('.notion-page-content')
      const contentPlain = contentElem?.textContent
      const contentHtml = contentElem?.innerHTML

      return {
        url: this.url.href,
        title: pageTitle,
        date_created: createdAt,
        date_edited: lastEditedTime,

        editor_name: 'Notion',
        editor_icon: 'https://www.notion.so/favicon.ico',

        author: author,
        author_fullname: author_fullname,
        author_image: author_image,
        author_url: null,

        content_plain: contentPlain,
        content_html: contentHtml
      } as ResourceDataDocument
    } catch (e) {
      console.error('Error getting post data', e)
      return null
    }
  }
}

export default NotionParser
