import { ResourceTypes, ResourceDataChatMessage, ResourceDataChatThread } from '@horizon/types'

import { WebAppExtractor } from '../extractors'
import type { DetectedResource, DetectedWebApp, WebApp } from '../types'
import { DOMExtractor } from '../extractors/dom'

export type SlackMessageData = {
  messageId: string
  author: string
  author_fullname: string
  author_image: string
  author_url: string

  content: string
  contentHtml: string

  date_published: string
  date_edited: string | null

  channel: string
  channel_url: string
}

const DOM_NODES = {
  messageContainer: '[data-qa="message_container"]',
  messageContent: '[data-qa="message-text"]',
  messageSender: '[data-qa="message_sender"]',
  messageTimestamp: '[data-qa="timestamp_label"]',
  threadPane: '[data-qa="threads_flexpane"]'
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

  getMessageSender(container: Element) {
    const elem = container.querySelector(DOM_NODES.messageSender)
    if (!elem) return null

    return elem.textContent
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

  parseMessage(node: Element) {
    const rawMessageId = node.parentElement?.getAttribute('data-item-key')
    if (!rawMessageId) {
      console.log('No message id found')
      return null
    }

    const messageId = this.parseMessageID(rawMessageId)
    console.log('Message ID', messageId)

    const timestamp = this.parseRawMessageIDIntoTimestamp(rawMessageId)
    const author = this.getMessageSender(node)

    const contentElem = this.getMessageContentElem(node)
    if (!contentElem) {
      console.log('No message content found')
      return null
    }

    const message = {
      messageId: messageId,
      content: contentElem.textContent ?? '',
      contentHtml: contentElem.innerHTML,
      date_published: timestamp,
      date_edited: null,
      author: author,
      author_fullname: author,
      author_image: '',
      author_url: '',
      channel: '',
      channel_url: ''
    }

    return message as SlackMessageData
  }

  getMessages(parent: Element | Document) {
    const messageNodes = this.getMessageContainers(parent)
    const messages: SlackMessageData[] = []

    console.log('Message nodes', messageNodes)

    messageNodes.forEach((node) => {
      const message = this.parseMessage(node)

      messages.push(message as any)
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

      const removeMouseOverListener = this.attachEventListener(element, 'mouseover', (e) => {
        idx += 1

        if (idx > 1) return

        ;(element as HTMLElement).style.backgroundColor = '#99d5ff66'
      })

      const removeMouseOutListener = this.attachEventListener(element, 'mouseout', (e) => {
        idx -= 1

        if (idx > 0) return

        ;(element as HTMLElement).style.backgroundColor = 'unset'
      })

      // attach click handler
      const removeListener = this.attachEventListener(element, 'click', (e) => {
        console.log('Message clicked', e)
        e.preventDefault()
        e.stopPropagation()

        handleClick(element)
      })

      removeEventListeners.push(removeListener, removeMouseOverListener, removeMouseOutListener)
    })

    // click outside

    const removeWindowListener = this.attachEventListener(window, 'click', (e) => {
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
  constructor(app: WebApp, url: URL) {
    super(app, url)
  }

  detectResourceType() {
    console.log('Detecting resource type', this.url.pathname)

    return ResourceTypes.CHAT_THREAD_SLACK
  }

  getInfo(): DetectedWebApp {
    return {
      appId: this.app?.id ?? null,
      appName: this.app?.name ?? null,
      hostname: this.url.hostname,
      resourceType: this.detectResourceType(),
      resourceNeedsPicking: true
    }
  }

  private extractThread(document: Document) {
    const parser = new SlackDocumentParser(document)

    const parent = document.querySelector(DOM_NODES.threadPane)
    if (!parent) {
      console.log('No thread pane found')
      return null
    }

    const messages = parser.getMessages(parent)
    console.log('Messages', messages)

    const normalizedMessages = messages.map((message) => {
      return this.normalizeMessage(message, document)
    })

    const favicon = this.getFavicon(document)

    const author = messages[0]?.author

    return {
      title: author ? `Thread by ${author}` : 'Thread', // TODO: get thread name
      url: this.url.href,
      platform_name: 'Slack',
      platform_icon: favicon,

      creator: author,
      creator_image: messages[0]?.author_image,
      creator_url: messages[0]?.author_url,
      messages: normalizedMessages
    } as ResourceDataChatThread
  }

  private extractChannel(document: Document) {
    const parser = new SlackDocumentParser(document)

    const messages = parser.getMessages(document)
    console.log('Messages', messages)

    const normalizedMessages = messages.map((message) => {
      return this.normalizeMessage(message, document)
    })

    const favicon = this.getFavicon(document)

    return {
      title: 'Channel', // TODO: get channel name
      url: this.url.href,
      platform_name: 'Slack',
      platform_icon: favicon,

      creator: messages[0]?.author,
      creator_image: messages[0]?.author_image,
      creator_url: messages[0]?.author_url,
      messages: normalizedMessages
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
      messageId: message.messageId,
      url: this.url.href,
      date_sent: message.date_published,
      date_edited: message.date_edited,
      platform_name: 'Slack',
      platform_icon: favicon,
      author: message.author,
      author_image: message.author_image,
      author_url: message.author_url,

      content_plain: message.content,
      content_html: message.contentHtml,

      images: [],
      video: [],

      parent_url: message.channel_url,
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
      const thread = this.extractThread(document)

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
      const channel = this.extractChannel(document)

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
