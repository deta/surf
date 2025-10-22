import {
  ResourceTypes,
  type ResourceDataChatMessage,
  type ResourceDataChatThread
} from '@deta/types'

import { WebAppExtractor } from '../extractors'
import type { DetectedResource, DetectedWebApp, WebService } from '../types'
import { DOMExtractor } from '../extractors/dom'
import { parseStringIntoUrl, parseTextIntoISOString } from '@deta/utils'
import { sanitizeHTML } from '../utils'

export type SlackMessageData = {
  messageId: string
  url: string
  author: string
  author_fullname: string
  author_image: string
  author_url: string

  content: string
  contentHtml: string

  date_published: string
  date_edited: string | null

  channel: string | null
  channel_url: string | null
}

const DOM_NODES = {
  messageContainer: '[data-qa="message_container"]',
  messageContent: '[data-qa="message-text"]',
  messageSender: '[data-qa="message_sender"]',
  messageSenderName: '[data-qa="message_sender_name"]',
  messageSenderImage: 'img.c-base_icon.c-base_icon--image',
  messageTimestamp: '[data-qa="timestamp_label"]',
  threadPane: '[data-qa="threads_flexpane"]',
  channelName: '[data-qa="channel_name"]'
}

export class SlackDocumentParser extends DOMExtractor {
  constructor(document: Document) {
    super(document)
  }

  getMessageContainers(parent: Element | Document) {
    return parent.querySelectorAll(DOM_NODES.messageContainer)
  }

  getMessageContentElem(container: Element) {
    return container.querySelector(DOM_NODES.messageContent)
  }

  parseSenderElement(container: Element, elem: Element) {
    const imageElem = container.querySelector(DOM_NODES.messageSenderImage)
    const senderName = container.querySelector(DOM_NODES.messageSenderName)
    const userId = senderName?.getAttribute('data-message-sender')

    return {
      name: senderName?.textContent || elem.textContent,
      id: userId ?? null,
      image: (imageElem as HTMLImageElement)?.src ?? null
    }
  }

  getMessageSender(container: Element) {
    const elem = container.querySelector(DOM_NODES.messageSender)
    if (elem) {
      return this.parseSenderElement(container, elem)
    }

    const parentElem = container.parentElement
    if (parentElem) {
      // loop through previous siblings until we find a sender or run out of elements
      let prev = parentElem.previousElementSibling
      while (prev) {
        const sender = prev.querySelector(DOM_NODES.messageSender)
        if (sender) {
          return this.parseSenderElement(prev, sender)
        }

        prev = prev.previousElementSibling
      }
    }

    return null
  }

  getMessageUrl(container: Element) {
    const elem = container.querySelector(DOM_NODES.messageTimestamp)
    const url = elem?.parentElement?.getAttribute('href')
    if (!url) return null

    return url
  }

  getChannel() {
    const elem = this.document.querySelector(DOM_NODES.channelName)
    if (!elem) {
      return null
    }

    return { name: elem.textContent, url: null }
  }

  // getMessageTimestampForContainer(container: Element) {
  //   const elem = container.querySelector(DOM_NODES.messageTimestamp)
  //   const timestamp = elem?.parentElement?.getAttribute('data-ts')
  //   if (!timestamp) return null

  //   const parts = timestamp.split('.')
  //   const end = parts[1][0]
  //   const flip
  // }

  parseMessageID(raw: string) {
    return 'p' + raw.split('.').join('')
  }

  parseRawMessageIDIntoTimestamp(id: string) {
    try {
      const timestamp = parseInt(id.split('.')[0], 10)
      const date = new Date(timestamp * 1000)
      return date.toISOString()
    } catch (e) {
      console.error('Error parsing timestamp', id, e)
      return null
    }
  }

  parseAuthorURL(messageURL: string, userId: string) {
    try {
      const url = new URL(messageURL)
      const workspace = url.hostname.split('.')[0]

      return `https://${workspace}.slack.com/team/${userId}`
    } catch (e) {
      console.error('Error parsing author URL', messageURL, userId, e)
      return null
    }
  }

