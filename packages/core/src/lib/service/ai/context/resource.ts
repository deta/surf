import { EventContext, GeneratePromptsEventTrigger, ResourceTagsBuiltInKeys } from '@horizon/types'
import { truncateURL, getFileType, getURLBase, getFileKind } from '@horizon/utils'
import { derived, get, type Writable, writable } from 'svelte/store'

import type { TabPage, TabResource } from '../../../types'
import { blobToDataUrl } from '../../../utils/screenshot'
import { ResourceJSON, type Resource } from '../../resources'

import type { ContextService } from '../contextManager'
import { type ContextItemIcon, ContextItemIconTypes, ContextItemTypes } from './types'
import { ContextItemBase } from './base'
import { ModelTiers } from '@horizon/types/src/ai.types'
import type { ChatPrompt } from '../chat'
import { WebParser, type ResourceContent } from '@horizon/web-parser'
import { QuotaDepletedError } from '@horizon/backend/types'
import { handleQuotaDepletedError } from '../helpers'
import { isGeneratedResource } from '../../../utils/resourcePreview'

const RESOURCE_PROCESSING_TIMEOUT = 30000

export class ContextItemResource extends ContextItemBase {
  type = ContextItemTypes.RESOURCE

  label: Writable<string>
  dynamicIcon: Writable<ContextItemIcon>
  generatingPromptsPromise: Promise<ChatPrompt[]> | null
  processingUnsubPrompt: Writable<(() => void) | null>
  processingUnsubGetResource: Writable<(() => void) | null>

  sourceTab?: TabPage | TabResource
  data: Resource
  url: string | null

  processingTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(service: ContextService, resource: Resource, sourceTab?: TabPage | TabResource) {
    super(service, resource.id, 'file')

    this.sourceTab = sourceTab
    this.data = resource

    this.url =
      (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)
        ?.value ??
      resource.metadata?.sourceURI ??
      null

    this.label = writable('')
    this.dynamicIcon = writable({ type: ContextItemIconTypes.ICON, data: this.fallbackIcon })
    this.processingUnsubPrompt = writable(null)
    this.processingUnsubGetResource = writable(null)
    this.generatingPromptsPromise = null

    this.setIcon()
    this.setLabel()

    this.icon = derived([this.dynamicIcon], ([icon]) => {
      return icon
    })

    this.iconString = derived([this.icon], ([icon]) => {
      return this.contextItemIconToString(icon, this.fallbackIcon)
    })
  }

  get iconValue() {
    return get(this.icon)
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
        this.dynamicIcon.set({
          type: ContextItemIconTypes.IMAGE,
          data: imagePreview ?? this.fallbackIcon
        })
        return
      }
    }
    if (isGeneratedResource(this.data)) {
      this.dynamicIcon.set({ type: ContextItemIconTypes.ICON, data: 'code-block' })
      return
    }

    const url = this.url ? getURLBase(this.url) : null
    this.log.debug('Setting icon for resource', this.data.id, url)
    if (url) {
      this.dynamicIcon.set({
        type: ContextItemIconTypes.IMAGE,
        data: `https://www.google.com/s2/favicons?domain=${url}&sz=48`
      })
    } else {
      this.dynamicIcon.set({
        type: ContextItemIconTypes.ICON_FILE,
        data: getFileKind(this.data.type)
      })
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

  async getResourceIds(_prompt?: string) {
    const returnValue = [this.data.id]
    const resourceState = this.data.stateValue
    this.log.debug('Getting resource ids', returnValue, resourceState)

    if (resourceState === 'extracting' || resourceState === 'post-processing') {
      this.log.debug('Resource is still extracting, waiting for it to finish')

      return new Promise<string[]>(async (resolve) => {
        const unsubscribe = this.data.state.subscribe(async (state) => {
          const processingUnsubGetResource = get(this.processingUnsubGetResource)
          if (processingUnsubGetResource) {
            processingUnsubGetResource()
            this.processingUnsubGetResource.set(null)
          }

          if (this.processingTimeout) {
            clearTimeout(this.processingTimeout)
            this.processingTimeout = null
          }

          if (state === 'idle') {
            this.log.debug('Resource is now idle')
            resolve(returnValue)
          } else if (state === 'error') {
            this.log.debug('Resource is in error state')
            // we still return the ID so the chat will still use the resource and the backend might be able to use old data
            resolve(returnValue)
          }
        })

        this.processingUnsubGetResource.set(unsubscribe)

        this.processingTimeout = setTimeout(() => {
          this.log.debug('Resource processing timed out')
          // we still return the ID so the chat will still use the resource and the backend might be able to use old data
          resolve(returnValue)
        }, RESOURCE_PROCESSING_TIMEOUT)
      })
    }

    return returnValue
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
        // this.manager.generatingPrompts.set(true)

        if (!(this.data instanceof ResourceJSON)) {
          this.log.debug('No resource content')
          this.generatingPrompts.set(false)
          // this.manager.generatingPrompts.set(false)
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
          // this.manager.generatingPrompts.set(false)

          if (resourceState === 'extracting' || resourceState === 'post-processing') {
            const unsubscribe = this.data.state.subscribe(async (state) => {
              const processingUnsubPrompt = get(this.processingUnsubPrompt)
              if (processingUnsubPrompt) {
                processingUnsubPrompt()
                this.processingUnsubPrompt.set(null)
              }

              if (state === 'idle') {
                const res = await this.generatePrompts(tier, isRetry)
                resolve(res)
              } else if (state === 'error') {
                resolve([])
              }
            })

            this.processingUnsubPrompt.set(unsubscribe)
          }
          return
        }

        const content = await this.getContent()

        this.log.debug(
          'Generating prompts for resource',
          metadata.title,
          (content.plain ?? content.html)?.length
        )
        const prompts = await this.service.ai.generatePrompts(
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
          // this.manager.generatingPrompts.set(false)
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
        // this.manager.generatingPrompts.set(false)
      }
    })

    return this.generatingPromptsPromise
  }
}
