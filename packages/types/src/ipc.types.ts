import type {
  AnnotationRangeData,
  AnnotationType,
  DetectedResource,
  DetectedWebApp
} from './resources.types'

export enum WebViewEventReceiveNames {
  GetSelection = 'get_selection',
  GetResource = 'get_resource',
  GetApp = 'get_app',
  RunAction = 'run_action',
  TransformationOutput = 'transformation_output',
  RestoreHighlight = 'restore_highlight',
  ScrollToAnnotation = 'scroll_to_annotation'
}

export enum WebViewEventSendNames {
  Wheel = 'wheel',
  Focus = 'focus',
  KeyUp = 'key_up',
  KeyDown = 'key_down',
  DetectedApp = 'detected_app',
  DetectedResource = 'detected_resource',
  ActionOutput = 'action_output',
  InsertText = 'insert_text',
  Bookmark = 'bookmark',
  Transform = 'transform',
  Selection = 'selection',
  Highlight = 'highlight',
  InlineTextReplace = 'inline_text_replace',
  AnnotationClick = 'annotation_click'
}

export type WebViewEventTransformationOutput = {
  text: string
}

export type WebViewEventRunAction = {
  id: string
  inputs: Record<string, any>
}

export type WebViewEventKeyUp = {
  key: string
}

export type WebViewEventKeyDown = {
  key: string
  code: string
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
  altKey: boolean
}

export type WebViewEventWheel = {
  deltaX: number
  deltaY: number
  deltaZ: number
  deltaMode: number
  clientX: number
  clientY: number
  pageX: number
  pageY: number
  screenX: number
  screenY: number
}

export type WebViewEventBookmark = { text?: string; url: string }

export type WebViewEventHighlight = { range: AnnotationRangeData; url: string }

export type WebViewEventRestoreHighlight = { id: string; range: AnnotationRangeData }

export type WebViewEventTransform = {
  text: string
  query?: string
  type: 'summarize' | 'explain' | 'translate' | 'grammar' | 'custom'
}

export type WebViewEventActionOutput = {
  id: string
  output: any
}

export type WebViewEventInlineTextReplace = {
  target: string
  content: string
}

export type WebViewEventAnnotationClick = {
  id: string
  type: AnnotationType
}

export type WebViewReceiveEvents = {
  [WebViewEventReceiveNames.GetSelection]: void
  [WebViewEventReceiveNames.GetResource]: void
  [WebViewEventReceiveNames.GetApp]: void
  [WebViewEventReceiveNames.RunAction]: WebViewEventRunAction
  [WebViewEventReceiveNames.TransformationOutput]: WebViewEventTransformationOutput
  [WebViewEventReceiveNames.RestoreHighlight]: WebViewEventRestoreHighlight
  [WebViewEventReceiveNames.ScrollToAnnotation]: string
}

export type WebViewSendEvents = {
  [WebViewEventSendNames.Wheel]: WebViewEventWheel
  [WebViewEventSendNames.Focus]: void
  [WebViewEventSendNames.KeyUp]: WebViewEventKeyUp
  [WebViewEventSendNames.KeyDown]: WebViewEventKeyDown
  [WebViewEventSendNames.DetectedApp]: DetectedWebApp
  [WebViewEventSendNames.DetectedResource]: DetectedResource | null
  [WebViewEventSendNames.ActionOutput]: WebViewEventActionOutput
  [WebViewEventSendNames.InsertText]: string
  [WebViewEventSendNames.Bookmark]: WebViewEventBookmark
  [WebViewEventSendNames.Transform]: WebViewEventTransform
  [WebViewEventSendNames.Selection]: string
  [WebViewEventSendNames.Highlight]: WebViewEventHighlight
  [WebViewEventSendNames.InlineTextReplace]: WebViewEventInlineTextReplace
  [WebViewEventSendNames.AnnotationClick]: WebViewEventAnnotationClick
}

export enum WebviewAnnotationEventNames {
  Click = 'deta_annotation_click'
}

export type WebviewAnnotationEvents = {
  [WebviewAnnotationEventNames.Click]: WebViewEventAnnotationClick
}
