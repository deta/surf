import { type ResourceManager } from '../resources'
import type { SFFS } from '../sffs'
import { QuotaDepletedError } from '@horizon/backend/types'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import { generateID, useLogScope } from '@horizon/utils'
import { CHAT_TITLE_GENERATOR_PROMPT, CLASSIFY_CHAT_MODE } from '../../constants/prompts'
import {
  type AIChatData,
  type AIChatMessage,
  type AIChatMessageParsed,
  type AIChatMessageRole,
  type AIChatMessageSource,
  type TabPage,
  type TabResource
} from '../../types'
import { ChatMode, ModelTiers, Provider, type Model } from '@horizon/types/src/ai.types'
import { handleQuotaDepletedError, parseAIError, parseChatResponseSources } from './helpers'
import type { Telemetry } from '../telemetry'
import {
  PageChatMessageSentEventError,
  PageChatMessageSentEventTrigger,
  type PageChatMessageSentData
} from '@horizon/types'
import type { AIService } from './ai'
import {
  ContextItemActiveTab,
  ContextItemResource,
  ContextItemTypes,
  type ContextItem,
  type ContextManager
} from './contextManager'
import { tick } from 'svelte'

export type ChatPrompt = {
  label: string
  prompt: string
}

export type ChatError = {
  message: string
  type: PageChatMessageSentEventError
}

export type ChatMessageOptions = {
  useContext?: boolean
  role?: AIChatMessageRole
  query?: string
  skipScreenshot?: boolean
  limit?: number
  ragOnly?: boolean
  trigger?: PageChatMessageSentEventTrigger
  onboarding?: boolean
}

export type ChatCompletionResponse = {
  output: string | null
  error: ChatError | null
}

export class AIChat {
  id: string
  createdAt: string
  updatedAt: string
  automaticTitleGeneration: boolean

  title: Writable<string>
  messages: Writable<AIChatMessage[]>
  currentParsedMessages: Writable<AIChatMessageParsed[]>
  error: Writable<ChatError | null>
  status: Writable<'idle' | 'running' | 'error'>
  selectedModelId: Writable<string | null>
  generatingTitle: Writable<boolean>

  selectedModel: Readable<Model>
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

