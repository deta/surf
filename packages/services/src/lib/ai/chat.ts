import { ResourceManager } from '../resources'
import type { SFFS } from '../sffs'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import { generateID, useLogScope } from '@deta/utils'
import {
  CHAT_TITLE_GENERATOR_PROMPT,
  CLASSIFY_CHAT_MODE,
  CLASSIFY_NOTE_CHAT_MODE
} from '../constants/prompts'
import {
  type AIChatData,
  type AIChatMessage,
  type AIChatMessageParsed,
  type AIChatMessageRole,
  type AIChatMessageSource
} from '@deta/types'
import { ChatMode, ModelTiers, Provider, type Model } from '@deta/types/src/ai.types'
import { parseAIError, parseChatResponseSources } from './helpers'
import {
  PageChatMessageSentEventError,
  PageChatMessageSentEventTrigger,
  ResourceTagDataStateValue,
  ResourceTagsBuiltInKeys,
  type PageChatMessageSentData
} from '@deta/types'
import type { AIService } from './ai'
import {
  ContextItemActiveTab,
  ContextItemResource,
  ContextItemTypes,
  type ContextItem,
  type ContextManager
} from './contextManager'
import { tick } from 'svelte'
import { ContextManagerWCV } from './contextManagerWCV'

type TabPage = any

export type ChatPrompt = {
  label: string
  prompt: string
}

export type ChatError = {
  message: string
  type: PageChatMessageSentEventError
}

