export interface ResourceDataAnnotation {
  type: 'highlight' | 'comment' | 'link'
  data: AnnotationHighlightData | AnnotationCommentData | AnnotationLinkData
  anchor: {
    type: 'range' | 'element' | 'area'
    data: AnnotationRangeData | AnnotationElementData | AnnotationAreaData
  }
}

// used for annotations created from text selections
export type AnnotationRangeData = {
  content_plain?: string
  content_html?: string
  start_offset: number
  end_offset: number
  start_xpath: string
  end_xpath: string
}

// used for annotations created from selecting a specific element
export type AnnotationElementData = {
  xpath: string
  query_selector: string
}

// used for annotations created from drawing a rectangle of an area
export type AnnotationAreaData = {
  x: number
  y: number
  width: number
  height: number
}

// data stored for highlights (nothing stored right now)
export type AnnotationHighlightData = {}

// data stored for comments
export type AnnotationCommentData = {
  content: string
}

// data stored for links
export type AnnotationLinkData = {
  target_type: 'external' | 'resource'
  url: string | null
  resource_id: string | null
}
