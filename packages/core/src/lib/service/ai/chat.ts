import { type ResourceManager } from '../resources'
import type { SFFS } from '../sffs'
import { QuotaDepletedError, TooManyRequestsError } from '@horizon/backend/types'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import { generateID, useLogScope } from '@horizon/utils'
import { CLASSIFY_SCREENSHOT_PROMPT } from '../../constants/prompts'
import {
  type AIChatMessage,
  type AIChatMessageParsed,
  type AIChatMessageRole,
  type TabPage
} from '../../types'
import { ModelTiers, Provider, type Model } from '@horizon/types/src/ai.types'
import { handleQuotaDepletedError, parseChatResponseSources } from './helpers'
import type { Telemetry } from '../telemetry'
import { PageChatMessageSentEventError } from '@horizon/types'
import type { AIService } from './ai'
import { ContextItemActiveTab, type ContextItem, type ContextManager } from './contextManager'

export type ChatPrompt = {
  label: string
  prompt: string
}

export type ChatError = {
  message: string
  type: PageChatMessageSentEventError
}

export class AIChat {
  id: string
  messages: Writable<AIChatMessage[]>
  currentParsedMessages: Writable<AIChatMessageParsed[]>
  error: Writable<ChatError | null>
  status: Writable<'idle' | 'running' | 'error'>

  userMessages: Readable<AIChatMessage[]>
  systemMessages: Readable<AIChatMessage[]>
  responses: Readable<AIChatMessageParsed[]>
  contextItems: Readable<ContextItem[]>
  cachedPagePrompts = new Map<string, ChatPrompt[]>()
  processingUnsubs = new Map<string, () => void>()

  ai: AIService
  contextManager: ContextManager
  resourceManager: ResourceManager
  sffs: SFFS
  telemetry: Telemetry
  log: ReturnType<typeof useLogScope>

  constructor(id: string, messages: AIChatMessage[], ai: AIService) {
    this.id = id
    this.messages = writable(messages)
    this.currentParsedMessages = writable([])
    this.error = writable(null)
    this.status = writable('idle')

    this.ai = ai
    this.contextManager = ai.contextManager
    this.sffs = ai.sffs
    this.resourceManager = ai.resourceManager
    this.telemetry = ai.telemetry
    this.log = useLogScope('AIChat')

    this.userMessages = derived([this.messages], ([messages]) => {
      return messages.filter((msg) => msg.role === 'user')
    })

    this.systemMessages = derived([this.messages], ([messages]) => {
      return messages.filter((msg) => msg.role === 'assistant')
    })

    this.responses = derived(
      [this.userMessages, this.systemMessages, this.currentParsedMessages],
      ([userMessages, systemMessages, currentParsedMessages]) => {
        const queries = userMessages.map((message) => message.content) // TODO: persist the query saved in the AIChatMessageParsed instead of using the actual content

        const parsed = systemMessages.map((message, idx) => {
          message.sources = message.sources
          this.log.debug('Message', message)
          return {
            id: generateID(),
            role: 'user',
            query: queries[idx],
            content: message.content.replace('<answer>', '').replace('</answer>', ''),
            sources: message.sources,
            status: 'success'
          } as AIChatMessageParsed
        })

        return [
          ...parsed,
          ...currentParsedMessages.filter((msg) => parsed.findIndex((p) => p.id === msg.id) === -1)
        ]
      }
    )

    this.contextItems = derived([this.contextManager.items], ([$contextItems]) => {
      return $contextItems
    })
  }

  get messagesValue() {
    return get(this.messages)
  }

  get responsesValue() {
    return get(this.responses)
  }

  get errorValue() {
    return get(this.error)
  }

  get statusValue() {
    return get(this.status)
  }

  get contextItemsValue() {
    return get(this.contextItems)
  }

  addParsedResponse(response: AIChatMessageParsed) {
    this.currentParsedMessages.update((messages) => {
      return [...messages, response]
    })
  }

  updateParsedResponse(id: string, response: Partial<AIChatMessageParsed>) {
    this.currentParsedMessages.update((messages) => {
      return messages.map((msg) => {
        if (msg.id === id) {
          return { ...msg, ...response }
        }

        return msg
      })
    })
  }

  async sendMessage(
    callback: (chunk: string) => void,
    query: string,
    opts?: {
      modelId?: Model['id']
      tier?: ModelTiers
      limit?: number
      ragOnly?: boolean
      resourceIds?: string[]
      inlineImages?: string[]
      general?: boolean
    }
  ) {
    let model: Model | undefined = undefined

    this.log.debug('sending chat message to chat with id', this.id, opts)

    if (opts?.modelId) {
      model = this.ai.modelsValue.find((m) => m.id === opts.modelId)
    }

    if (!model) {
      model = this.ai.getMatchingModel(opts?.tier ?? ModelTiers.Premium)
    }

    const backendModel = this.ai.modelToBackendModel(model)
    const customKey = model.custom_key

    this.log.debug('sending chat message to chat with id', this.id, model, opts, query)

    await this.sffs.sendAIChatMessage(callback, this.id, query, backendModel, {
      customKey: customKey,
      limit: opts?.limit,
      ragOnly: opts?.ragOnly,
      resourceIds: opts?.resourceIds,
      inlineImages: opts?.inlineImages,
      general: opts?.general
    })

    return {
      model
    }
  }

