import { getContext, setContext } from 'svelte'
import type { ConfigService } from '../config'
import type { ResourceManager } from '../resources'
import type { SFFS } from '../sffs'
import {
  QuotaDepletedError,
  type Message,
  type Model as ModelBackend,
  type Quota
} from '@horizon/backend/types'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import { generateID, useLogScope } from '@horizon/utils'
import { SIMPLE_SUMMARIZER_PROMPT } from '../../constants/prompts'
import type { AIChatMessage, AIChatMessageParsed, AiSFFSQueryResponse } from '../../types'
import { BUILT_IN_MODELS, ModelTiers, type Model } from '@horizon/types/src/ai.types'
import { handleQuotaDepletedError } from './helpers'

export class AIChat {
  id: string
  messages: Writable<AIChatMessage[]>

  userMessages: Readable<AIChatMessage[]>
  systemMessages: Readable<AIChatMessage[]>
  responses: Readable<AIChatMessageParsed[]>

  ai: AIService
  sffs: SFFS
  log: ReturnType<typeof useLogScope>

  constructor(id: string, messages: AIChatMessage[], ai: AIService) {
    this.id = id
    this.messages = writable(messages)

    this.ai = ai
    this.sffs = ai.sffs
    this.log = useLogScope('AIChat')

    this.userMessages = derived([this.messages], ([messages]) => {
      return messages.filter((msg) => msg.role === 'user')
    })

    this.systemMessages = derived([this.messages], ([messages]) => {
      return messages.filter((msg) => msg.role === 'assistant')
    })

    this.responses = derived(
      [this.userMessages, this.systemMessages],
      ([userMessages, systemMessages]) => {
        const queries = userMessages.map((message) => message.content) // TODO: persist the query saved in the AIChatMessageParsed instead of using the actual content

        return systemMessages.map((message, idx) => {
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
      }
    )
  }

  get messagesValue() {
    return get(this.messages)
  }

  get responsesValue() {
    return get(this.responses)
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
}

export class AIService {
  resourceManager: ResourceManager
  sffs: SFFS
  config: ConfigService
  log: ReturnType<typeof useLogScope>

  selectedModelId: Readable<string>
  selectedModel: Readable<Model>
  models: Readable<Model[]>

  constructor(resourceManager: ResourceManager, config: ConfigService) {
    this.resourceManager = resourceManager
    this.sffs = resourceManager.sffs
    this.config = config
    this.log = useLogScope('AI')

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

  async createChat(system_prompt?: string): Promise<AIChat | null> {
    this.log.debug('creating ai chat (custom system prompt:', system_prompt, ')')
    const chatId = await this.sffs.createAIChat(system_prompt)

    if (!chatId) {
      this.log.error('failed to create ai chat')
      return null
    }

    this.log.debug('created ai chat with id', chatId)
    return new AIChat(chatId, [], this)
  }

  async getChat(id: string): Promise<AIChat | null> {
    this.log.debug('getting ai chat with id', id)
    const chatData = await this.sffs.getAIChat(id)

    if (!chatData) {
      this.log.error('failed to get ai chat')
      return null
    }

    this.log.debug('got ai chat', chatData)
    return new AIChat(chatData.id, chatData.messages, this)
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
    return result
  }

  async getResourcesViaPrompt(
    prompt: string,
    opts?: {
      tier?: ModelTiers
      sqlQuery?: string
      embeddingQuery?: string
      embeddingDistanceThreshold?: number
    }
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
          tier === ModelTiers.Premium &&
          res.exceededTiers.length === 1 &&
          res.exceededTiers.includes(ModelTiers.Premium)
        ) {
          this.log.debug('Retrying with standard model')
          return this.getResourcesViaPrompt(prompt, { ...opts, tier: ModelTiers.Standard })
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

  async summarizeText(text: string, additionalSystemPrompt?: string) {
    const summary = await this.createChatCompletion(
      text,
      SIMPLE_SUMMARIZER_PROMPT + (additionalSystemPrompt ? ' ' + additionalSystemPrompt : ''),
      { tier: ModelTiers.Standard }
    )

    this.log.debug('Summarized text', summary)

    return summary
  }

  async getQuotas(): Promise<Quota[]> {
    this.log.debug('getting quotas')
    const quotas = await this.sffs.getQuotas()
    this.log.debug('got quotas', quotas)
    return quotas
  }

  static provide(resourceManager: ResourceManager, config: ConfigService) {
    const service = new AIService(resourceManager, config)

    setContext('ai', service)

    return service
  }

  static use() {
    return getContext<AIService>('ai')
  }
}

export const useAI = AIService.use
export const provideAI = AIService.provide
