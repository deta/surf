import { type MentionItem } from '@deta/editor'
import { createMessagePortService, type MessagePortEvent } from './messagePortService'
import type {
  CitationClickEvent,
  NavigateURLOptions,
  OpenNotebookOptions,
  OpenResourceOptions,
  OpenTarget,
  TelemetryEventTypes
} from '@deta/types'

export interface TeletypeActionSerialized {
  id: string
  name: string
  description?: string
  section?: string
  icon?: string
  priority?: number
  buttonText?: string
  providerId: string
}

export interface MPTeletypeSetQuery extends MessagePortEvent {
  payload: {
    query: string
  }
}

export interface MPTeletypeSearchRequest extends MessagePortEvent {
  payload: {
    query: string
    mentions: MentionItem[]
  }
  output: {
    actions: TeletypeActionSerialized[]
  }
}

export interface MPTeletypeExecuteAction extends MessagePortEvent {
  payload: {
    actionId: string
  }
}

export interface MPTeletypeAsk extends MessagePortEvent {
  payload: {
    query: string
    mentions: MentionItem[]
  }
}

export interface MPNavigateURL extends MessagePortEvent {
  payload: NavigateURLOptions
}

export interface MPNoteCreate extends MessagePortEvent {
  payload: {
    name?: string
    content?: string
    target?: OpenTarget
    notebookId?: string
    isNewTabPage?: boolean
  }
}

export interface MPNoteRunQuery extends MessagePortEvent {
  payload: {
    query: string
    mentions?: MentionItem[]
  }
}

export interface MPNoteInsertMentionQuery extends MessagePortEvent {
  payload: {
    query?: string
    mention?: MentionItem
  }
}

export interface MPNoteReady extends MessagePortEvent {
  payload: void
}

export interface MPNoteRefreshContent extends MessagePortEvent {
  payload: void
}

export interface MPChangePageQuery extends MessagePortEvent {
  payload: {
    query: string
  }
}

export interface MPOpenResource extends MessagePortEvent {
  payload: OpenResourceOptions
}

export interface MPOpenNotebook extends MessagePortEvent {
  payload: OpenNotebookOptions
}

export interface MPCitationClick extends MessagePortEvent {
  payload: CitationClickEvent
}

export interface MPTrackEvent extends MessagePortEvent {
  payload: { eventName: TelemetryEventTypes; eventProperties?: Record<string, any> }
}

type MessagePortEventRegistry = {
  trackEvent: MPTrackEvent
  teletypeSetQuery: MPTeletypeSetQuery
  teletypeSearch: MPTeletypeSearchRequest
  teletypeExecuteAction: MPTeletypeExecuteAction
  teletypeAsk: MPTeletypeAsk
  navigateURL: MPNavigateURL
  createNote: MPNoteCreate
  noteRunQuery: MPNoteRunQuery
  noteInsertMentionQuery: MPNoteInsertMentionQuery
  noteReady: MPNoteReady
  noteRefreshContent: MPNoteRefreshContent
  changePageQuery: MPChangePageQuery
  openResource: MPOpenResource
  openNotebook: MPOpenNotebook
  citationClick: MPCitationClick
}

const createMessagePortEvents = <IsPrimary extends boolean>(
  onMessage: any,
  postMessage: any,
  primaryMode: IsPrimary
) => {
  const messagePortService = createMessagePortService<IsPrimary>(
    onMessage,
    postMessage,
    primaryMode
  )

  return messagePortService.registerEvents<MessagePortEventRegistry>({
    trackEvent: messagePortService.addEvent<MPTrackEvent>('track-event'),
    teletypeSetQuery: messagePortService.addEvent<MPTeletypeSetQuery>('teletype-set-query'),
    teletypeExecuteAction:
      messagePortService.addEvent<MPTeletypeExecuteAction>('teletype-execute-action'),
    teletypeSearch:
      messagePortService.addEventWithReturn<MPTeletypeSearchRequest>('teletype-search'),
    teletypeAsk: messagePortService.addEvent<MPTeletypeAsk>('teletype-ask'),
    navigateURL: messagePortService.addEvent<MPNavigateURL>('navigate-url'),
    createNote: messagePortService.addEvent<MPNoteCreate>('create-note'),
    noteRunQuery: messagePortService.addEvent<MPNoteRunQuery>('note-run-query'),
    noteInsertMentionQuery: messagePortService.addEvent<MPNoteInsertMentionQuery>(
      'note-insert-mention-query'
    ),
    noteReady: messagePortService.addEvent<MPNoteReady>('note-ready'),
    noteRefreshContent: messagePortService.addEvent<MPNoteRefreshContent>('note-refresh-content'),
    changePageQuery: messagePortService.addEvent<MPChangePageQuery>('change-page-query'),
    openResource: messagePortService.addEvent<MPOpenResource>('open-resource'),
    openNotebook: messagePortService.addEvent<MPOpenNotebook>('open-notebook'),
    citationClick: messagePortService.addEvent<MPCitationClick>('citation-click')
  })
}

let messagePortClientInstance: ReturnType<typeof createMessagePortEvents<false>> | null = null

export const useMessagePortClient = () => {
  if (!messagePortClientInstance) {
    messagePortClientInstance = createMessagePortEvents<false>(
      // @ts-ignore
      window.api.onMessagePort,
      // @ts-ignore
      window.api.postMessageToView,
      false as const
    )
  }
  return messagePortClientInstance
}

let messagePortPrimaryInstance: ReturnType<typeof createMessagePortEvents<true>> | null = null

export const useMessagePortPrimary = () => {
  if (!messagePortPrimaryInstance) {
    messagePortPrimaryInstance = createMessagePortEvents<true>(
      // @ts-ignore
      window.api.onMessagePort,
      // @ts-ignore
      window.api.postMessageToView,
      true as const
    )
  }

  return messagePortPrimaryInstance
}

export type MessagePortClient = ReturnType<typeof createMessagePortEvents<false>>
export type MessagePortPrimary = ReturnType<typeof createMessagePortEvents<true>>
