export type AnnotationType = 'highlight' | 'comment' | 'link'
export type AnnotationAnchorType = 'range' | 'element' | 'area'

export interface ResourceDataAnnotation {
  type: AnnotationType
  data: AnnotationHighlightData | AnnotationCommentData | AnnotationLinkData
  anchor: {
    type: AnnotationAnchorType
    data: AnnotationRangeData | AnnotationElementData | AnnotationAreaData
  } | null
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
export type AnnotationHighlightData = {
  url?: string
}

// data stored for comments
export type AnnotationCommentData = {
  url?: string
  source: 'user' | 'inline_ai' | 'chat_ai'
  content_html?: string
  content_plain: string
  tags?: string[]
}

// data stored for links
export type AnnotationLinkData = {
  target_type: 'external' | 'resource'
  url: string | null
  resource_id: string | null
}

export type AnnotationCommentRange = {
  id: string
  range: Range
  data: AnnotationCommentData
}
