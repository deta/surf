import { ResourceTypes, type ResourceDataDocument } from '@deta/types'
import type { DetectedWebApp, WebService, WebServiceActionInputs } from '../types'
import { APIExtractor, WebAppExtractor } from '../extractors'
import { SERVICES } from '../services'

import { parseStringIntoUrl, parseTextIntoISOString, wait } from '@deta/utils'
import { minifyHTML, sanitizeHTML } from '../utils'

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

    return `${rawPageId.substring(0, 8)}-${rawPageId.substring(8, 12)}-${rawPageId.substring(
      12,
      16
    )}-${rawPageId.substring(16, 20)}-${rawPageId.substring(20)}`
  }

  private cleanedUpURL() {
    return this.url.href.split('?')[0]
  }

  getInfo(): DetectedWebApp {
    const resourceType = this.detectResourceType()
    const appResourceIdentifier =
      resourceType === ResourceTypes.DOCUMENT_NOTION ? this.getPageID() : this.url.pathname

    return {
      appId: this.app?.id ?? null,
      appName: this.app?.name ?? null,
      hostname: this.url.hostname,
      canonicalUrl: this.cleanedUpURL(),
      resourceType: resourceType,
      appResourceIdentifier: appResourceIdentifier,
      resourceNeedsPicking: false
    }
  }

  getActions() {
    return SERVICES.find((service) => service.id === 'notion')?.actions ?? []
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

  async runAction(document: Document, id: string, inputs: WebServiceActionInputs) {
    const action = this.getActions().find((action) => action.id === id)
    if (!action) return null

    console.log('Running action', action)

    if (action.id === 'get_page_content_from_notion') {
      const page = await this.getPage(document)
      if (!page) return null

      console.log('normalized page', page)

      return {
        data: page,
        type: action.output?.type ?? null
      }
    } else if (action.id === 'update_page_content_in_notion') {
      const content = inputs.content
      console.log('updating page with content', content)

      const contentElem = document.querySelector('.notion-page-content')
      if (!contentElem) {
        console.error('No content element found')
        return null
      }

      // @ts-ignore
      contentElem.focus()

      // TODO: position cursor at the end of the content

      await wait(500)

      // TODO: find better way to do this. This is coming from the webview.ts preload script
      console.log('inserting text using window function', content)
      // @ts-expect-error
      window.insertText(content.replace(/(?:\r\n|\r|\n)/g, ' '))

      // const page = await this.updatePage(document, input)
      // if (!page) return null

      // console.log('normalized page', page)

      // return {
      //   data: page,
      //   type: action.output?.type ?? null
      // }

      return {
        data: 'Successfully updated the notion page',
        type: 'text/plain'
      }
    } else {
      return null
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
      const contentElem = document.querySelector('.notion-page-content')
      const contentPlain = contentElem?.textContent
      const contentHtml = contentElem?.innerHTML

      const cleanHTML = contentHtml ? sanitizeHTML(contentHtml) : null
      const cleanPlain = contentPlain ? sanitizeHTML(contentPlain) : null

      const minifiedHTML = cleanHTML ? await minifyHTML(cleanHTML) : null

      return {
        url: this.url.href,
        title: sanitizeHTML(pageTitle),
        date_created: parseTextIntoISOString(pageData.created_time),
        date_edited: parseTextIntoISOString(pageData.last_edited_time),

        editor_name: 'Notion',
        editor_icon: 'https://www.notion.so/favicon.ico',

        author: sanitizeHTML(user.email),
        author_fullname: sanitizeHTML(user.name),
        author_image: parseStringIntoUrl(user.profile_photo, this.url)?.href,
        author_url: null,

        content_plain: cleanPlain,
        content_html: minifiedHTML
      } as ResourceDataDocument
    } catch (e) {
      console.error('Error getting post data', e)
      return null
    }
  }

  // private async updatePage(document: Document, newContent: string) {
  //   const page = await this.getPage(document)
  //   if (!page) return null

  //   console.log('updating page with content', newContent, page)

  //   return {
  //     data: page,
  //     type: ResourceTypes.DOCUMENT_NOTION
  //   }
  // }
}

export default NotionParser
