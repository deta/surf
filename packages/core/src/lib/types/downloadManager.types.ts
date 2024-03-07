export interface DownloadRequestMessage {
  id: string
  url: string
  filename: string
  mimeType: string
  totalBytes: number
  contentDisposition: string
  startTime: number
  hasUserGesture: boolean
}

export interface DownloadUpdatedMessage {
  id: string
  state: string
  receivedBytes: number
  totalBytes: number
  isPaused: boolean
  canResume: boolean
}

export interface DownloadDoneMessage {
  id: string
  state: string
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
