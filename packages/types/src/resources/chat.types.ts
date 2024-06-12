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
