import type {
  ResourceDataAnnotation,
  ResourceDataArticle,
  ResourceDataChatMessage,
  ResourceDataChatThread,
  ResourceDataColor,
  ResourceDataDocument,
  ResourceDataLink,
  ResourceDataLocation,
  ResourceDataPost,
  ResourceDataTable,
  ResourceDataTableColumn
} from './resources/index.types'

export interface SFFSResourceMetadata {
  name: string
  sourceURI: string
  alt: string
  userContext: string
}

export interface SFFSResourceTag {
  id?: string
  name: string
  value: string
  op?: 'eq' | 'ne' | 'prefix' | 'suffix'
}

export enum ResourceTagsBuiltInKeys {
  SAVED_WITH_ACTION = 'savedWithAction',
  TYPE = 'type',
  DELETED = 'deleted',
  HOSTNAME = 'hostname',
  CANONICAL_URL = 'canonicalUrl',
  ANNOTATES = 'annotates'
}

export interface ResourceTagsBuiltIn {
  [ResourceTagsBuiltInKeys.SAVED_WITH_ACTION]:
    | 'download'
    | 'drag/browser'
    | 'drag/local'
    | 'paste'
    | 'import'
  [ResourceTagsBuiltInKeys.TYPE]: string
  [ResourceTagsBuiltInKeys.DELETED]: boolean
  [ResourceTagsBuiltInKeys.HOSTNAME]: string
  [ResourceTagsBuiltInKeys.CANONICAL_URL]: string
  [ResourceTagsBuiltInKeys.ANNOTATES]: string
}

export interface SFFSResource {
  id: string
  type: string
  path: string
  createdAt: string
  updatedAt: string
  deleted: boolean
  metadata?: SFFSResourceMetadata
  tags?: SFFSResourceTag[]
}

export type SFFSSearchResultEngine = 'keyword' | 'proximity' | 'semantic' | 'local'

export interface SFFSSearchProximityParameters {
  proximityDistanceThreshold?: number // default 100,000
  proximityLimit?: number
}

export interface SFFSSearchSemanticParameters {
  semanticEnabled?: boolean // false by default
  semanticDistanceThreshold?: number // default 1.0, inc by .25 (0.0-2.0)
  semanticLimit?: number
}

export type SFFSSearchParameters = SFFSSearchProximityParameters & SFFSSearchSemanticParameters

export interface SFFSSearchResultItem {
  resource: SFFSResource
  card_ids: string[]
  engine: SFFSSearchResultEngine
}

export enum ResourceTypes {
  SPACE = 'application/vnd.space',

  POST = 'application/vnd.space.post',
  POST_REDDIT = 'application/vnd.space.post.reddit',
  POST_TWITTER = 'application/vnd.space.post.twitter',
  POST_YOUTUBE = 'application/vnd.space.post.youtube',

  CHAT_MESSAGE = 'application/vnd.space.chat-message',
  CHAT_MESSAGE_DISCORD = 'application/vnd.space.chat-message.discord',
  CHAT_MESSAGE_SLACK = 'application/vnd.space.chat-message.slack',

  CHAT_THREAD = 'application/vnd.space.chat-thread',
  CHAT_THREAD_SLACK = 'application/vnd.space.chat-thread.slack',

  DOCUMENT = 'application/vnd.space.document',
  DOCUMENT_SPACE_NOTE = 'application/vnd.space.document.space-note',
  DOCUMENT_NOTION = 'application/vnd.space.document.notion',
  DOCUMENT_GOOGLE_DOC = 'application/vnd.space.document.google-doc',

  TABLE = 'application/vnd.space.table',
  TABLE_GOOGLE_SHEET = 'application/vnd.space.table.google-sheet',
  TABLE_TYPEFORM = 'application/vnd.space.table.typeform',

  TABLE_COLUMN = 'application/vnd.space.table-column',
  TABLE_COLUMN_GOOGLE_SHEET = 'application/vnd.space.table-column.google-sheet',
  TABLE_COLUMN_TYPEFORM = 'application/vnd.space.table-column.typeform',

  ARTICLE = 'application/vnd.space.article',
  LINK = 'application/vnd.space.link',

  DRAWING = 'application/vnd.space.drawing',
  DRAWING_TLDRAW = 'application/vnd.space.drawing.tldraw',

  LOCATION = 'application/vnd.space.location',

  COLOR = 'application/vnd.space.color',

  FLOWCHAT_FUN = 'application/vnd.space.custom.flowchart-fun',

  ANNOTATION = 'application/vnd.space.annotation'
}

export interface ResourceDataTypes {
  [ResourceTypes.POST]: ResourceDataPost
  [ResourceTypes.DOCUMENT]: ResourceDataDocument
  [ResourceTypes.CHAT_MESSAGE]: ResourceDataChatMessage
  [ResourceTypes.CHAT_THREAD]: ResourceDataChatThread
  [ResourceTypes.ARTICLE]: ResourceDataArticle
  [ResourceTypes.LINK]: ResourceDataLink
  [ResourceTypes.LOCATION]: ResourceDataLocation
  [ResourceTypes.COLOR]: ResourceDataColor
  [ResourceTypes.DOCUMENT_SPACE_NOTE]: string
  [ResourceTypes.TABLE]: ResourceDataTable
  [ResourceTypes.TABLE_COLUMN]: ResourceDataTableColumn
  [ResourceTypes.ANNOTATION]: ResourceDataAnnotation
  // todo data for drawing and flowchart-fun
}

export type ResourceData = ResourceDataTypes[keyof ResourceDataTypes]

export type DetectedWebApp = {
  appId: string | null
  appName: string | null
  hostname: string
  resourceType: string | null
  appResourceIdentifier: string | null // e.g. tweet ID
  resourceNeedsPicking: boolean
}

export type DetectedResource = {
  data: ResourceData
  type: string
}

export * from './resources/index.types'