  delete() {
    return this.ai.deleteChat(this.id)
  }

  async getChatPrompts(contextItem: ContextItem) {
    return this.contextManager.getPromptsForItem(contextItem)
  }

  async isScreenshotNeededForPromptAndTab(
    prompt: string,
    tab: TabPage,
    tier?: ModelTiers,
    isRetry = false
  ): Promise<boolean> {
    try {
      if (get(this.ai.alwaysIncludeScreenshotInChat)) {
        return true
      }

      const model = this.ai.selectedModelValue
      const supportsStructuredOutput = model.supports_json_format
      if (!supportsStructuredOutput) {
        this.log.debug('Model does not support structured output', model)
        return false
      }

      const title = tab.title
      const url = tab.currentLocation || tab.currentDetectedApp?.canonicalUrl || tab.initialLocation

      const screenshotNeededRaw = await this.ai.createChatCompletion(
        JSON.stringify({
          prompt: prompt,
          title: title,
          url: url
        }),
        CLASSIFY_SCREENSHOT_PROMPT,
        { tier: tier ?? ModelTiers.Standard }
      )

      if (!screenshotNeededRaw) {
        this.log.error('Error determining if a screenshot is needed')
        return false
      }

      const response = JSON.parse(screenshotNeededRaw) as boolean
      return response
    } catch (e) {
      this.log.error('Error determining if a screenshot is needed', e)
      if (e instanceof QuotaDepletedError) {
        const res = handleQuotaDepletedError(e)
        this.log.error('Quota depleted', res)
        if (
          !isRetry &&
          res.exceededTiers.length === 1 &&
          res.exceededTiers.includes(ModelTiers.Standard)
        ) {
          this.log.debug('Retrying with premium model')
          return this.isScreenshotNeededForPromptAndTab(prompt, tab, ModelTiers.Premium, true)
        }
      }

      return false
    }
  }

  countContextItems(generalMode: boolean) {
    if (generalMode) {
      return {
        total: 0,
        tabs: 0,
        spaces: 0,
        images: 0,
        resources: 0
      }
    }

    const contextItems = this.contextItemsValue
    const numTabs = this.contextManager.tabsInContextValue.length
    const numSpaces = this.contextManager.spacesInContextValue.length
    const numResources = this.contextManager.resourcesInContextValue.length
    const numScreenshots = this.contextManager.screenshotsInContextValue.length

    return {
      total: contextItems.length,
      tabs: numTabs,
      spaces: numSpaces,
      images: numScreenshots,
      resources: numResources
    }
  }

  async processContextItems() {
    const resourceIds = await this.contextManager.getResourceIds()
    const inlineImages = await this.contextManager.getInlineImages()
    const usedScreenshots =
      this.contextItemsValue.filter((item) => item.type === 'screenshot').length > 0

    return {
      resourceIds: resourceIds,
      inlineImages: inlineImages,
      usedInlineScreenshot: usedScreenshots
    }
  }