export type ChatMessageOptions = {
  generationID?: string
  useContext?: boolean
  role?: AIChatMessageRole
  query?: string
  skipScreenshot?: boolean
  limit?: number
  ragOnly?: boolean
  trigger?: PageChatMessageSentEventTrigger
  onboarding?: boolean
  noteResourceId?: string
  websearch?: boolean
  surflet?: boolean
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
  // contextItems: Readable<ContextItem[]>
  cachedPagePrompts = new Map<string, ChatPrompt[]>()
  processingUnsubs = new Map<string, () => void>()

  ai: AIService
  contextManager: ContextManager | ContextManagerWCV
  resourceManager: ResourceManager
  sffs: SFFS
  log: ReturnType<typeof useLogScope>

  private activeGenerations = new Map<string, boolean>()
  private generationPromiseResolvers = new Map<string, () => void>()

  constructor(
    data: AIChatData,
    automaticTitleGeneration: boolean,
    ai: AIService,
    contextManager: ContextManager | ContextManagerWCV
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

    // this.contextItems = derived([this.contextManager.items], ([$contextItems]) => {
    //   return $contextItems
    // })

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

  // get contextItemsValue() {
  //   return get(this.contextItems)
  // }

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
    await this.ai.renameChat(this.id, title)
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
      const firstModel = models[0]
      if (firstModel) {
        this.log.debug(
          'model not found for tier',
          modelTier,
          'using first model of the provider as fallback',
          firstModel.id
        )
        this.selectedModelId.set(firstModel.id)
        return firstModel
      }

      this.log.error('No model found for provider', provider, 'and tier', modelTier)
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

  stopGeneration(id?: string) {
    if (id) {
      // Stop specific generation
      this.log.debug('Stopping generation with id', id)
      this.activeGenerations.set(id, false)

      // Resolve the promise for this specific generation if it exists
      const resolver = this.generationPromiseResolvers.get(id)
      if (resolver) {
        resolver()
        this.generationPromiseResolvers.delete(id)
      }
    } else {
      this.log.debug('Stopping all generations')
      // Stop all active generations
      for (const [genId, _] of this.activeGenerations) {
        this.activeGenerations.set(genId, false)

        // Resolve all pending promises
        const resolver = this.generationPromiseResolvers.get(genId)
        if (resolver) {
          resolver()
          this.generationPromiseResolvers.delete(genId)
        }
      }
      this.status.set('idle')
    }
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
      websearch?: boolean
      surflet?: boolean
      appCreation?: boolean
      noteResourceId?: string
    }
  ) {
    const model = opts?.model ?? this.getModel(opts)

    const backendModel = this.ai.modelToBackendModel(model)
    const customKey = model.custom_key

    this.log.debug('sending chat message to chat with id', this.id, model, opts, query)

    if (opts?.noteResourceId) {
      await this.sffs.sendAINoteMessage(callback, opts.noteResourceId, query, backendModel, {
        customKey: customKey,
        limit: opts?.limit,
        resourceIds: opts?.resourceIds,
        inlineImages: opts?.inlineImages,
        general: opts?.general,
        websearch: opts?.websearch,
        surflet: opts?.surflet
      })
    } else {
      await this.sffs.sendAIChatMessage(callback, this.id, query, backendModel, {
        customKey: customKey,
        limit: opts?.limit,
        ragOnly: opts?.ragOnly,
        resourceIds: opts?.resourceIds,
        inlineImages: opts?.inlineImages,
        general: opts?.general,
        appCreation: opts?.appCreation
      })
    }

    return {
      model
    }
  }

  delete() {
    return this.ai.deleteChat(this.id)
  }

  async getChatPrompts(forceGenerate?: boolean) {
    return this.ai.contextService.getActivePrompts(forceGenerate)
  }

  async getChatModeForNoteAndTab(
    prompt: string,
    noteContent: string,
    activeTab: TabPage | null,
    tier?: ModelTiers
  ): Promise<ChatMode> {
    try {
      const payload = {
        prompt,
        note_content: noteContent,
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
        CLASSIFY_NOTE_CHAT_MODE,
        { tier: tier ?? ModelTiers.Standard }
      )

      if (completion.error || !completion.output) {
        this.log.error('Error determining if a screenshot is needed')
        return ChatMode.TextOnly
      }

      let raw = completion.output
      if (raw.startsWith('Final Answer:')) {
        raw = raw.replace('Final Answer:', '').trim()
      } else if (raw.startsWith('Answer:')) {
        raw = raw.replace('Answer:', '').trim()
      } else if (raw.startsWith('```json')) {
        raw = raw.replace('```json', '').replace('```', '').trim()
      }

      const mode = JSON.parse(raw) as ChatMode
      if (!ChatMode.isValid(mode)) {
        this.log.error('Invalid chat mode response from llm: ', mode)
        return ChatMode.TextOnly
      }
      if (mode === ChatMode.TextOnly && get(this.ai.alwaysIncludeScreenshotInChat)) {
        return ChatMode.TextWithScreenshot
      }
      return mode
    } catch (e) {
      this.log.error('Error determining if a screenshot is needed', e)
      return ChatMode.TextOnly
    }
  }

  // TODO: we return TextOnly mode on errors, should we handle this differently?
  // TODO: this should always use a fast reliable model with a fallback
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

      let raw = completion.output
      if (raw.startsWith('Final Answer:')) {
        raw = raw.replace('Final Answer:', '').trim()
      } else if (raw.startsWith('Answer:')) {
        raw = raw.replace('Answer:', '').trim()
      } else if (raw.startsWith('```json')) {
        raw = raw.replace('```json', '').replace('```', '').trim()
      }

      const mode = JSON.parse(raw) as ChatMode
      if (!ChatMode.isValid(mode)) {
        this.log.error('Invalid chat mode response from llm: ', mode)
        return ChatMode.TextOnly
      }
      if (mode === ChatMode.TextOnly && get(this.ai.alwaysIncludeScreenshotInChat)) {
        return ChatMode.TextWithScreenshot
      }
      return mode
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

    // const contextItems = this.contextItemsValue
    // const numTabs = this.contextManager.tabsInContextValue.length
    // const numSpaces = this.contextManager.spacesInContextValue.length
    // const numResources = this.contextManager.resourcesInContextValue.length
    // const numScreenshots = this.contextManager.screenshotsInContextValue.length

    return {
      total: 0,
      tabs: 0,
      spaces: 0,
      images: 0,
      resources: 0
    }
  }

  async processContextItems(prompt: string) {
    this.log.debug('Processing context items for chat', prompt)
    const resourceIds = await this.contextManager.getResourceIds(prompt)
    const inlineImages = await this.contextManager.getInlineImages()
    const usedScreenshots = false // this.contextItemsValue.filter((item) => item.type === 'screenshot').length > 0

    return {
      resourceIds: resourceIds,
      inlineImages: inlineImages,
      usedInlineScreenshot: usedScreenshots
    }
  }

  async getPartialChatResources(prompt: string, opts?: ChatMessageOptions) {
    this.log.debug('Getting partial chat resources', prompt, opts)
    const result = await this.createChatCompletion(prompt, {
      ragOnly: true,
      limit: 10,
      ...opts
    })

    const rawSources = result.output?.sources ?? []
    const resourceIds = [...new Set(rawSources.map((s) => s.resource_id))]

    this.log.debug('Resource ids', resourceIds)

    // get full resources
    const resourcesRaw = await Promise.all(
      resourceIds.map(async (id) => {
        const res = await this.resourceManager.getResource(id)
        return res
      })
    )

    const resources = resourcesRaw.filter((res) => res !== null)
    this.log.debug('Resources', resources)

    const partialResources = resources.filter((res) => {
      return (res.tags ?? []).find(
        (tag) =>
          tag.name === ResourceTagsBuiltInKeys.DATA_STATE &&
          tag.value === ResourceTagDataStateValue.PARTIAL
      )
    })

    this.log.debug('Partial resources', partialResources)

    return partialResources
  }

  async checkAndPreparePartialResources(prompt: string, model: Model, resourceIds: string[]) {
    try {
      this.log.debug('Looking for partial resources', prompt, model, resourceIds)

      const backendModel = this.ai.modelToBackendModel(model)
      const customKey = model.custom_key

      const matchingResources = await this.resourceManager.searchChatResourcesAI(
        prompt,
        backendModel,
        {
          customKey: customKey,
          resourceIds
        }
      )

      this.log.debug('Found matching resources', matchingResources)
      const partialResources = matchingResources.filter((res) =>
        (res.tags ?? []).find(
          (tag) =>
            tag.name === ResourceTagsBuiltInKeys.DATA_STATE &&
            tag.value === ResourceTagDataStateValue.PARTIAL
        )
      )

      this.log.debug('Preparing partial resources', partialResources)
      await Promise.all(
        partialResources.map(async (resource) => {
          try {
            await this.resourceManager.refreshResourceData(resource)
          } catch (error) {
            this.log.error('Error preparing partial resource', resource.id, error)
            await this.resourceManager.updateResourceTag(
              resource.id,
              ResourceTagsBuiltInKeys.DATA_STATE,
              ResourceTagDataStateValue.ERROR
            )
          }
        })
      )
    } catch (error) {
      this.log.error('Error checking and preparing partial resources', error)
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
      websearch: true,
      surflet: true,
      ...opts
    } as Required<ChatMessageOptions>

    if (!options.generationID) {
      options.generationID = generateID()
    }

    this.error.set(null)

    // Create a promise that will be resolved when generation completes or is stopped
    let resolveGenerationPromise: (() => void) | null = null
    const generationPromise = new Promise<void>((resolve) => {
      resolveGenerationPromise = resolve
      this.generationPromiseResolvers.set(options.generationID, resolve)
    })

    // const contextItems = this.contextItemsValue

    // if (contextItems.length === 0) {
    //   this.log.debug('No tabs in context, general chat:')
    // } else {
    //   this.log.debug('Tabs in context:', contextItems)
    // }

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

    let contextSize = generalMode ? 0 : 0
    let usedPageScreenshot = false

    try {
      response = {
        id: options.generationID,
        role: options.role,
        query: options.query ?? prompt,
        status: 'pending',
        usedPageScreenshot: usedPageScreenshot,
        usedInlineScreenshot: false,
        content: '',
        citations: {}
      } as AIChatMessageParsed

      // Track this generation as active
      this.activeGenerations.set(options.generationID, true)

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

      this.updateParsedResponse(response?.id ?? '', {
        usedInlineScreenshot
      })

      // TODO: this is not robust enough check for surflets in context
      const hasSurfletInContext = false // contextItems.some((item) => {
      //   const isResourceType = item.type === ContextItemTypes.RESOURCE
      //   if (isResourceType) {
      //     const resourceItem = item as ContextItemResource
      //     return resourceItem?.data?.type === 'text/html'
      //   }
      //   return false
      // })
      // END TODO

      this.log.debug('hasSurfletInContext', hasSurfletInContext)

      // const activeTabItem = this.contextItemsValue.find(
      //   (item) => item instanceof ContextItemActiveTab
      // )
      // const activeTabInContext = this.contextManager.tabsInContextValue.find(
      //   (tab) => tab.id === this.ai.tabsManager.activeTabValue?.id
      // )
      // const activeTab = activeTabItem ? activeTabItem.currentTabValue : activeTabInContext
      // const desktopVisible = get(this.ai.tabsManager.desktopManager.activeDesktopVisible)

      const userMessages = previousMessages
        .filter((message) => message.role === 'user')
        .map((message) => message.query)
      const query = options.query ?? prompt
      const allQueries = [query, ...userMessages.reverse()]

      const chatMode = await this.getChatModeForPromptAndTab(
        allQueries,
        undefined, // activeTab,
        hasSurfletInContext
      )

      // if (chatMode === ChatMode.TextWithScreenshot || chatMode === ChatMode.AppCreation) {
      //   // TODO: are all these conditions necessary?
      //   // only take screenshot
      //   // if there is an active tab  and
      //   // there are no screenshots in context already and
      //   // the user has not explicitly skipped the screenshot
      //   // and the desktop is not visible
      //   if (activeTab && !options.skipScreenshot && !usedInlineScreenshot) {
      //     const browserTab = this.ai.tabsManager.browserTabsValue[activeTab.id]
      //     if (browserTab) {
      //       this.log.debug('Taking screenshot of page', activeTab)
      //       const dataUrl = await browserTab.capturePage()
      //       this.log.debug('Adding screenshot as inline image to chat context', dataUrl)
      //       inlineImages.push(dataUrl)
      //       usedPageScreenshot = true
      //     }
      //   } else {
      //     this.log.debug(
      //       'Skipping screenshot beacuse no active tab or screenshot already in context or explicitly skipped'
      //     )
      //   }
      // }

      if (!generalMode && resourceIds.length > 0) {
        contextSize = resourceIds.length + inlineImages.length
      }

      // await this.checkAndPreparePartialResources(prompt, model, resourceIds)

      this.updateParsedResponse(response.id, {
        status: 'pending',
        usedPageScreenshot: usedPageScreenshot
      })

      this.log.debug('calling the AI', prompt, resourceIds)
      let step = 'idle'
      let content = ''

      const chatCallback = (chunk: string) => {
        // Check if this generation has been stopped
        if (!this.activeGenerations.get(options.generationID)) {
          this.log.debug('Generation stopped, aborting')
          if (this.statusValue !== 'idle') {
            this.log.debug('Generation stopped, aborting')
            this.status.set('idle')
            this.updateParsedResponse(response?.id ?? '', {
              status: 'cancelled'
            })
          }
          return
        }

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

      // Start the AI message generation in the background
      const sendMessagePromise = this.sendMessage(chatCallback, prompt, {
        model,
        limit: options.limit,
        ragOnly: options.ragOnly,
        resourceIds: resourceIds,
        inlineImages: inlineImages,
        general: resourceIds.length === 0,
        appCreation: chatMode === ChatMode.AppCreation,
        noteResourceId: options.noteResourceId,
        websearch: options.websearch,
        surflet: options.surflet
      })

      // Wait for either the generation to complete or be stopped
      const sendMessageResult = await Promise.race([
        sendMessagePromise,
        generationPromise.then(() => ({ cancelled: true }))
      ])

      // If generation wasn't cancelled, continue with normal processing
      if (!sendMessageResult || !('cancelled' in sendMessageResult)) {
        await sendMessagePromise

        if (this.activeGenerations.get(options.generationID)) {
          this.updateParsedResponse(response.id, {
            status: 'success',
            content: content.replace('<answer>', '').replace('</answer>', '')
          })

          this.status.set('idle')
        } else {
          this.log.debug('Generation stopped, not updating response')
          this.status.set('idle')
          this.updateParsedResponse(response.id, {
            status: 'cancelled'
          })
        }
      } else {
        // If generation was cancelled, we don't need to do anything else
        this.log.debug('Generation was cancelled, skipping further processing')
      }

      // Clean up the generation tracking
      this.activeGenerations.delete(options.generationID)
      this.generationPromiseResolvers.delete(options.generationID)

      // Always resolve the promise
      if (resolveGenerationPromise) {
        ;(resolveGenerationPromise as any)()
      }
    } catch (e) {
      this.log.error('Error sending chat message', typeof e, e)

      const parsedError = parseAIError(e)

      if (response) {
        this.updateParsedResponse(response.id, {
          content: parsedError.message,
          status: 'error'
        })
      }

      this.error.set(parsedError)

      // Clean up the generation tracking even in case of error
      this.activeGenerations.delete(options.generationID)
      this.generationPromiseResolvers.delete(options.generationID)

      // Always resolve the promise
      if (resolveGenerationPromise) {
        ;(resolveGenerationPromise as any)()
      }

      throw e
    } finally {
      this.status.set('idle')

      // Ensure we clean up in all cases
      this.generationPromiseResolvers.delete(options.generationID)
    }
  }

  /**
   * Append text to the current AI response
   * Used for streaming in chunks of text, particularly for predefined content
   */
  appendToCurrentAIResponse(text: string) {
    // Find the last response message
    const responses = this.responsesValue
    const lastResponse = responses[responses.length - 1]

    if (lastResponse) {
      // Update the content of the last response
      this.updateParsedResponse(lastResponse.id, {
        content: lastResponse.content + text
      })
    } else {
      // If no response exists yet, create a new one
      const newResponse: AIChatMessageParsed = {
        id: generateID(),
        role: 'assistant',
        status: 'success',
        content: text,
        query: '',
        usedPageScreenshot: false,
        usedInlineScreenshot: false
      }

      this.addParsedResponse(newResponse)
    }

    // Update the messages store to reflect the changes
    this.messages.update((messages) => {
      const lastAssistantIndex = [...messages].reverse().findIndex((m) => m.role === 'assistant')

      if (lastAssistantIndex >= 0) {
        // Get the actual index in the original array
        const actualIndex = messages.length - 1 - lastAssistantIndex

        // Create a copy of the messages array
        const updatedMessages = [...messages]

        // Update the content of the last assistant message
        updatedMessages[actualIndex] = {
          ...updatedMessages[actualIndex],
          content: updatedMessages[actualIndex].content + text
        }

        return updatedMessages
      }

      // If no assistant message found, create a new one
      return [
        ...messages,
        {
          id: generateID(),
          role: 'assistant',
          content: text,
          query: '',
          ai_session_id: '',
          status: 'success',
          sources: []
        } satisfies AIChatMessage
      ]
    })

    this.updatedAt = new Date().toISOString()
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

      await this.sendMessageAndHandle(prompt, options, callback)

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

      // const activeTab = this.ai.tabsManager.activeTabValue
      // const tabInContext = this.contextManager.tabsInContextValue.find(
      //   (item) => item.id === activeTab?.id
      // )

      let context = ''
      // if (tabInContext) {
      //   context = tabInContext.titleValue
      // }

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