  constructor(
    data: AIChatData,
    automaticTitleGeneration: boolean,
    ai: AIService,
    contextManager: ContextManager
  ) {
    this.id = data.id
    this.createdAt = data.createdAt
    this.updatedAt = data.updatedAt
    this.automaticTitleGeneration = automaticTitleGeneration
    this.title = writable(data.title)
    this.messages = writable(data.messages)
    this.currentParsedMessages = writable([])
    this.error = writable(null)
    this.status = writable('idle')
    this.selectedModelId = writable(null)
    this.generatingTitle = writable(false)

    this.ai = ai
    this.contextManager = contextManager
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
          return {
            id: message.id,
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

    this.selectedModel = derived(
      [this.selectedModelId, this.ai.selectedModelId, this.ai.models],
      ([chatModelId, defaultModelId, models]) => {
        if (chatModelId) {
          return models.find((m) => m.id === chatModelId) || models[0]
        }

        return models.find((m) => m.id === defaultModelId) || models[0]
      }
    )
  }

  get messagesValue() {
    return get(this.messages)
  }

  get responsesValue() {
    return get(this.responses)
  }

  get userMessagesValue() {
    return get(this.userMessages)
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

  get selectedModelIdValue() {
    return get(this.selectedModelId)
  }

  get selectedModelValue() {
    return get(this.selectedModel)
  }

  get titleValue() {
    return get(this.title)
  }

  async changeTitle(title: string) {
    this.title.set(title)
    return this.ai.renameChat(this.id, title)
  }

  async getMessages() {
    const chat = await this.sffs.getAIChat(this.id)
    if (!chat) {
      this.log.error('Failed to get chat messages')
      return []
    }

    this.messages.set(chat.messages)

    return chat.messages
  }

  selectModel(modelId: string | null) {
    this.log.debug('selecting model', modelId)

    if (!modelId) {
      this.selectedModelId.set(null)
      return null
    }

    const model = this.ai.modelsValue.find((m) => m.id === modelId)
    if (!model) {
      this.log.error('Model not found', modelId)
      return null
    }

    this.selectedModelId.set(model.id)
    return model
  }

  selectProviderModel(provider: Provider, tier?: ModelTiers) {
    this.log.debug('selecting model for provider', provider, tier)
    const models = this.ai.modelsValue.filter((m) => m.provider === provider)
    if (!models) {
      this.log.error('model not found for provider', provider)
      return null
    }

    const modelTier = tier ?? ModelTiers.Premium
    const model = models.find((m) => m.tier === modelTier)
    if (!model) {
      this.log.error('model not found for tier', modelTier)
      return null
    }

    this.selectedModelId.set(model.id)
    return model
  }

  addParsedResponse(response: AIChatMessageParsed) {
    this.currentParsedMessages.update((messages) => {
      return [...messages, response]
    })
  }

  updateParsedResponse(id: string, response: Partial<AIChatMessageParsed>) {
    let message: AIChatMessageParsed | null = null

    this.currentParsedMessages.update((messages) => {
      return messages.map((msg) => {
        if (msg.id === id) {
          message = { ...msg, ...response }
          return message
        }

        return msg
      })
    })

    return message as AIChatMessageParsed | null
  }

  getModel(opts?: { modelId?: Model['id']; tier?: ModelTiers }) {
    let model: Model | undefined = undefined

    this.log.debug('sending chat message to chat with id', this.id, opts)

    if (opts?.modelId) {
      this.log.debug('getting model by id', opts.modelId)
      model = this.ai.modelsValue.find((m) => m.id === opts.modelId)
    }

    if (this.selectedModelIdValue) {
      this.log.debug('getting model by selected model id', this.selectedModelIdValue)
      model = this.ai.modelsValue.find((m) => m.id === this.selectedModelIdValue)
      if (opts?.tier && model?.tier !== opts.tier) {
        this.log.debug(
          'model tier does not match, getting matching model',
          opts.tier,
          model?.provider
        )
        model = this.ai.modelsValue.find(
          (m) => m.provider === model?.provider && m.tier === opts.tier
        )
      }
    }

    if (!model) {
      this.log.debug('no model found, getting default model')
      model = this.ai.getMatchingModel(opts?.tier ?? ModelTiers.Premium)
    }

    this.log.debug('selected model', model)

    return model
  }

  async sendMessage(
    callback: (chunk: string) => void,
    query: string,
    opts?: {
      model?: Model
      modelId?: Model['id']
      tier?: ModelTiers
      limit?: number
      ragOnly?: boolean
      resourceIds?: string[]
      inlineImages?: string[]
      general?: boolean
      appCreation?: boolean
    }
  ) {
    const model = opts?.model ?? this.getModel(opts)

    const backendModel = this.ai.modelToBackendModel(model)
    const customKey = model.custom_key

    this.log.debug('sending chat message to chat with id', this.id, model, opts, query)

    await this.sffs.sendAIChatMessage(callback, this.id, query, backendModel, {
      customKey: customKey,
      limit: opts?.limit,
      ragOnly: opts?.ragOnly,
      resourceIds: opts?.resourceIds,
      inlineImages: opts?.inlineImages,
      general: opts?.general,
      appCreation: opts?.appCreation
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

  // TODO: we return TextOnly mode on errors, should we handle this differently?
  async getChatModeForPromptAndTab(
    prompts: string[],
    activeTab: TabPage | null,
    hasSurfletInContext: boolean = false,
    tier?: ModelTiers
  ): Promise<ChatMode> {
    try {
      const payload = {
        prompts,
        has_app_in_context: hasSurfletInContext,
        ...(activeTab && {
          title: activeTab.title,
          url:
            activeTab.currentLocation ??
            activeTab.currentDetectedApp?.canonicalUrl ??
            activeTab.initialLocation
        })
      }
      const completion = await this.ai.createChatCompletion(
        JSON.stringify(payload),
        CLASSIFY_CHAT_MODE,
        { tier: tier ?? ModelTiers.Standard }
      )

      if (completion.error || !completion.output) {
        this.log.error('Error determining if a screenshot is needed')
        return ChatMode.TextOnly
      }

      const response = JSON.parse(completion.output) as ChatMode
      if (!ChatMode.isValid(response)) {
        this.log.error('Invalid chat mode response from llm: ', response)
        return ChatMode.TextOnly
      }
      if (response === ChatMode.TextOnly && get(this.ai.alwaysIncludeScreenshotInChat)) {
        return ChatMode.TextWithScreenshot
      }
      return response
    } catch (e) {
      this.log.error('Error determining if a screenshot is needed', e)
      return ChatMode.TextOnly
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

  async processContextItems(prompt: string) {
    this.log.debug('Processing context items for chat', prompt)
    const resourceIds = await this.contextManager.getResourceIds(prompt)
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
    opts?: ChatMessageOptions,
    callback?: (message: AIChatMessageParsed) => void
  ) {
    const options = {
      useContext: true,
      role: 'user',
      query: undefined,
      skipScreenshot: false,
      limit: 30,
      ragOnly: false,
      ...opts
    } as Required<ChatMessageOptions>

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

    const generalMode = !options.useContext
    const previousMessages = this.responsesValue.filter(
      (message) => message.id !== (response?.id ?? '')
    )

    const contextItemCount = this.countContextItems(generalMode)
    const model = this.getModel()

    let contextSize = generalMode ? 0 : contextItems.length
    let usedPageScreenshot = false
    let numInlineImages = 0

    const basicTelemtryData = {
      trigger: options.trigger,
      onboarding: options.onboarding ?? false,
      contextSize: contextSize,
      numTabs: contextItemCount.tabs,
      numSpaces: contextItemCount.spaces,
      numResources: contextItemCount.resources,
      numScreenshots: numInlineImages,
      numPreviousMessages: previousMessages.length,
      tookPageScreenshot: usedPageScreenshot,
      generatedArtifact: false,
      embeddingModel: this.ai.config.settingsValue.embedding_model,
      chatModelProvider: model?.provider,
      chatModelName:
        model.provider === Provider.Custom ? (model.custom_model_name ?? 'custom') : model.id
    } as PageChatMessageSentData

    try {
      response = {
        id: generateID(),
        role: options.role,
        query: options.query ?? prompt,
        status: 'pending',
        usedPageScreenshot: usedPageScreenshot,
        usedInlineScreenshot: false,
        content: '',
        citations: {}
      } as AIChatMessageParsed

      this.status.set('running')
      this.addParsedResponse(response)

      await tick()

      if (!this.titleValue && this.automaticTitleGeneration) {
        // we don't need to wait for the title to be generated
        this.generateTitle(prompt).then(() => {
          this.log.debug('Title generated')
        })
      }

      const { resourceIds, inlineImages, usedInlineScreenshot } =
        await this.processContextItems(prompt)

      this.log.debug('Context items processed', resourceIds, inlineImages)

      basicTelemtryData.numScreenshots = inlineImages.length
      this.updateParsedResponse(response?.id ?? '', {
        usedInlineScreenshot
      })

      const hasSurfletInContext = contextItems.some((item) => {
        const isResourceType = item.type === ContextItemTypes.RESOURCE
        if (isResourceType) {
          const resourceItem = item as ContextItemResource
          return resourceItem?.data?.type === 'text/html'
        }
        return false
      })

      this.log.debug('hasSurfletInContext', hasSurfletInContext)

      const activeTabItem = this.contextItemsValue.find(
        (item) => item instanceof ContextItemActiveTab
      )
      const activeTabInContext = this.contextManager.tabsInContextValue.find(
        (tab) => tab.id === this.ai.tabsManager.activeTabValue?.id
      )
      const activeTab = activeTabItem ? activeTabItem.currentTabValue : activeTabInContext
      const desktopVisible = get(this.ai.tabsManager.desktopManager.activeDesktopVisible)

      const userMessages = previousMessages
        .filter((message) => message.role === 'user')
        .map((message) => message.query)
      const query = options.query ?? prompt
      const allQueries = [query, ...userMessages.reverse()]

      const chatMode = await this.getChatModeForPromptAndTab(
        allQueries,
        activeTab as TabPage,
        hasSurfletInContext
      )

      if (chatMode === ChatMode.TextWithScreenshot || chatMode === ChatMode.AppCreation) {
        // TODO: are all these conditions necessary?
        // only take screenshot
        // if there is an active tab  and
        // there are no screenshots in context already and
        // the user has not explicitly skipped the screenshot
        // and the desktop is not visible
        if (activeTab && !options.skipScreenshot && !usedInlineScreenshot && !desktopVisible) {
          const browserTab = this.ai.tabsManager.browserTabsValue[activeTab.id]
          if (browserTab) {
            this.log.debug('Taking screenshot of page', activeTab)
            const dataUrl = await browserTab.capturePage()
            this.log.debug('Adding screenshot as inline image to chat context', dataUrl)
            inlineImages.push(dataUrl)
            usedPageScreenshot = true
          }
        } else {
          this.log.debug(
            'Skipping screenshot beacuse no active tab or screenshot already in context or explicitly skipped'
          )
        }
      }

      if (!generalMode && resourceIds.length > 0) {
        contextSize = resourceIds.length + inlineImages.length
      }

      this.updateParsedResponse(response.id, {
        status: 'pending',
        usedPageScreenshot: usedPageScreenshot
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
          const updatedMessage = this.updateParsedResponse(response?.id!, {
            content: content
              .replace('<answer>', '')
              .replace('</answer>', '')
              // .replace('<citation>', '')
              // .replace('</citation>', '')
              .replace('<br>', '\n')
          })

          if (callback && updatedMessage) {
            callback(updatedMessage)
          }
        }
      }

      await this.sendMessage(chatCallback, prompt, {
        model,
        limit: options.limit,
        ragOnly: options.ragOnly,
        resourceIds: resourceIds,
        inlineImages: inlineImages,
        general: resourceIds.length === 0,
        appCreation: chatMode === ChatMode.AppCreation
      })

      this.updateParsedResponse(response.id, {
        status: 'success',
        content: content.replace('<answer>', '').replace('</answer>', '')
      })

      this.status.set('idle')

      if (content.includes('```html')) {
        basicTelemtryData.generatedArtifact = true
      }

      if (options.trigger) {
        if (options.ragOnly) {
          await this.telemetry.trackSimilaritySearch(basicTelemtryData)
        } else {
          await this.telemetry.trackPageChatMessageSent(basicTelemtryData)
          if (
            contextItemCount.spaces > 0 &&
            options.trigger === PageChatMessageSentEventTrigger.SidebarChat
          ) {
            await this.telemetry.trackChatWithSpace(options.trigger)
          }
        }
      }
    } catch (e) {
      this.log.error('Error doing magic', typeof e, e)

      const parsedError = parseAIError(e)

      if (response) {
        this.updateParsedResponse(response.id, {
          content: parsedError.message,
          status: 'error'
        })
      }

      this.error.set(parsedError)

      if (!this.errorValue?.type.startsWith(PageChatMessageSentEventError.QuotaExceeded)) {
        setTimeout(() => {
          this.error.set(null)
        }, 10000)
      }

      if (options.trigger) {
        if (options.ragOnly) {
          await this.telemetry.trackSimilaritySearch({
            ...basicTelemtryData,
            error: parsedError.type
          })
        } else {
          await this.telemetry.trackPageChatMessageSent({
            ...basicTelemtryData,
            error: parsedError.type
          })

          if (
            contextItemCount.spaces > 0 &&
            options.trigger === PageChatMessageSentEventTrigger.SidebarChat
          ) {
            await this.telemetry.trackChatWithSpace(options.trigger, parsedError.type)
          }
        }
      }

      throw e
    } finally {
      this.status.set('idle')
    }
  }

  async createChatCompletion(
    prompt: string,
    opts?: ChatMessageOptions,
    callback?: (message: AIChatMessageParsed) => void
  ) {
    try {
      const options = {
        useContext: true,
        skipScreenshot: true,
        ...opts
      }

      const promise = this.sendMessageAndHandle(prompt, options, callback)

      let previousContent = ''

      // const content = derived(this.responses, ($responses) => {
      //   const lastResponse = $responses[$responses.length - 1]
      //   if (lastResponse) {
      //     const fullContent = lastResponse.content
      //     const newContent = fullContent.replace(previousContent, '')
      //     previousContent = fullContent

      //     return lastResponse
      //   }
      // })

      // content.subscribe(() => {})

      await promise

      return {
        chat: this,
        output: this.responsesValue[this.responsesValue.length - 1],
        error: this.errorValue
      }
    } catch (e) {
      this.log.error('Error creating chat completion', e)
      return {
        chat: this,
        output: null,
        error: this.errorValue
      }
    }
  }

  async similaritySearch(text: string, opts?: ChatMessageOptions) {
    const result = await this.createChatCompletion(text, {
      ragOnly: true,
      limit: 10,
      ...opts
    })

    const rawSources = result.output?.sources ?? []

    const sources = await Promise.all(
      rawSources.map(async (source) => {
        const res = await this.resourceManager.getAIChatDataSource(source.uid ?? source.id)
        return {
          ...source,
          content: res?.content
        } as AIChatMessageSource
      })
    )

    return sources
  }

  async generateTitle(
    content?: string,
    opts?: {
      tier?: ModelTiers
    }
  ) {
    try {
      this.generatingTitle.set(true)

      if (!content) {
        this.log.debug('messages', this.messagesValue)
        const userMessages = this.userMessagesValue
        if (userMessages.length === 0) {
          this.log.debug('No user messages to generate title from, fetching all messages')
          const messages = await this.getMessages()
          if (messages.length === 0) {
            this.log.error('No messages to generate title from')
            return null
          }

          content = messages[0].content
        } else {
          content = userMessages[0].content
        }

        if (!content) {
          this.log.error('No content to generate title from')
          return null
        }
      }

      const activeTab = this.ai.tabsManager.activeTabValue
      const tabInContext = this.contextManager.tabsInContextValue.find(
        (item) => item.id === activeTab?.id
      )

      let context = ''
      if (tabInContext) {
        context = tabInContext.title
      }

      this.log.debug('Generating title from', content, context)

      const completion = await this.ai.createChatCompletion(
        JSON.stringify({ message: content, context: context }),
        CHAT_TITLE_GENERATOR_PROMPT,
        { tier: opts?.tier ?? ModelTiers.Standard }
      )

      this.log.debug('title completion', completion)

      if (completion.error) {
        this.log.error('Failed to generate title', completion.error)
        return null
      }

      if (!completion.output) {
        this.log.error('Failed to generate title, no output')
        return null
      }

      this.log.debug('Generated title', completion.output)

      await this.changeTitle(completion.output)

      return completion.output
    } catch (e) {
      this.log.error('Error generating title', e)
      return null
    } finally {
      this.generatingTitle.set(false)
    }
  }
}