  parseMessage(node: Element) {
    const rawMessageId = node.parentElement?.getAttribute('data-item-key')
    if (!rawMessageId) {
      console.log('No message id found')
      return null
    }

    const messageId = this.parseMessageID(rawMessageId)
    console.log('Message ID', messageId)

    const timestamp = this.parseRawMessageIDIntoTimestamp(rawMessageId)
    const sender = this.getMessageSender(node)

    const channel = this.getChannel()
    const messageUrl = this.getMessageUrl(node)
    const authorUrl = sender?.id && messageUrl ? this.parseAuthorURL(messageUrl, sender.id) : null

    const contentElem = this.getMessageContentElem(node)
    if (!contentElem) {
      console.log('No message content found')
      return null
    }

    const message = {
      messageId: messageId,
      url: messageUrl,
      content: contentElem.textContent ?? '',
      contentHtml: contentElem.innerHTML,
      date_published: timestamp,
      date_edited: null,
      author: sender?.name ?? null,
      author_fullname: sender?.name ?? null,
      author_image: sender?.image ?? null,
      author_url: authorUrl,
      channel: channel?.name ?? null,
      channel_url: channel?.url ?? null
    }

    return message as SlackMessageData
  }

  getMessages(parent: Element | Document) {
    const messageNodes = this.getMessageContainers(parent)
    const messages: SlackMessageData[] = []

    console.log('Message nodes', messageNodes)

    messageNodes.forEach((node) => {
      const message = this.parseMessage(node)

      if (message) {
        messages.push(message as any)
      }
    })

    return messages
  }

  hasThreadOpen() {
    const elem = this.document.querySelector(DOM_NODES.threadPane)
    console.log('Thread elem', elem)

    return elem !== null
  }

  attachMessageGrabber(callback: (message: SlackMessageData | null) => void = () => {}) {
    const messageElements = this.getMessageContainers(this.document)

    console.log('Message elements', messageElements)

    const handleClick = (element: Element) => {
      console.log('Message clicked', element)

      const message = this.parseMessage(element)

      console.log('Parsed message', message)
      callback(message)
    }

    let removeEventListeners: (() => void)[] = []

    messageElements.forEach((element) => {
      // add hover styles
      let idx = 0

      const removeMouseOverListener = this.attachEventListener(element, 'mouseover', (_e: any) => {
        idx += 1

        if (idx > 1) return
        ;(element as HTMLElement).style.backgroundColor = '#99d5ff66'
      })

      const removeMouseOutListener = this.attachEventListener(element, 'mouseout', (_e: any) => {
        idx -= 1

        if (idx > 0) return
        ;(element as HTMLElement).style.backgroundColor = 'unset'
      })

      // attach click handler
      const removeListener = this.attachEventListener(element, 'click', (e: any) => {
        console.log('Message clicked', e)
        e.preventDefault()
        e.stopPropagation()

        handleClick(element)
      })

      removeEventListeners.push(removeListener, removeMouseOverListener, removeMouseOutListener)
    })

    // click outside

    const removeWindowListener = this.attachEventListener(window, 'click', (e: any) => {
      console.log('Window click', e)

      callback(null)
    })

    return () => {
      console.log('Removing message grabber')
      messageElements.forEach((element) => {
        ;(element as HTMLElement).style.backgroundColor = 'unset'
      })

      console.log('Removing event listeners')
      removeEventListeners.forEach((remove) => remove())
      removeWindowListener()
    }
  }
}

export class SlackParser extends WebAppExtractor {
  constructor(app: WebService, url: URL) {
    super(app, url)
  }

  detectResourceType() {
    console.log('Detecting resource type', this.url.pathname)

    return ResourceTypes.CHAT_THREAD_SLACK
  }

  private getResourceIdentifier() {
    // for: https://app.slack.com/client/T038ZUQCL/D05EARRB43X
    const parts = this.url.pathname.split('/')
    const workspace = parts[2]
    if (!workspace) return null

    const channel = parts[3]
    return channel ? `${workspace}/${channel}` : workspace
  }

  getInfo(): DetectedWebApp {
    return {
      appId: this.app?.id ?? null,
      appName: this.app?.name ?? null,
      hostname: this.url.hostname,
      canonicalUrl: this.url.href,
      resourceType: this.detectResourceType(),
      appResourceIdentifier: this.getResourceIdentifier(),
      resourceNeedsPicking: true
    }
  }

  private flattenMessagesPlain(messages: SlackMessageData[]): string {
    // turn into single string formmatted like "author at date: message"
    const flattened = messages
      .map((message) => {
        return `${message.author} at ${message.date_published}: ${message.content}`
      })
      .join('\n')

    return sanitizeHTML(flattened)
  }

