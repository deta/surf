export interface ResourceDataHistoryEntry {
  /** Raw URL of the actual page */
  raw_url: string
  /** Title of the page */
  title: string
  /** ID of the app serving the page if it is a supported one (see web-parser/services) */
  app_id: string | null
  /** ID internal to the app (e.g. tweet id)  */
  app_resource_identifier: string | null
  /** When the page was last loaded (e.g. if it was reloaded or navigated back to) */
  last_loaded: string
}

// additionally the canonical URL of the page and the linked resource are stored as tags
