import { getContext, setContext } from 'svelte'
import type { ConfigService } from '../config'
import { ResourceManager } from '../resources'
import type { SFFS } from '../sffs'

import { type App, type Message, type Model as ModelBackend } from '@deta/backend/types'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import { appendURLPath, generateHash, isDev, useLocalStorageStore, useLogScope } from '@deta/utils'
import {
  FILENAME_CLEANUP_PROMPT,
  PAGE_PROMPTS_GENERATOR_PROMPT,
  SIMPLE_SUMMARIZER_PROMPT
} from '../constants/prompts'
import { type AiSFFSQueryResponse } from '@deta/types'
import {
  BUILT_IN_MODELS,
  ModelTiers,
  OPEN_AI_PATH_SUFFIX,
  type Model
} from '@deta/types/src/ai.types'
import { parseAIError } from './helpers'
import { useTabs, type TabsService } from '../tabs'
import { AIChat, type ChatCompletionResponse, type ChatPrompt } from './chat'
import { type ContextItem, ContextManager, ContextService } from './contextManager'
import {
  EventContext,
  GeneratePromptsEventTrigger,
  PromptType,
  SummarizeEventContentSource
} from '@deta/types'
import { ContextManagerWCV } from './contextManagerWCV'
import { useNotebookManager } from '../notebooks'

export interface AppCreationResult {
  appId: string
  hasBufferedData: boolean
}

export interface StreamingAppResponse {
  subscribe: (chunkCallback: (chunk: string) => void, doneCallback: () => void) => () => void // returns unsubscribe function
}

export class AIService {
  static self: AIService

  resourceManager: ResourceManager
  sffs: SFFS
  config: ConfigService
  log: ReturnType<typeof useLogScope>
  contextService: ContextService
  fallbackContextManager: ContextManager | ContextManagerWCV

  showChatSidebar: Writable<boolean>
  chats: Writable<AIChat[]>
  activeSidebarChatId: Writable<string>
  activeSidebarChat: Writable<AIChat | null>

  selectedModelId: Readable<string>
  selectedModel: Readable<Model>
  models: Readable<Model[]>
  alwaysIncludeScreenshotInChat: Readable<boolean>
  activeContextManager: Readable<ContextManager | ContextManagerWCV>

  customAIApps: Writable<App[]> = writable([])

  private activeAppStreams = new Map<
    string,
    {
      buffer: string
      isComplete: boolean
      subscribers: Set<{
        chunkCallback: (chunk: string) => void
        doneCallback: () => void
      }>
    }
  >()

  constructor(resourceManager: ResourceManager, config: ConfigService, global = true) {
    this.resourceManager = resourceManager
    this.sffs = resourceManager.sffs
    this.config = config
    this.log = useLogScope('AI')

    if (global) {
      const tabsManager = useTabs()
      const notebookManager = useNotebookManager()
      const contextService = ContextService.create(
        this,
        tabsManager,
        resourceManager,
        notebookManager
      )
      this.fallbackContextManager = contextService.createDefault()
    } else {
      this.fallbackContextManager = ContextService.createWCV(this, resourceManager)
    }

    this.showChatSidebar = writable(false)
    this.chats = writable([])
    this.activeSidebarChatId = useLocalStorageStore<string>('activeChatId', '')
    this.activeSidebarChat = writable<AIChat | null>(null)

    this.selectedModelId = derived([this.config.settings], ([settings]) => {
      return settings.selected_model
    })

    this.models = derived([this.config.settings], ([settings]) => {
      const modelSettings = settings.model_settings
      const customModels = modelSettings.filter((m) => m.provider === 'custom')

      const configuredBuiltInModels = BUILT_IN_MODELS.map((model) => {
        const customModel = modelSettings.find((m) => m.id === model.id)
        return {
          ...model,
          ...customModel
        }
      })

      return [...customModels, ...configuredBuiltInModels]
    })

    this.selectedModel = derived(
      [this.selectedModelId, this.models],
      ([selectedModelId, models]) => {
        return models.find((m) => m.id === selectedModelId) || models[0]
      }
    )

    this.alwaysIncludeScreenshotInChat = derived([this.config.settings], ([settings]) => {
      return settings.always_include_screenshot_in_chat
    })

    this.activeContextManager = derived([this.config.settings], ([settings]) => {
      // if (settings.experimental_notes_chat_sidebar && activeNote) {
      //   return activeNote.contextManager
      // }

      return this.fallbackContextManager
    })

    this.refreshCustomAiApps()

    if (isDev) {
      // @ts-ignore
      window.aiService = this
    }
  }

