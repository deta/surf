import { ResourceTypes, type ResourceDataTable } from '@deta/types'
import type { DetectedWebApp, WebService, WebServiceActionInputs } from '../types'
import { WebAppExtractorActions } from '../extractors'
import { SERVICES } from '../services'

export const GoogleSheetsRegexPatterns = {
  table: /\/spreadsheets\/d\/([^\/]+)\/edit/
}

export class GoogleSheetsParser extends WebAppExtractorActions {
  constructor(app: WebService, url: URL) {
    super(app, url)

    // TODO: Send evnt up -> listen to reqs -> listen for token evnts down -> wait till token is set
  }

  detectResourceType() {
    console.log('Detecting resource type')

    const pathname = this.url.pathname + this.url.hash
    if (GoogleSheetsRegexPatterns.table.test(pathname)) {
      console.log('Detected google sheet table')
      return ResourceTypes.TABLE_GOOGLE_SHEET
    } else {
      console.log('Unknown resource type')
      return null
    }
  }

  private getSheetID() {
    const regex = /\/spreadsheets\/d\/([^\/]+)\/edit/
    const pathname = this.url.pathname + this.url.hash
    const match = pathname.match(regex)
    if (!match) return null

    return match[1]
  }

  // private getGID() {
  //   // FIX: Not matching gid!?? y??
  //   const regex = /\/spreadsheets\/d\/[^\/]+\/edit#gid=([^\/\s]+)/
  //   const pathname = this.url.pathname + this.url.hash
  //   const match = pathname.match(regex)
  //   if (!match) return null

  //   return match[1]
  // }

  getInfo(): DetectedWebApp {
    const resourceType = this.detectResourceType()
    const appResourceIdentifier =
      resourceType === ResourceTypes.TABLE_GOOGLE_SHEET ? this.getSheetID() : null

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
    return SERVICES.find((service) => service.id === 'google.sheets')?.actions ?? []
  }

  async extractResourceFromDocument(document: Document) {
    const type = this.detectResourceType()
    if (type === ResourceTypes.TABLE_GOOGLE_SHEET) {
      const table = await this.getTable(document)
      if (!table) return null

      console.log('normalized table', table)

      return {
        data: table,
        type: ResourceTypes.TABLE_GOOGLE_SHEET
      }
    } else {
      console.log('Unknown resource type')
      return Promise.resolve(null)
    }
  }

  async runAction(document: Document, id: string, inputs: WebServiceActionInputs) {
    // TODO: UPDATE for sheets!
    const action = this.getActions().find((action) => action.id === id)
    if (!action) return null

    console.log('Running action', action)

    if (action.id === 'get_table_from_googlesheet') {
      const data = await this.getTable(document)
      if (!data) return null

      console.log('data', data)

      return {
        data: data,
        type: action.output?.type ?? ResourceTypes.TABLE_GOOGLE_SHEET
      }
    } else if (action.id === 'get_table_column_from_googlesheet') {
      const column = inputs.column
      console.log('Getting column', column)
      const data = await this.getTableColumn(document, column)
      if (!data) return null

      console.log('data', data)

      return {
        data: data,
        type: action.output?.type ?? ResourceTypes.TABLE_COLUMN_GOOGLE_SHEET
      }
    } else if (action.id === 'set_table_in_googlesheet') {
      // TODO: IMPL
      return null
    } else {
      console.log('Unknown action')
      return null
    }
  }

  private async getTable(_document: Document) {
    try {
      //window.sheetsApiLastReqID = window.sheetsApiLastReqID || 200; // Start big just in case
      const sheetId = this.getSheetID()
      if (!sheetId) {
        console.log('No sheet id found')
        return null
      }

      const gId = '0' // TODO: EXtract

      // NOTE: This currently requires the sheet to be public with "visible to anyone with link"!
      const format = 'csv'
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:${format}&sheet=${gId}`,
        {
          method: 'get',
          headers: {
            'content-type': 'text/csv;charset=UTF-8'
          }
        }
      )
      const tableCsv = await res.text()
      console.warn('google seht dump!')
      console.log(tableCsv)

      return {
        table_id: sheetId,
        name: 'Sheet',
        columns: [],
        rows: []
      } as ResourceDataTable
    } catch (e) {
      console.error('Error getting table data', e)
      return null
    }
  }

  private async getTableColumn(_document: Document, _columnName: string) {
    return null
    //   try {
    //     const table = await this.getTable(document)
    //     if (!table) {
    //       console.log('No table found')
    //       return null
    //     }

    //     const colIdx = table.columns.indexOf(columnName)
    //     const rows = table.rows.map((row) => row[colIdx])

    //     return {
    //       table_id: table.table_id,
    //       table_name: table.name,
    //       name: columnName,
    //       rows
    //     } as ResourceDataTableColumn
    //   } catch (e) {
    //     console.error('Error getting table data', e)
    //     return null
    //   }
  }
}

export default GoogleSheetsParser
