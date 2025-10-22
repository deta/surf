import { type MentionItem } from '@deta/editor'
import { createMessagePortService, type MessagePortEvent } from './messagePortService'
import type {
  CitationClickEvent,
  NavigateURLOptions,
  OpenNotebookOptions,
  OpenResourceOptions,
  OpenTarget,
  ViewLocation
} from '@deta/types'

import type {
  WebContentsViewContextManagerActionOutputs,
  WebContentsViewContextManagerActionPayloads,
  WebContentsViewContextManagerActionType
} from './contextManagerEvents'

import type { MentionItem as MentionItemService } from '../mentions/mention.types'

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

export type AIQueryPayload = {
  query: string
  queryLabel?: string
  openTabUrl?: string
  mentions: MentionItem[]
  tools?: {
    websearch?: boolean
    surflet?: boolean
  }
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
    query: string
    mentions: MentionItem[]
  }
}

export interface MPTeletypeAsk extends MessagePortEvent {
  payload: AIQueryPayload
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
  payload: AIQueryPayload
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

export interface MPExternStateNotebookChanged extends MessagePortEvent {
  payload: { resourceIds: string[]; notebookId: string }
}
export interface MPExternStateResourceChanged extends MessagePortEvent {
  payload: { resourceIds: string[] }
}
export interface MPExternStateResourceCreated extends MessagePortEvent {
  payload: { resourceId: string }
}
export interface MPExternStateResourceDeleted extends MessagePortEvent {
  payload: { resourceId: string }
}
export interface MPExternStateResourceUpdated extends MessagePortEvent {
  payload: { resourceId: string }
}

export interface MPExternStateNotebooksChanged extends MessagePortEvent {
  payload: { notebookIds: string[] }
}

export interface MPViewMounted extends MessagePortEvent {
  payload: {
    location: ViewLocation
  }
}

export interface MPActiveTabChanged extends MessagePortEvent {
  payload: {
    tabId: string
    url: string
  }
}

export interface MPFetchMentions extends MessagePortEvent {
  payload: {
    query: string
    notResourceId?: string
  }
  output: MentionItemService[]
}

export type MPContextManagerAction = {
  [K in WebContentsViewContextManagerActionType]: {
    payload: {
      type: K
      payload: WebContentsViewContextManagerActionPayloads[K]
    }
    output: WebContentsViewContextManagerActionOutputs[K]
  }
}[WebContentsViewContextManagerActionType]

type MessagePortEventRegistry = {
  extern_state_resourceCreated: MPExternStateResourceCreated
  extern_state_resourceDeleted: MPExternStateResourceDeleted
  extern_state_resourceUpdated: MPExternStateResourceUpdated
  extern_state_notebookAddResources: MPExternStateNotebookChanged
  extern_state_notebookRemoveResources: MPExternStateNotebookChanged
  extern_state_notebooksChanged: MPExternStateNotebooksChanged

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
  activeTabChanged: MPActiveTabChanged
  viewMounted: MPViewMounted
  contextManagerAction: MPContextManagerAction
  fetchMentions: MPFetchMentions
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
    extern_state_resourceCreated: messagePortService.addEvent<MPExternStateResourceCreated>(
      'extern-state-resource-created'
    ),
    extern_state_resourceDeleted: messagePortService.addEvent<MPExternStateResourceDeleted>(
      'extern-state-resource-deleted'
    ),
    extern_state_resourceUpdated: messagePortService.addEvent<MPExternStateResourceUpdated>(
      'extern-state-resource-updated'
    ),
    extern_state_notebookAddResources: messagePortService.addEvent<MPExternStateNotebookChanged>(
      'extern-state-notebook-add-resources'
    ),
    extern_state_notebookRemoveResources: messagePortService.addEvent<MPExternStateNotebookChanged>(
      'extern-state-notebook-remove-resources'
    ),
    extern_state_notebooksChanged: messagePortService.addEvent<MPExternStateNotebooksChanged>(
      'extern-state-notebooks-changed'
    ),

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
    citationClick: messagePortService.addEvent<MPCitationClick>('citation-click'),
    activeTabChanged: messagePortService.addEvent<MPActiveTabChanged>('active-tab-changed'),
    viewMounted: messagePortService.addEvent<MPViewMounted>('view-mounted'),
    contextManagerAction:
      messagePortService.addEventWithReturn<MPContextManagerAction>('context-manager-action'),
    fetchMentions: messagePortService.addEventWithReturn<MPFetchMentions>('fetch-mentions')
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