  get contextManager() {
    return get(this.activeContextManager)
  }

  get showChatSidebarValue() {
    return get(this.showChatSidebar)
  }

  get customKeyValue() {
    return get(this.selectedModel).custom_key
  }

  get selectedModelValue() {
    return get(this.selectedModel)
  }

  get modelsValue() {
    return get(this.models)
  }

  get chatsValue() {
    return get(this.chats)
  }

  get activeSidebarChatValue() {
    return get(this.activeSidebarChat)
  }

  get activeSidebarChatIdValue() {
    return get(this.activeSidebarChatId)
  }

  addMissingChats(chats: AIChat[]) {
    const missingChats = chats.filter((chat) => !this.chatsValue.find((c) => c.id === chat.id))
    this.chats.update((existingChats) => [...existingChats, ...missingChats])
  }

  modelToBackendModel(model: Model): ModelBackend {
    if (model.provider === 'custom') {
      let providerUrl = model.provider_url ?? ''

      // for backwards compatibility we need to append the OpenAI path as we were doing that before in the backend
      if (model.skip_append_open_ai_suffix !== true) {
        providerUrl = appendURLPath(providerUrl, OPEN_AI_PATH_SUFFIX)
        this.log.debug('appended open ai path suffix', providerUrl)
      }

      return {
        custom: {
          name: model.custom_model_name ?? model.label,
          provider: { custom: providerUrl },
          max_tokens: model.max_tokens || 128_000,
          vision: model.vision
        }
      }
    }

    return model.id as ModelBackend
  }

  changeSelectedModel(modelId: string) {
    const model = this.modelsValue.find((m) => m.id === modelId)
    if (!model) {
      this.log.error('Model not found', modelId)
      return
    }

    this.log.debug('changing selected model', model)

    return this.config.updateSettings({
      selected_model: model.id
    })
  }

  // TODO: add quota check
  getMatchingModel(tier: ModelTiers) {
    const selectedModel = get(this.selectedModel)

    this.log.debug('getting matching model', selectedModel, tier)

    // If the selected model is the same tier as the requested tier, return it
    if (selectedModel.tier === tier) {
      return selectedModel
    }

    // If the selected model is premium and the requested tier is standard, return the standard model from the same provider
    if (tier === ModelTiers.Standard && selectedModel.tier === ModelTiers.Premium) {
      return (
        this.modelsValue.find(
          (m) => m.provider === selectedModel.provider && m.tier === ModelTiers.Standard
        ) || selectedModel
      )
    }

    // If the selected model is standard and the requested tier is premium, we will return standard
    return selectedModel
  }

  getMatchingBackendModel(tier: ModelTiers) {
    const model = this.getMatchingModel(tier)
    return this.modelToBackendModel(model)
  }

  // cloneContextManager() {
  //   return this.contextManager.clone()
  // }