  private flattenMessagesHtml(messages: SlackMessageData[]): string {
    // turn into single string of html formmatted in a way that looks like a chat thread
    const flattened = messages
      .map((message) => {
        return `<a id="${message.messageId}" href="${message.url}"><p><span class="author">${message.author}</span> at <span class="date">${message.date_published}</span>:</p><div class="content">${message.contentHtml}</div></a>`
      })
      .join('\n')

    return sanitizeHTML(flattened)
  }

  private extractThread(parent: Document | Element) {
    const parser = new SlackDocumentParser(document)

    const messages = parser.getMessages(parent)
    console.log('Messages', messages)

    const normalizedMessages = messages.map((message) => {
      return this.normalizeMessage(message, document)
    })

    const favicon = this.getFavicon(document)
    const initialMessage = messages[0]

    return {
      title: null, // get thread title
      url: this.url.href,
      platform_name: 'Slack',
      platform_icon: favicon ? parseStringIntoUrl(favicon)?.href : null,

      creator: sanitizeHTML(initialMessage?.author ?? ''),
      creator_image: parseStringIntoUrl(initialMessage?.author_image ?? '')?.href ?? null,
      creator_url: parseStringIntoUrl(initialMessage?.author_url ?? '') ?? null,
      messages: normalizedMessages,
      content_plain: this.flattenMessagesPlain(messages),
      content_html: this.flattenMessagesHtml(messages)
    } as ResourceDataChatThread
  }

  private getFavicon(document: Document) {
    const favicon =
      (document.querySelector('link[rel="icon"]') as HTMLLinkElement) ||
      (document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement)
    if (favicon) {
      return favicon.href
    }

    return null
  }

  private normalizeMessage(message: SlackMessageData, document: Document) {
    const favicon = this.getFavicon(document)

    const resource = {
      messageId: sanitizeHTML(message.messageId),
      url: parseStringIntoUrl(message.url, this.url)?.href || this.url.href,
      date_sent: parseTextIntoISOString(message.date_published ?? ''),
      date_edited: parseTextIntoISOString(message.date_edited ?? ''),
      platform_name: 'Slack',
      platform_icon: parseStringIntoUrl(favicon ?? '', this.url)?.href,
      author: sanitizeHTML(message.author),
      author_image: parseStringIntoUrl(message.author_image, this.url)?.href,
      author_url: parseStringIntoUrl(message.author_url, this.url)?.href,

      content_plain: sanitizeHTML(message.content),
      content_html: sanitizeHTML(message.contentHtml),

      images: [],
      video: [],

      parent_title: message.channel ? sanitizeHTML(message.channel) : null,
      parent_url: parseStringIntoUrl(message.channel_url ?? '', this.url) ?? this.url.href,
      in_reply_to: null
    } as ResourceDataChatMessage

    return resource
  }

  async startResourcePicker(
    document: Document,
    callback: (resource: DetectedResource | null) => void
  ) {
    console.log('Starting resource picker')

    const parser = new SlackDocumentParser(document)

    const removeListeners = parser.attachMessageGrabber((message: SlackMessageData | null) => {
      console.log('Message grabbed', message)

      removeListeners()

      if (!message) {
        callback(null)
        return
      }

      const resource = this.normalizeMessage(message, document)

      console.log('Normalized resource', resource)
      callback({
        data: resource,
        type: ResourceTypes.CHAT_MESSAGE_SLACK
      })
    })
  }

  async extractResourceFromDocument(document: Document) {
    const parser = new SlackDocumentParser(document)

    const hasThreadOpen = parser.hasThreadOpen()
    console.log('Has thread open', hasThreadOpen)

    if (hasThreadOpen) {
      console.log('Thread open, extracting thread')
      const parent = document.querySelector(DOM_NODES.threadPane)
      if (!parent) {
        console.log('No thread pane found')
        return null
      }

      const thread = this.extractThread(parent)

      if (!thread) {
        console.log('No thread found')
        return null
      }

      return {
        data: thread,
        type: ResourceTypes.CHAT_THREAD_SLACK
      }
    } else {
      console.log('Thread closed, extracting channel')
      const channel = this.extractThread(document)

      if (!channel) {
        console.log('No channel found')
        return null
      }

      return {
        data: channel,
        type: ResourceTypes.CHAT_THREAD_SLACK // TODO: change to channel once we have a channel type
      }
    }
  }
}

export default SlackParser