  async sendMessageAndHandle(
    prompt: string,
    useContext = true,
    role: AIChatMessageRole = 'user',
    query?: string,
    skipScreenshot = false
  ) {
    this.error.set(null)

    const contextItems = this.contextItemsValue

    if (contextItems.length === 0) {
      this.log.debug('No tabs in context, general chat:')
    } else {
      this.log.debug('Tabs in context:', contextItems)
    }

    let response: AIChatMessageParsed | null = null

    // const tabsInContext = this.contextItemsValue
    //   .filter((item) => item.type === 'tab')
    //   .map((item) => item.data)

    const generalMode = !useContext
    const previousMessages = this.responsesValue.filter(
      (message) => message.id !== (response?.id ?? '')
    )

    const contextItemCount = this.countContextItems(generalMode)

    let contextSize = generalMode ? 0 : contextItems.length
    let usedPageScreenshot = false
    let numInlineImages = 0

    try {
      const { resourceIds, inlineImages, usedInlineScreenshot } = await this.processContextItems()
      numInlineImages = inlineImages.length

      const inlineScreenshots = contextItems.filter((item) => item.type === 'screenshot')

      response = {
        id: generateID(),
        role: role,
        query: query ?? prompt,
        status: 'pending',
        usedPageScreenshot: usedPageScreenshot,
        usedInlineScreenshot: usedInlineScreenshot,
        content: '',
        citations: {}
      } as AIChatMessageParsed

      this.status.set('running')
      this.addParsedResponse(response)

      if (inlineScreenshots.length === 0 && !skipScreenshot) {
        this.log.debug('No context images found, determining if a screenshot is needed')

        const activeTabItem = this.contextItemsValue.find(
          (item) => item instanceof ContextItemActiveTab
        )
        const activeTabInContext = this.contextManager.tabsInContextValue.find(
          (tab) => tab.id === this.ai.tabsManager.activeTabValue?.id
        )
        const activeTab = activeTabItem ? activeTabItem.currentTabValue : activeTabInContext

        const desktopVisible = get(this.ai.tabsManager.desktopManager.activeDesktopVisible)

        if (activeTab && activeTab.type === 'page' && !desktopVisible) {
          const screenshotNeeded = await this.isScreenshotNeededForPromptAndTab(
            query ?? prompt,
            activeTab as TabPage
          )
          this.log.debug('Screenshot needed:', screenshotNeeded)

          if (screenshotNeeded) {
            const browserTabs = this.ai.tabsManager.browserTabsValue
            const browserTab = browserTabs[activeTab.id]
            if (browserTab) {
              this.log.debug('Taking screenshot of page', activeTab)
              const dataUrl = await browserTab.capturePage()
              this.log.debug('Adding screenshot as inline image to chat context', dataUrl)
              inlineImages.push(dataUrl)
              usedPageScreenshot = true
            }
          }
        } else {
          this.log.debug('Active tab not in context, skipping screenshot')
        }
      }

      if (!generalMode && resourceIds.length > 0) {
        contextSize = resourceIds.length + inlineImages.length
      }

      this.updateParsedResponse(response.id, {
        status: 'pending',
        usedPageScreenshot: usedPageScreenshot,
        usedInlineScreenshot: usedInlineScreenshot
      })

      this.log.debug('calling the AI', prompt, resourceIds)
      let step = 'idle'
      let content = ''

      const chatCallback = (chunk: string) => {
        if (step === 'idle') {
          this.log.debug('sources chunk', chunk)

          content += chunk

          if (content.includes('</sources>')) {
            const sources = parseChatResponseSources(content)
            this.log.debug('Sources', sources)

            step = 'sources'
            content = ''

            this.updateParsedResponse(response?.id ?? '', {
              sources
            })
          }
        } else {
          content += chunk
          this.updateParsedResponse(response?.id!, {
            content: content
              .replace('<answer>', '')
              .replace('</answer>', '')
              // .replace('<citation>', '')
              // .replace('</citation>', '')
              .replace('<br>', '\n')
          })
        }
      }

      const { model } = await this.sendMessage(chatCallback, prompt, {
        limit: 30,
        resourceIds: resourceIds,
        inlineImages: inlineImages,
        general: resourceIds.length === 0
      })

      this.updateParsedResponse(response.id, {
        status: 'success',
        content: content.replace('<answer>', '').replace('</answer>', '')
      })

      this.status.set('idle')

      await this.telemetry.trackPageChatMessageSent({
        contextSize: contextSize,
        numTabs: contextItemCount.tabs,
        numSpaces: contextItemCount.spaces,
        numResources: contextItemCount.resources,
        numScreenshots: inlineImages.length,
        numPreviousMessages: previousMessages.length,
        tookPageScreenshot: usedPageScreenshot,
        embeddingModel: this.ai.config.settingsValue.embedding_model,
        chatModelProvider: model.provider,
        chatModelName:
          model.provider === Provider.Custom ? (model.custom_model_name ?? 'custom') : model.id
      })

      if (contextItemCount.spaces > 0) {
        await this.telemetry.trackChatWithSpace()
      }
    } catch (e) {
      this.log.error('Error doing magic', typeof e, e)
      let content = 'Failed to generate response.'
      let error = PageChatMessageSentEventError.Other

      if (e instanceof TooManyRequestsError) {
        error = PageChatMessageSentEventError.TooManyRequests
        content = 'Too many requests. Please try again later.'
      } else if (e instanceof QuotaDepletedError) {
        this.log.error('Quota depleted')
        const res = handleQuotaDepletedError(e)
        error = res.error
        content = res.content
      } else {
        content = 'Failed to generate response.'
      }

      if (typeof e === 'string' && e.toLowerCase().includes('Content is too long'.toLowerCase())) {
        content = 'The content is too long to process. Please try a more specific question.'
      }

      if (typeof e === 'string' && e.includes('RAG Empty Context')) {
        content = `Unfortunately, we failed to find relevant information to answer your query.
  \nThere might have been an issue with extracting all information from your current context.
  \nPlease try asking a different question or let us know if the issue persists.`
      }
      if (response) {
        this.updateParsedResponse(response.id, {
          content: content,
          status: 'error'
        })
      }

      this.error.set({ message: content, type: error })

      if (!this.errorValue?.type.startsWith(PageChatMessageSentEventError.QuotaExceeded)) {
        setTimeout(() => {
          this.error.set(null)
        }, 10000)
      }

      // TODO: track model for errors as well
      await this.telemetry.trackPageChatMessageSent({
        contextSize: contextSize,
        numTabs: contextItemCount.tabs,
        numSpaces: contextItemCount.spaces,
        numResources: contextItemCount.resources,
        numScreenshots: numInlineImages,
        numPreviousMessages: previousMessages.length,
        tookPageScreenshot: usedPageScreenshot,
        embeddingModel: this.ai.config.settingsValue.embedding_model,
        error: error
      })

      if (contextItemCount.spaces > 0) {
        await this.telemetry.trackChatWithSpace()
      }

      throw e
    } finally {
      this.status.set('idle')
    }
  }
}
