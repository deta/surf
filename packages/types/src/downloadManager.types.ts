export type DownloadState = 'idle' | 'progressing' | 'interrupted' | 'completed' | 'cancelled'

export interface DownloadRequestMessage {
  id: string
  url: string
  filename: string
  mimeType: string
  totalBytes: number
  contentDisposition: string
  startTime: number
  hasUserGesture: boolean
  sourceIsPDFViewer: boolean
}

export interface DownloadPathResponseMessage {
  path: string | null
  copyToDownloads: boolean
}

export interface DownloadUpdatedMessage {
  id: string
  state: DownloadState
  receivedBytes: number
  totalBytes: number
  isPaused: boolean
  canResume: boolean
}

export interface DownloadDoneMessage {
  id: string
  state: DownloadState
  filename: string
  mimeType: string
  totalBytes: number
  contentDisposition: string
  startTime: number
  endTime: number
  urlChain: string[]
  lastModifiedTime: string
  eTag: string
  savePath: string
}

export interface Download {
  id: string
  resourceId: string
  url: string
  filename: string
  mimeType: string
  totalBytes: number
  contentDisposition: string
  startTime: number
  state: DownloadState
  silent?: boolean
  receivedBytes?: number
  isPaused?: boolean
  canResume?: boolean
  endTime?: number
  lastModifiedTime?: string
  eTag?: string
  savePath: string
  sourceIsPDFViewer?: boolean
}
