import { ResourceTypes, type ResourceDataTable, type ResourceDataTableColumn } from '@deta/types'
import type { DetectedWebApp, WebService, WebServiceActionInputs } from '../types'
import { WebAppExtractorActions } from '../extractors'
import { SERVICES } from '../services'
import { sanitizeHTML } from '../utils'

export const TypeformRegexPatterns = {
  table: /\/form\/([^\/]+)\/results#responses/
}

export class TypeformParser extends WebAppExtractorActions {
  constructor(app: WebService, url: URL) {
    super(app, url)
  }

  detectResourceType() {
    console.log('Detecting resource type')

    const pathname = this.url.pathname + this.url.hash
    if (TypeformRegexPatterns.table.test(pathname)) {
      console.log('Detected form')
      return ResourceTypes.TABLE_TYPEFORM
    } else {
      console.log('Unknown resource type')
      return null
    }
  }

  private getFormID() {
    const regex = /\/form\/([^\/]+)\/results#responses/
    const pathname = this.url.pathname + this.url.hash
    const match = pathname.match(regex)
    if (!match) return null

    return match[1]
  }

  getInfo(): DetectedWebApp {
    const resourceType = this.detectResourceType()
    const appResourceIdentifier =
      resourceType === ResourceTypes.TABLE_TYPEFORM ? this.getFormID() : this.url.pathname

    return {
      appId: this.app?.id ?? null,
      appName: this.app?.name ?? null,
      hostname: this.url.hostname,
      canonicalUrl: this.url.href,
      resourceType: resourceType,
      appResourceIdentifier: appResourceIdentifier,
      resourceNeedsPicking: false
    }
  }

  getActions() {
    return SERVICES.find((service) => service.id === 'typeform')?.actions ?? []
  }

  async extractResourceFromDocument(document: Document) {
    const type = this.detectResourceType()
    if (type === ResourceTypes.TABLE_TYPEFORM) {
      const table = await this.getTable(document)
      if (!table) return null

      console.log('normalized table', table)

      return {
        data: table,
        type: ResourceTypes.TABLE_TYPEFORM
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

    if (action.id === 'get_table_from_typeform') {
      const data = await this.getTable(document)
      if (!data) return null

      console.log('data', data)

      return {
        data: data,
        type: action.output?.type ?? ResourceTypes.TABLE_TYPEFORM
      }
    } else if (action.id === 'get_table_column_from_typeform') {
      const column = inputs.column
      console.log('Getting column', column)
      const data = await this.getTableColumn(document, column)
      if (!data) return null

      console.log('data', data)

      return {
        data: data,
        type: action.output?.type ?? ResourceTypes.TABLE_COLUMN_TYPEFORM
      }
    } else {
      console.log('Unknown action')
      return null
    }
  }

  private async getTable(document: Document) {
    try {
      const formId = this.getFormID()
      if (!formId) {
        console.log('No form id found')
        return null
      }

      const responseTable = document.querySelector('#table-inner-wrapper table')
      if (!responseTable) {
        console.log('No table found')
        return null
      }

      // We slice to -2 as the last row is tags, tags for me only includes nonsense -> test if we need this for demos
      const tColNames = [...responseTable.querySelectorAll('thead th').values()]
        .slice(1, -2)
        .map((e) => e.textContent)
        .filter((x) => !!x) as string[]
      // We also slice start from 1 as first col is from html table checkbox component
      const tRows = [...responseTable.querySelectorAll('tbody tr').values()].map((e) =>
        [...e.querySelectorAll('td').values()].slice(1).map((e) => e.innerText)
      )

      // let csv = `${tColNames.map(JSON.stringify).join(", ")}
      // ${tRows.map(e => e.map(r => JSON.stringify(r)).join(", ")).join("\n")}`
      console.log('Table data', tColNames, tRows)

      const formNameInput = document.querySelector('[data-qa="editable-form-title"]') as
        | HTMLInputElement
        | undefined
      const formName = formNameInput?.value ?? 'Untitled Form'

      return {
        table_id: sanitizeHTML(formId),
        name: sanitizeHTML(formName),
        columns: tColNames.map((col) => sanitizeHTML(col)),
        rows: tRows.map((row) => row.map((cell) => sanitizeHTML(cell)))
      } as ResourceDataTable
    } catch (e) {
      console.error('Error getting table data', e)
      return null
    }
  }

  private async getTableColumn(document: Document, columnName: string) {
    try {
      const table = await this.getTable(document)
      if (!table) {
        console.log('No table found')
        return null
      }

      const colIdx = table.columns.indexOf(columnName)
      const rows = table.rows.map((row) => row[colIdx])

      return {
        table_id: table.table_id,
        table_name: table.name,
        name: columnName,
        rows
      } as ResourceDataTableColumn
    } catch (e) {
      console.error('Error getting table data', e)
      return null
    }
  }
}

export default TypeformParser
