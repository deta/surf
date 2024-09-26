import type {
  AnnotationRangeData,
  AnnotationType,
  DetectedResource,
  DetectedWebApp,
  ResourceDataAnnotation
} from './resources.types'

export enum WebViewEventReceiveNames {
  GetSelection = 'get_selection',
  GetResource = 'get_resource',
  GetApp = 'get_app',
  RunAction = 'run_action',
  TransformationOutput = 'transformation_output',
  RestoreAnnotation = 'restore_annotation',
  ScrollToAnnotation = 'scroll_to_annotation',
  HighlightText = 'highlight_text',
  SeekToTimestamp = 'seek_to_timestamp',
  SimulateDragStart = 'simulate_drag_start',
  SimulateDragUpdate = 'simulate_drag_update',
  SimulateDragEnd = 'simulate_drag_end'
}

export enum WebViewEventSendNames {
  Wheel = 'wheel',
  // NOTE: Using prefix for mouse events, not to confuse with app window events!
  MouseMove = 'passthrough_mousemove',
  MouseUp = 'passthrough_mouseup',
  DragEnter = 'passthrough_dragenter',
  DragOver = 'passthrough_dragover',
  DragLeave = 'passthrough_dragleave',
  Drag = 'passthrough_drag',
  Drop = 'passthrough_drop',
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
  Annotate = 'annotate',
  Copy = 'copy',
  InlineTextReplace = 'inline_text_replace',
  AnnotationClick = 'annotation_click',
  RemoveAnnotation = 'remove_annotation',
  UpdateAnnotation = 'update_annotation',
  AddToChat = 'add_to_chat'
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

export type WebViewEventAnnotation = { id: string; data: ResourceDataAnnotation }

export type WebViewEventHighlightText = { texts: string[] }

export type WebViewEventSeekToTimestamp = { timestamp: number }

export type WebViewEventTransform = {
  text: string
  query?: string
  type: 'summarize' | 'explain' | 'translate' | 'grammar' | 'custom'
  includePageContext: boolean
  isFollowUp?: boolean
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

export type WebViewEventUpdateAnnotation = {
  id: string
  data: Partial<ResourceDataAnnotation['data']>
}

export type WebViewEventSimulateDragStart = {
  lientX: number
  clientY: number
  data: {
    strings: { type: string; value: undefined }[]
    files: { name: string; type: string; buffer: undefined }[]
  }
}
export type WebViewEventSimulateDragUpdate = {
  clientX: number
  clientY: number
}
export type WebViewEventSimulateDragEnd = {
  action: 'abort' | 'drop'
  clientX: number
  clientY: number

  /// additional data here if it needs to be overridden
  data?: {
    strings: { type: string; value: string }[]
    files: { name: string; type: string; buffer: ArrayBuffer }[]
  }
}

export type WebViewReceiveEvents = {
  [WebViewEventReceiveNames.GetSelection]: void
  [WebViewEventReceiveNames.GetResource]: void
  [WebViewEventReceiveNames.GetApp]: void
  [WebViewEventReceiveNames.RunAction]: WebViewEventRunAction
  [WebViewEventReceiveNames.TransformationOutput]: WebViewEventTransformationOutput
  [WebViewEventReceiveNames.RestoreAnnotation]: WebViewEventAnnotation
  [WebViewEventReceiveNames.ScrollToAnnotation]: WebViewEventAnnotation
  [WebViewEventReceiveNames.HighlightText]: WebViewEventHighlightText
  [WebViewEventReceiveNames.SeekToTimestamp]: WebViewEventSeekToTimestamp
  [WebViewEventReceiveNames.SimulateDragStart]: WebViewEventSimulateDragStart
  [WebViewEventReceiveNames.SimulateDragUpdate]: WebViewEventSimulateDragUpdate
  [WebViewEventReceiveNames.SimulateDragEnd]: WebViewEventSimulateDragEnd
}

export type WebViewSendEvents = {
  [WebViewEventSendNames.Wheel]: WebViewEventWheel
  [WebViewEventSendNames.MouseMove]: MouseEvent
  [WebViewEventSendNames.MouseUp]: MouseEvent
  [WebViewEventSendNames.Drag]: DragEvent
  [WebViewEventSendNames.DragEnter]: DragEvent
  [WebViewEventSendNames.DragOver]: DragEvent
  [WebViewEventSendNames.DragLeave]: DragEvent
  [WebViewEventSendNames.Drop]: DragEvent
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
  [WebViewEventSendNames.Annotate]: ResourceDataAnnotation
  [WebViewEventSendNames.InlineTextReplace]: WebViewEventInlineTextReplace
  [WebViewEventSendNames.AnnotationClick]: WebViewEventAnnotationClick
  [WebViewEventSendNames.RemoveAnnotation]: string
  [WebViewEventSendNames.UpdateAnnotation]: WebViewEventUpdateAnnotation
  [WebViewEventSendNames.AddToChat]: string
  [WebViewEventSendNames.Copy]: string
}

export enum WebviewAnnotationEventNames {
  Click = 'deta_annotation_click'
}

export type WebviewAnnotationEvents = {
  [WebviewAnnotationEventNames.Click]: WebViewEventAnnotationClick
}