  async createChat(opts?: {
    title?: string
    system_prompt?: string
    contextManager?: ContextManager | ContextManagerWCV
    automaticTitleGeneration?: boolean
  }): Promise<AIChat | null> {
    const { title, system_prompt, contextManager, automaticTitleGeneration } = Object.assign(
      {
        title: undefined,
        system_prompt: undefined,
        contextManager: this.contextManager,
        automaticTitleGeneration: false
      },
      opts
    )

    this.log.debug(`creating ai chat "${title}" with system prompt: ${system_prompt}`)
    const chatId = await this.sffs.createAIChat(title, system_prompt)

    if (!chatId) {
      this.log.error('failed to create ai chat')
      return null
    }

    this.log.debug('created ai chat with id', chatId)

    const createdChat = {
      id: chatId,
      title: title ?? '',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const chat = new AIChat(
      createdChat,
      automaticTitleGeneration,
      this,
      contextManager ?? this.contextManager
    )
    this.chats.update((chats) => [...chats, chat])

    return chat
  }

  async listChats(opts?: { withMessages?: boolean; limit?: number }) {
    const options = Object.assign({ withMessages: false, limit: 15 }, opts)

    const chats = await this.sffs.listAIChats(options.limit)
    if (!options.withMessages) {
      const fullChats = chats.map((chat) => new AIChat(chat, false, this, this.contextManager))
      this.addMissingChats(fullChats)
      return fullChats
    }

    const chatsWithMessages = await Promise.all(
      chats.map(async (chat) => {
        const fullChat = await this.getChat(chat.id)
        return fullChat
      })
    )

    const filtered = chatsWithMessages.filter((chat) => chat !== null) as AIChat[]
    this.addMissingChats(filtered)

    return filtered
  }

  async searchChats(query: string, opts?: { withMessages?: boolean; limit?: number }) {
    const options = Object.assign({ withMessages: false, limit: 15 }, opts)

    const chats = await this.sffs.searchAIChats(query, options.limit)
    if (!options.withMessages) {
      const fullChats = chats.map((chat) => new AIChat(chat, false, this, this.contextManager))
      this.addMissingChats(fullChats)
      return fullChats
    }

    const chatsWithMessages = await Promise.all(
      chats.map(async (chat) => {
        const fullChat = await this.getChat(chat.id)
        return fullChat
      })
    )

    const filtered = chatsWithMessages.filter((chat) => chat !== null) as AIChat[]
    this.addMissingChats(filtered)

    return filtered
  }

  async getChat(
    id: string,
    opts?: { contextManager?: ContextManager; fresh?: boolean }
  ): Promise<AIChat | null> {
    const defaultOpts = {
      contextManager: this.contextManager,
      fresh: true
    }

    const options = Object.assign(defaultOpts, opts) as typeof defaultOpts

    this.log.debug('getting ai chat with id', id, options)

    if (!options.fresh) {
      const localChat = this.chatsValue.find((chat) => chat.id === id)
      if (localChat) {
        if (!localChat.messagesValue || localChat.messagesValue.length === 0) {
          await localChat.getMessages()
        }

        return localChat
      }
    }

    const chatData = await this.sffs.getAIChat(id)
    if (!chatData) {
      this.log.error('failed to get ai chat')
      return null
    }

    this.log.debug('got ai chat', chatData)
    const chat = new AIChat(chatData, false, this, options.contextManager)

    this.addMissingChats([chat])

    return chat
  }

  async renameChat(id: string, title: string): Promise<void> {
    this.log.debug('renaming ai chat with id', id, 'to', title)
    const chat = this.chatsValue.find((chat) => chat.id === id)
    if (!chat) {
      this.log.error('chat not found', id)
      return
    }

    chat.title.set(title)
    await this.sffs.updateAIChatTitle(id, title)

    // force svelte reactivity to update
    this.chats.update((chats) => {
      return chats.map((c) => (c.id === id ? chat : c))
    })
  }

  async deleteChat(id: string): Promise<void> {
    this.log.debug('deleting ai chat with id', id)
    await this.sffs.deleteAIChat(id)
    this.chats.update((chats) => chats.filter((chat) => chat.id !== id))
  }

  async createChatCompletion(
    userPrompt: string | string[],
    systemPrompt?: string,
    opts?: {
      tier?: ModelTiers
      responseFormat?: string
      /**
       * Whether to retry with a different model tier if the current tier is depleted
       */
      quotaErrorRetry?: boolean
      filterOutReasoning?: boolean
      inlineImages?: string[]
    }
  ): Promise<ChatCompletionResponse> {
    const defaultOpts = {
      tier: ModelTiers.Premium,
      quotaErrorRetry: true,
      responseFormat: undefined as string | undefined,
      filterOutReasoning: true
    }

    const options = Object.assign(defaultOpts, opts) as typeof defaultOpts

    try {
      const model = this.getMatchingBackendModel(options.tier)
      const customKey = this.customKeyValue
      const responseFormat = options?.responseFormat

      let messages: Message[] = []

      if (systemPrompt) {
        messages.push({ role: 'system', content: [{ type: 'text', text: systemPrompt }] })
      }

      if (typeof userPrompt === 'string') {
        messages.push({ role: 'user', content: [{ type: 'text', text: userPrompt }] })
      } else {
        userPrompt.forEach((prompt) => {
          messages.push({ role: 'user', content: [{ type: 'text', text: prompt }] })
        })
      }

      if (opts?.inlineImages) {
        for (let i = 0; i < opts.inlineImages.length; i++) {
          messages.push({
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: opts.inlineImages[i] }
              }
            ]
          })
        }
      }

      this.log.debug('creating chat completion', model, options, messages)
      let result = await this.sffs.createAIChatCompletion(messages, model, {
        customKey,
        responseFormat
      })

