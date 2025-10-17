import { getContext, setContext } from 'svelte'
import type { ConfigService } from '../config'
import { ResourceManager } from '@deta/services/resources'
import type { SFFS } from '../sffs'

import {
  QuotaDepletedError,
  type Message,
  type Model as ModelBackend,
  type Quota
} from '@deta/backend/types'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import { appendURLPath, isDev, useLocalStorageStore, useLogScope } from '@deta/utils'
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
  type ChatCompletionResponse,
  type ChatPrompt,
  type Model
} from '@deta/types/src/ai.types'
import { handleQuotaDepletedError, parseAIError } from './helpers'
import { EventContext, GeneratePromptsEventTrigger, SummarizeEventContentSource } from '@deta/types'

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

  showChatSidebar: Writable<boolean>
  activeSidebarChatId: Writable<string>

  selectedModelId: Readable<string>
  selectedModel: Readable<Model>
  models: Readable<Model[]>
  alwaysIncludeScreenshotInChat: Readable<boolean>

  constructor(resourceManager: ResourceManager, config: ConfigService) {
    this.resourceManager = resourceManager
    this.sffs = resourceManager.sffs
    this.config = config
    this.log = useLogScope('AI')

    this.showChatSidebar = writable(false)
    this.activeSidebarChatId = useLocalStorageStore<string>('activeChatId', '')

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

  get activeSidebarChatIdValue() {
    return get(this.activeSidebarChatId)
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
        messages.push({
          role: 'system',
          content: [{ type: 'text', text: systemPrompt }]
        })
      }

      if (typeof userPrompt === 'string') {
        messages.push({
          role: 'user',
          content: [{ type: 'text', text: userPrompt }]
        })
      } else {
        userPrompt.forEach((prompt) => {
          messages.push({
            role: 'user',
            content: [{ type: 'text', text: prompt }]
          })
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
      if (e instanceof QuotaDepletedError) {
        const res = handleQuotaDepletedError(e)
        this.log.error('Quota depleted', res)
        if (
          options?.quotaErrorRetry === true &&
          res.exceededTiers.length === 1 &&
          res.exceededTiers.includes(options.tier)
        ) {
          const tier =
            options.tier === ModelTiers.Standard ? ModelTiers.Premium : ModelTiers.Standard
          this.log.debug('Retrying with different model tier', tier)
          return this.createChatCompletion(userPrompt, systemPrompt, {
            ...options,
            tier: tier,
            quotaErrorRetry: false
          })
        }
      }

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

  async getQuotas(): Promise<Quota[]> {
    this.log.debug('getting quotas')
    const quotas = await this.sffs.getQuotas()
    this.log.debug('got quotas', quotas)
    return quotas
  }

  static provide(resourceManager: ResourceManager, config: ConfigService) {
    const service = new AIService(resourceManager, config)

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
