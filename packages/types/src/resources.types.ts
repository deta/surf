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
  HOSTNAME = 'hostname'
}

export interface ResourceTagsBuiltIn {
  [ResourceTagsBuiltInKeys.SAVED_WITH_ACTION]: 'download' | 'drag/browser' | 'drag/local' | 'paste'
  [ResourceTagsBuiltInKeys.TYPE]: string
  [ResourceTagsBuiltInKeys.DELETED]: boolean
  [ResourceTagsBuiltInKeys.HOSTNAME]: string
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

  ARTICLE = 'application/vnd.space.article',
  LINK = 'application/vnd.space.link',

  DRAWING = 'application/vnd.space.drawing',
  DRAWING_TLDRAW = 'application/vnd.space.drawing.tldraw',

  LOCATION = 'application/vnd.space.location',

  COLOR = 'application/vnd.space.color',

  FLOWCHAT_FUN = 'application/vnd.space.custom.flowchart-fun'
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
  // todo data for drawing and flowchart-fun
}

export interface ResourceDataPost {
  // basic information
  post_id: string // unique identifier for the post
  url: string // URL of the post on the original site
  title: string | null // the title of the post
  date_published: string // when the post was originally published
  date_edited: string | null // when the post was last updated / modified
  edited: boolean | null // whether the post was edited

  // information about the site
  site_name: string // name of the site the post was published on
  site_icon: string // URL to a icon / favicon representing the site

  // author related information
  author: string | null // who created the post
  author_fullname: string | null // the full name of the author
  author_image: string | null // a image URL of the author / profile picture
  author_url: string | null // a url pointing to the author themselves

  // content related information
  excerpt: string | null // a summary of the collectables content
  content_plain: string // plain text version of the content
  content_html: string // html representation of the content
  lang: string | null // language content is written in

  // associated media
  images: string[] // URLs to images used/mentioned in the post
  video: string[] // URLs to videos used/mentioned in the post
  links: string[] // URLs to other resources mentioned in the post

  // source / associated groups information
  parent_url: string | null // URL to the parent page/group/section
  parent_title: string | null // title of the parent page/group/section

  // associated statistics
  stats: {
    views: number | null // number of views / clicks etc.
    up_votes: number | null // number of up votes, likes, thumb ups etc.
    down_votes: number | null // number of down votes, dislikes, thumb downs etc.
    comments: number | null // number of comments
  }
}

export interface ResourceDataDocument {
  // basic information
  url: string // URL of the document
  date_created: string // when the document was originally created
  date_edited: string | null // when the document was last edited

  // information about the document editor
  editor_name: string // name of the editor the document was created with
  editor_icon: string // URL to a icon / favicon representing the editor

  // author related information
  author: string | null // who created the document
  author_fullname: string | null // the full name of the author
  author_image: string | null // a image URL of the author / profile picture
  author_url: string | null // a url pointing to the author themselves

  // content related information
  content_plain: string // plain text version of the content
  content_html: string // html representation of the content
}

export interface ResourceDataChatMessage {
  // basic information
  messageId: string // unique identifier for the message within the platform
  url: string // URL of the chat message in the platform
  date_sent: string // when the message was originally sent
  date_edited: string | null // when the message was last edited

  // information about the platform
  platform_name: string // name of the site the item was published on
  platform_icon: string // URL to a icon / favicon representing the site

  // author related information
  author: string // who sent the message
  author_image: string | null // a image URL of the author / profile picture
  author_url: string | null // a url pointing to the author themselves

  // content related information
  content_plain: string // plain text version of the content
  content_html: string // html representation of the content

  // associated media
  images: string[] // URLs to images used/mentioned in the message
  video: string[] // URLs to videos used/mentioned in the message

  // information about the parent group/channel and related messages
  parent_url: string | null // URL to the parent group/channel
  parent_title: string | null // title of the parent group/channel
  in_reply_to: string | null // URL of another message this one is replying to
}

export interface ResourceDataChatThread {
  // basic information
  title: string | null // name of the thread
  url: string // URL of the thread

  // information about the platform
  platform_name: string // name of the site the item was published on
  platform_icon: string // URL to a icon / favicon representing the site

  creator: string // who created the thread
  creator_image: string | null // a image URL of the creator / profile picture
  creator_url: string | null // a url pointing to the creator themselves

  messages: ResourceDataChatMessage[] // associated messages

  content_html: string // html representation of the thread content
  content_plain: string // plain text version of the thread content
}

export interface ResourceDataArticle {
  // basic information
  title: string // the title of the article
  url: string // URL of the article
  date_published: string | null // when the article was originally published
  date_updated: string | null // when the document was last updated

  // information about the site the article was published on
  site_name: string // name of the site
  site_icon: string // URL to a icon / favicon representing the site

  // author related information
  author: string | null // who wrote the article
  author_image: string | null // a image URL of the author / profile picture
  author_url: string | null // a url pointing to the author themselves

  // content related information
  excerpt: string | null // a summary of the article
  content_plain: string // plain text version of the content
  content_html: string // html representation of the content
  word_count: number // how many words the content has
  lang: string | null // language content is written in
  direction: string | null // direction the content is written in e.g. ltr/rtl

  // associated media
  images: string[] // URLs to images used/mentioned in the article

  // more information about the category / section / group the article was published under
  category_name: string | null // name of the category
  category_url: string | null // url pointing to the category

  // associated statistics
  stats: {
    views?: number | null // number of views / clicks etc.
    comments?: number | null // number of comments
  }
}

export interface ResourceDataLink {
  title: string
  description: string | null
  icon: string
  image: string | null
  keywords: string[]
  type: string | null
  language: string | null
  url: string
  provider: string | null
  author: string | null
  date_published: string | null
  date_modified: string | null
}

export interface ResourceDataLocation {
  name: string
  description: string
  coordinates: {
    latitude: number
    longitude: number
  }
  google_maps_link: string | null
}

export interface ResourceDataColor {
  name: string
  hex: string
  rgb: {
    r: number
    g: number
    b: number
  }
  hsl: {
    h: number
    s: number
    l: number
  }
}

export type ResourceData = ResourceDataTypes[keyof ResourceDataTypes]
