import { getContext, setContext } from 'svelte'
import type { ConfigService } from '../config'
import { type ResourceManager } from '../resources'
import type { SFFS } from '../sffs'
import {
  QuotaDepletedError,
  type App,
  type Message,
  type Model as ModelBackend,
  type Quota
} from '@horizon/backend/types'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import { isDev, useLogScope } from '@horizon/utils'
import { PAGE_PROMPTS_GENERATOR_PROMPT, SIMPLE_SUMMARIZER_PROMPT } from '../../constants/prompts'
import { type AiSFFSQueryResponse } from '../../types'
import { BUILT_IN_MODELS, ModelTiers, type Model } from '@horizon/types/src/ai.types'
import { handleQuotaDepletedError, parseAIError } from './helpers'
import type { TabsManager } from '../tabs'
import type { Telemetry } from '../telemetry'
import { AIChat, type ChatCompletionResponse, type ChatPrompt } from './chat'
import { type ContextItem, ContextManager } from './contextManager'
import {
  EventContext,
  GeneratePromptsEventTrigger,
  SummarizeEventContentSource
} from '@horizon/types'

export class AIService {
  resourceManager: ResourceManager
  sffs: SFFS
  tabsManager: TabsManager
  config: ConfigService
  telemetry: Telemetry
  log: ReturnType<typeof useLogScope>
  contextManager: ContextManager

  showChatSidebar: Writable<boolean>

  selectedModelId: Readable<string>
  selectedModel: Readable<Model>
  models: Readable<Model[]>
  alwaysIncludeScreenshotInChat: Readable<boolean>
  contextItems: Readable<ContextItem[]>

  customAIApps: Writable<App[]> = writable([])

  constructor(resourceManager: ResourceManager, tabsManager: TabsManager, config: ConfigService) {
    this.resourceManager = resourceManager
    this.sffs = resourceManager.sffs
    this.tabsManager = tabsManager
    this.config = config
    this.telemetry = resourceManager.telemetry
    this.log = useLogScope('AI')
    this.contextManager = new ContextManager(this, tabsManager, resourceManager)

    this.showChatSidebar = writable(false)

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

    this.contextItems = derived([this.contextManager.items], ([$contextItems]) => {
      return $contextItems
    })

    this.refreshCustomAiApps()

    if (isDev) {
      // @ts-ignore
      window.aiService = this
    }
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

  modelToBackendModel(model: Model): ModelBackend {
    if (model.provider === 'custom') {
      return {
        custom: {
          name: model.custom_model_name ?? model.label,
          provider: { custom: model.provider_url ?? '' },
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

  createContextManager() {
    return new ContextManager(this, this.tabsManager, this.resourceManager)
  }

  async createChat(
    system_prompt?: string,
    contextManager?: ContextManager
  ): Promise<AIChat | null> {
    this.log.debug('creating ai chat (custom system prompt:', system_prompt, ')')
    const chatId = await this.sffs.createAIChat(system_prompt)

    if (!chatId) {
      this.log.error('failed to create ai chat')
      return null
    }

    this.log.debug('created ai chat with id', chatId)
    return new AIChat(chatId, [], this, contextManager ?? this.contextManager)
  }

  async getChat(id: string, contextManager?: ContextManager): Promise<AIChat | null> {
    this.log.debug('getting ai chat with id', id)
    const chatData = await this.sffs.getAIChat(id)

    if (!chatData) {
      this.log.error('failed to get ai chat')
      return null
    }

    this.log.debug('got ai chat', chatData)
    return new AIChat(chatData.id, chatData.messages, this, contextManager ?? this.contextManager)
  }

  async deleteChat(id: string): Promise<void> {
    this.log.debug('deleting ai chat with id', id)
    await this.sffs.deleteAIChat(id)
  }

  async createChatCompletion(
    userPrompt: string | string[],
    systemPrompt?: string,
    opts?: {
      tier?: ModelTiers
      responseFormat?: string
    }
  ) {
    try {
      const model = this.getMatchingBackendModel(opts?.tier ?? ModelTiers.Premium)
      const customKey = this.customKeyValue
      const responseFormat = opts?.responseFormat

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

      this.log.debug('creating chat completion', model, opts, messages)
      const result = await this.sffs.createAIChatCompletion(messages, model, {
        customKey,
        responseFormat
      })

      this.log.debug('created chat completion', result)
      return {
        output: result as string,
        error: null
      } as ChatCompletionResponse
    } catch (e) {
      const parsedError = parseAIError(e)
      this.log.error('Error creating chat completion', parsedError)
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

    if (opts?.context || opts?.trigger) {
      this.telemetry.trackGeneratePrompts(
        opts.context ?? EventContext.Chat,
        opts.trigger ?? GeneratePromptsEventTrigger.Click,
        opts.onboarding ?? false
      )
    }

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
      if (e instanceof QuotaDepletedError) {
        const res = handleQuotaDepletedError(e)
        this.log.error('Quota depleted', res)
        if (
          !isRetry &&
          tier === ModelTiers.Premium &&
          res.exceededTiers.length === 1 &&
          res.exceededTiers.includes(ModelTiers.Premium)
        ) {
          this.log.debug('Retrying with standard model')
          return this.getResourcesViaPrompt(prompt, { ...opts, tier: ModelTiers.Standard }, true)
        }
      }

      throw e
    }
  }

  async createApp(
    chatId: string,
    prompt: string,
    opts?: {
      tier?: ModelTiers
      contexts?: string[]
    }
  ): Promise<string | null> {
    const model = this.getMatchingBackendModel(opts?.tier ?? ModelTiers.Premium)
    const customKey = this.customKeyValue

    this.log.debug('creating ai app', chatId, model, opts, prompt)

    return this.sffs.createAIApp(chatId, prompt, model, {
      customKey,
      contexts: opts?.contexts
    })
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
    }
  }

  async deleteCustomAiApp(id: string) {
    try {
      await this.sffs.deleteAIApp(id)
      this.refreshCustomAiApps()
    } catch (error) {
      this.log.error('Failed to delete custom tool:', error)
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

    if (opts?.context && opts?.contentSource) {
      this.telemetry.trackSummarizeText(opts.contentSource, opts.context)
    }

    return completion
  }

  async getQuotas(): Promise<Quota[]> {
    this.log.debug('getting quotas')
    const quotas = await this.sffs.getQuotas()
    this.log.debug('got quotas', quotas)
    return quotas
  }

  static provide(
    resourceManager: ResourceManager,
    tabsManager: TabsManager,
    config: ConfigService
  ) {
    const service = new AIService(resourceManager, tabsManager, config)

    setContext('ai', service)

    return service
  }

  static use() {
    return getContext<AIService>('ai')
  }
}

export const useAI = AIService.use
export const provideAI = AIService.provide

export * from './chat'
