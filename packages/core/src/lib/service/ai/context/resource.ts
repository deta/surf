import { EventContext, GeneratePromptsEventTrigger, ResourceTagsBuiltInKeys } from '@horizon/types'
import { truncateURL, getFileType, getURLBase } from '@horizon/utils'
import { get, type Writable, writable } from 'svelte/store'

import type { TabPage, TabResource } from '../../../types'
import { blobToDataUrl } from '../../../utils/screenshot'
import { ResourceJSON, type Resource } from '../../resources'

import type { ContextManager } from '../contextManager'
import { type ContextItemIcon, ContextItemIconTypes, ContextItemTypes } from './types'
import { ContextItemBase } from './base'
import { ModelTiers } from '@horizon/types/src/ai.types'
import type { ChatPrompt } from '../chat'
import { WebParser, type ResourceContent } from '@horizon/web-parser'
import { PAGE_PROMPTS_GENERATOR_PROMPT } from '../../../constants/prompts'
import { QuotaDepletedError } from '@horizon/backend/types'
import { handleQuotaDepletedError } from '../helpers'

export class ContextItemResource extends ContextItemBase {
  type = ContextItemTypes.RESOURCE

  label: Writable<string>
  icon: Writable<ContextItemIcon>
  generatingPromptsPromise: Promise<ChatPrompt[]> | null
  processingUnsub: Writable<(() => void) | null>

  sourceTab?: TabPage | TabResource
  data: Resource
  url: string | null

  constructor(manager: ContextManager, resource: Resource, sourceTab?: TabPage | TabResource) {
    super(manager, resource.id, 'file')

    this.sourceTab = sourceTab
    this.data = resource

    this.url =
      (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)
        ?.value ??
      resource.metadata?.sourceURI ??
      null

    this.label = writable('')
    this.icon = writable({ type: ContextItemIconTypes.ICON, data: this.fallbackIcon })
    this.processingUnsub = writable(null)
    this.generatingPromptsPromise = null

    this.setIcon()
  }

  setLabel() {
    if (this.sourceTab) {
      this.label.set(this.sourceTab.title)
    } else {
      this.label.set(
        this.data.metadata?.name ?? (this.url ? truncateURL(this.url) : getFileType(this.data.type))
      )
    }
  }

  async setIcon() {
    if (this.data.type.startsWith('image')) {
      const imagePreview = await this.getImageResourcePreview(this.data.id)
      if (imagePreview) {
        this.icon.set({ type: ContextItemIconTypes.IMAGE, data: imagePreview ?? this.fallbackIcon })
        return
      }
    }

    const url = this.url ? getURLBase(this.url) : null
    if (url) {
      this.icon.set({
        type: ContextItemIconTypes.IMAGE,
        data: `https://www.google.com/s2/favicons?domain=${url}&sz=48`
      })
    } else {
      // TODO: use icon based on resource type
      this.icon.set({ type: ContextItemIconTypes.ICON, data: this.fallbackIcon })
    }
  }

  async getContent() {
    if (this.data instanceof ResourceJSON) {
      const data = await this.data.getParsedData()
      const content = WebParser.getResourceContent(this.data.type, data)
      return content
    }

    const blob = await this.data.getData()
    const text = await blob.text()

    return {
      plain: null,
      html: text
    } as ResourceContent
  }

  async getResourceIds() {
    return [this.data.id]
  }

  async getInlineImages() {
    if (this.data.type.startsWith('image')) {
      const blob = await this.getResourceBlobData(this.data.id)
      if (!blob) {
        return []
      }

      const url = await blobToDataUrl(blob)
      if (!url) {
        return []
      }

      return [url]
    }

    return []
  }

  async generatePrompts(tier?: ModelTiers, isRetry = false): Promise<ChatPrompt[]> {
    if (get(this.generatingPrompts) && this.generatingPromptsPromise && !isRetry) {
      this.log.debug('Already generating prompts, piggybacking on existing promise')
      return new Promise(async (resolve, reject) => {
        try {
          const result = await this.generatingPromptsPromise!
          resolve(result)
        } catch (e) {
          reject([])
        }
      })
    }

    this.generatingPromptsPromise = new Promise(async (resolve, reject) => {
      try {
        this.generatingPrompts.set(true)
        this.manager.generatingPrompts.set(true)

        if (!(this.data instanceof ResourceJSON)) {
          this.log.debug('No resource content')
          this.generatingPrompts.set(false)
          this.manager.generatingPrompts.set(false)
          resolve([])
          return
        }

        const metadata = {
          title: this.sourceTab?.title ?? this.data.metadata?.name ?? '',
          url: (this.sourceTab?.type === 'page' && this.sourceTab?.currentLocation) || this.url
        }

        const resourceState = this.data.stateValue
        if (resourceState !== 'idle') {
          this.log.debug('Resource is still extracting')
          this.generatingPrompts.set(false)
          this.manager.generatingPrompts.set(false)

          if (resourceState === 'extracting' || resourceState === 'post-processing') {
            const unsubscribe = this.data.state.subscribe(async (state) => {
              const processingUnsub = get(this.processingUnsub)
              if (processingUnsub) {
                processingUnsub()
                this.processingUnsub.set(null)
              }

              if (state === 'idle') {
                const res = await this.generatePrompts(tier, isRetry)
                resolve(res)
              } else if (state === 'error') {
                resolve([])
              }
            })

            this.processingUnsub.set(unsubscribe)
          }
          return
        }

        const content = await this.getContent()

        this.log.debug(
          'Generating prompts for resource',
          metadata.title,
          (content.plain ?? content.html)?.length
        )
        const prompts = await this.manager.ai.generatePrompts(
          {
            title: metadata.title ?? '',
            url: metadata.url ?? '',
            content: content.plain ?? content.html ?? ''
          },
          {
            context: EventContext.Chat,
            trigger: GeneratePromptsEventTrigger.ActiveTabChange
          }
        )

        if (!prompts) {
          this.generatingPrompts.set(false)
          this.manager.generatingPrompts.set(false)
          resolve([])
          return
        }

        resolve(prompts)
      } catch (e) {
        this.log.error('Error generating prompts', e)
        if (e instanceof QuotaDepletedError) {
          const res = handleQuotaDepletedError(e)
          this.log.error('Quota depleted', res)
          if (
            !isRetry &&
            res.exceededTiers.length === 1 &&
            res.exceededTiers.includes(ModelTiers.Standard)
          ) {
            this.log.debug('Retrying with premium model')
            const newTry = await this.generatePrompts(ModelTiers.Premium, true)
            resolve(newTry)
            return
          }
        } else {
          this.log.error('Error generating prompts', e)
        }

        resolve([])
      } finally {
        this.generatingPrompts.set(false)
        this.manager.generatingPrompts.set(false)
      }
    })

    return this.generatingPromptsPromise
  }
}
