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
  SimulateDragEnd = 'simulate_drag_end',
  GoToPDFPage = 'go_to_pdf_page',
  // NOTE: There is no PIP enter, as it needs user gesture "workaround"
  RequestExitPIP = 'request_exit_picture_in_picture',
  RequestPIPState = 'request_picture_in_picture_state'
}

export enum WebViewEventSendNames {
  Wheel = 'wheel',
  // NOTE: Using prefix for drag events, not to confuse with app window events!
  DragEnter = 'passthrough_dragenter',
  DragOver = 'passthrough_dragover',
  DragLeave = 'passthrough_dragleave',
  Drag = 'passthrough_drag',
  Drop = 'passthrough_drop',
  Focus = 'focus',
  KeyUp = 'key_up',
  KeyDown = 'key_down',
  MouseClick = 'mouse_click',
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
  AddToChat = 'add_to_chat',
  FullscreenChange = 'fullscreen_change',
  PIPState = 'picture_in_picture_state'
}

// NOTE: This is separate from the IPC events, as some actions
// (such as requesting PIP) require special user interaction.
// Electron can circumvent this by calling
// `webview.executeJavaScript(..., true)` but this means that it sadly
// works separate from our other IPC events.
export enum WebViewGestureRequiredEventNames {
  RequestEnterPIP = 'surf__request_enter_pip'
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

export type WebViewEventMouseClick = {
  clientX: number
  clientY: number
  button: number
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
export type WebViewEventGoToPDFPage = {
  page: number
  targetText?: string
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
  [WebViewEventReceiveNames.GoToPDFPage]: WebViewEventGoToPDFPage
  [WebViewEventReceiveNames.RequestExitPIP]: void
  [WebViewEventReceiveNames.RequestPIPState]: void
}

export type WebViewSendEvents = {
  [WebViewEventSendNames.Wheel]: WebViewEventWheel
  [WebViewEventSendNames.Drag]: DragEvent
  [WebViewEventSendNames.DragEnter]: DragEvent
  [WebViewEventSendNames.DragOver]: DragEvent
  [WebViewEventSendNames.DragLeave]: DragEvent
  [WebViewEventSendNames.Drop]: DragEvent
  [WebViewEventSendNames.Focus]: void
  [WebViewEventSendNames.KeyUp]: WebViewEventKeyUp
  [WebViewEventSendNames.KeyDown]: WebViewEventKeyDown
  [WebViewEventSendNames.MouseClick]: WebViewEventMouseClick
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
  [WebViewEventSendNames.PIPState]: { pip: boolean }
  [WebViewEventSendNames.FullscreenChange]: { fullscreen: boolean }
}

export enum WebviewAnnotationEventNames {
  Click = 'deta_annotation_click'
}

export type WebviewAnnotationEvents = {
  [WebviewAnnotationEventNames.Click]: WebViewEventAnnotationClick
}

export const WEBVIEW_MOUSE_CLICK_WINDOW_EVENT = 'webview-mouse-click'
