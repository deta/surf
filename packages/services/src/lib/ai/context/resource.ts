import { EventContext, GeneratePromptsEventTrigger, ResourceTagsBuiltInKeys } from '@deta/types'
import { truncateURL, getFileType, getURLBase, getFileKind } from '@deta/utils'
import { derived, get, type Writable, writable } from 'svelte/store'

import { blobToDataUrl } from '@deta/utils/browser'
import { ResourceJSON, type Resource } from '../../resources'

import type { ContextService } from '../contextManager'
import { type ContextItemIcon, ContextItemIconTypes, ContextItemTypes } from './types'
import { ContextItemBase } from './base'
import { ModelTiers } from '@deta/types/src/ai.types'
import type { ChatPrompt } from '../chat'
import { WebParser, type ResourceContent } from '@deta/web-parser'
import { isGeneratedResource } from '@deta/services/resources'
import { TabItem } from '../../tabs'

const RESOURCE_PROCESSING_TIMEOUT = 30000

export class ContextItemResource extends ContextItemBase {
  type = ContextItemTypes.RESOURCE

  label: Writable<string>
  dynamicIcon: Writable<ContextItemIcon>
  generatingPromptsPromise: Promise<ChatPrompt[]> | null
  processingUnsubPrompt: Writable<(() => void) | null>
  processingUnsubGetResource: Writable<(() => void) | null>

  sourceTab?: TabItem
  data: Resource
  url: string | null

  processingTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(service: ContextService, resource: Resource, sourceTab?: TabItem) {
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
      this.label.set(this.sourceTab.titleValue)
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

  async getResource(retryOnError = true) {
    const returnValue = [this.data.id]
    const resourceState = this.data.stateValue
    this.log.debug('Making sure resource is prepared', returnValue, resourceState, { retryOnError })

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
    } else if (resourceState === 'error') {
      if (!retryOnError) {
        this.log.debug('Resource is in error state, not retrying')
        return returnValue
      }

      this.log.debug('Resource is in error state, triggering re-processing')

      await this.data.refreshExtractedData()

      return this.getResource(false) as Promise<string[]>
    }

    return returnValue
  }

  async getResourceIds(_prompt?: string) {
    try {
      return await this.getResource()
    } catch (error) {
      this.log.error('Failed to get resource ids', error)
      return []
    }
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
          title: this.sourceTab?.titleValue ?? this.data.metadata?.name ?? '',
          url: this.sourceTab?.view.urlValue
        }

        const resourceState = this.data.stateValue
        if (resourceState !== 'idle') {
          this.log.debug(
            'Resource is still extracting, waiting for it to finish until generating prompts'
          )
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
          } else {
            this.log.debug('Resource is in error state, not generating prompts', resourceState)
            resolve([])
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
        resolve([])
      } finally {
        this.generatingPrompts.set(false)
        // this.manager.generatingPrompts.set(false)
      }
    })

    return this.generatingPromptsPromise
  }
}