      if (options.filterOutReasoning) {
        if (result.trim().startsWith('<think>')) {
          this.log.debug('Filtering out reasoning block')
          // remove <think> blocks from the response
          const domParser = new DOMParser()
          const doc = domParser.parseFromString(result, 'text/html')

          const thinkBlocks = doc.querySelectorAll('think')
          thinkBlocks.forEach((node) => {
            node.remove()
          })

          result = doc.body.innerHTML.trim()
        }
      }

      this.log.debug('created chat completion', result)

      return {
        output: result as string,
        error: null
      } as ChatCompletionResponse
    } catch (e) {
      const parsedError = parseAIError(e)
      this.log.error('Parsed chat completion error', parsedError)

      return {
        output: null,
        error: parsedError
      } as ChatCompletionResponse
    }
  }

  async generatePrompts(
    data: Record<string, any>,
    opts?: {
      tier?: ModelTiers
      systemPrompt?: string
      context?: EventContext
      trigger?: GeneratePromptsEventTrigger
      onboarding?: boolean
    }
  ) {
    this.log.debug('Generating prompts for resource', data)
    const completion = await this.createChatCompletion(
      JSON.stringify(data),
      opts?.systemPrompt ?? PAGE_PROMPTS_GENERATOR_PROMPT,
      { tier: opts?.tier ?? ModelTiers.Standard }
    )

    this.log.debug('Prompts completion', completion)

    if (completion.error) {
      this.log.error('Failed to generate prompts', completion.error)
      return null
    }

    if (!completion.output) {
      this.log.error('Failed to generate prompts')
      return null
    }

    const prompts = JSON.parse(completion.output.replace('```json', '').replace('```', ''))
    const parsedPrompts = prompts.filter(
      (p: any) => p.label !== undefined && p.prompt !== undefined
    ) as ChatPrompt[]

    this.log.debug('Generated prompts', parsedPrompts)

    return parsedPrompts
  }

  async getResourcesViaPrompt(
    prompt: string,
    opts?: {
      tier?: ModelTiers
      sqlQuery?: string
      embeddingQuery?: string
      embeddingDistanceThreshold?: number
    },
    isRetry = false
  ): Promise<AiSFFSQueryResponse> {
    const tier = opts?.tier ?? ModelTiers.Premium
    try {
      const model = this.getMatchingBackendModel(tier)
      const customKey = this.customKeyValue

      this.log.debug('getting resources via prompt', model, opts, prompt)

      return await this.sffs.getResourcesViaPrompt(prompt, model, {
        customKey,
        sqlQuery: opts?.sqlQuery,
        embeddingQuery: opts?.embeddingQuery,
        embeddingDistanceThreshold: opts?.embeddingDistanceThreshold
      })
    } catch (e) {
      this.log.error('Error getting resources via prompt', e)
      throw e
    }
  }

  async getAppId(query: string): Promise<string> {
    return generateHash(query)
  }

  async createApp(
    query: string,
    opts?: {
      tier?: ModelTiers
    }
  ): Promise<AppCreationResult | null> {
    const model = this.getMatchingBackendModel(opts?.tier ?? ModelTiers.Premium)
    const customKey = this.customKeyValue

    // TODO: this is a temporary fix to prevent remounts from causing multiple streams
    // we should find a better way to handle this
    const appId = await this.getAppId(query)

    this.log.debug('creating ai app with id:', appId, model, opts, query)

    const contextManager = get(this.activeContextManager)
    const inlineImages = await contextManager.getInlineImages()

    this.log.debug('number of inline images for app creation:', inlineImages.length)

    try {
      this.activeAppStreams.set(appId, {
        buffer: '',
        isComplete: false,
        subscribers: new Set()
      })
      this.startAppStreaming(appId, query, model, { customKey, inlineImages })
      return {
        appId,
        hasBufferedData: false
      }
    } catch (error) {
      this.log.error('Failed to create app:', error)
      this.activeAppStreams.delete(appId)
      return null
    }
  }

  subscribeToAppStream(appId: string): StreamingAppResponse | null {
    const streamData = this.activeAppStreams.get(appId)
    if (!streamData) {
      this.log.error('App stream not found:', appId)
      return null
    }

    return {
      subscribe: (chunkCallback: (chunk: string) => void, doneCallback: () => void) => {
        const subscriber = { chunkCallback, doneCallback }
        streamData.subscribers.add(subscriber)

        if (streamData.buffer) {
          chunkCallback(streamData.buffer)
        }

        if (streamData.isComplete) {
          doneCallback()
        }
        return () => {
          streamData.subscribers.delete(subscriber)
          if (streamData.subscribers.size === 0 && streamData.isComplete) {
            this.activeAppStreams.delete(appId)
          }
        }
      }
    }
  }

  private async startAppStreaming(
    appId: string,
    query: string,
    model: ModelBackend,
    options: { customKey?: string; inlineImages?: string[] }
  ) {
    const streamData = this.activeAppStreams.get(appId)
    if (!streamData) {
      return
    }

    try {
      await this.sffs.createAIApp(
        query,
        model,
        // chunk callback
        // store main content in buffer and notify subscribers
        (chunk: string) => {
          streamData.buffer += chunk
          streamData.subscribers.forEach((subscriber) => {
            subscriber.chunkCallback(chunk)
          })
        },
        // done callback
        // mark stream as complete and notify subscribers
        () => {
          streamData.isComplete = true
          streamData.subscribers.forEach((subscriber) => {
            subscriber.doneCallback()
          })
          if (streamData.subscribers.size === 0) {
            this.activeAppStreams.delete(appId)
          }
        },
        options
      )
    } catch (error) {
      this.log.error('Error streaming app:', error)
      // TODO: have an error callback
      streamData.subscribers.forEach((subscriber) => {
        subscriber.doneCallback()
      })

      this.activeAppStreams.delete(appId)
    }
  }

  getAppStreamStatus(appId: string): {
    exists: boolean
    isComplete: boolean
    hasBuffer: boolean
    bufferLength: number
  } | null {
    const streamData = this.activeAppStreams.get(appId)
    if (!streamData) {
      return null
    }

    return {
      exists: true,
      isComplete: streamData.isComplete,
      hasBuffer: streamData.buffer.length > 0,
      bufferLength: streamData.buffer.length
    }
  }

  getAppBuffer(appId: string): string | null {
    const streamData = this.activeAppStreams.get(appId)
    return streamData?.buffer ?? null
  }

  cleanupAppStream(appId: string): void {
    this.activeAppStreams.delete(appId)
  }

  cleanupCompletedAppStreams(): void {
    for (const [appId, streamData] of this.activeAppStreams.entries()) {
      if (streamData.isComplete && streamData.subscribers.size === 0) {
        this.activeAppStreams.delete(appId)
      }
    }
  }

  refreshCustomAiApps() {
    this.sffs.listAIApps().then((apps) => {
      this.customAIApps.set(apps)
    })
  }

  async storeCustomAiApp({ name, prompt, icon }: { name: string; prompt: string; icon?: string }) {
    try {
      await this.sffs.storeAIApp('inline-screenshot', prompt, name, icon)
      this.refreshCustomAiApps()
    } catch (error) {
      this.log.error('Failed to save custom tool:', error)
      return
    }
  }

  async deleteCustomAiApp(id: string) {
    try {
      await this.sffs.deleteAIApp(id)
      this.refreshCustomAiApps()
    } catch (error) {
      this.log.error('Failed to delete custom tool:', error)
      return
    }
  }

  async summarizeText(
    text: string,
    opts?: {
      systemPrompt?: string
      context?: EventContext
      contentSource?: SummarizeEventContentSource
    }
  ) {
    const completion = await this.createChatCompletion(
      text,
      SIMPLE_SUMMARIZER_PROMPT + (opts?.systemPrompt ? ' ' + opts.systemPrompt : ''),
      { tier: ModelTiers.Standard }
    )

    this.log.debug('Summarized completion', completion)
    return completion
  }

  async cleanupTitle(text: string, context?: string) {
    const completion = await this.createChatCompletion(
      JSON.stringify({ input: text, context }),
      FILENAME_CLEANUP_PROMPT.replace('$DATE', new Date().toISOString()),
      { tier: ModelTiers.Standard }
    )

    this.log.debug('Cleaned up title completion', completion)

    return completion
  }

  onDestroy() {
    this.fallbackContextManager?.onDestroy()
  }

  static provide(resourceManager: ResourceManager, config: ConfigService, global?: boolean) {
    const service = new AIService(resourceManager, config, global)

    setContext('ai', service)
    if (!AIService.self) AIService.self = service

    return service
  }

  static use() {
    if (!AIService.self) return getContext<AIService>('ai')
    return AIService.self
  }
}

export const useAI = AIService.use
export const provideAI = AIService.provide

export * from './chat'
