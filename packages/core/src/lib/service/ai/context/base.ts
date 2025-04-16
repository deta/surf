import { type Writable, type Readable, writable, get } from 'svelte/store'
import { useLogScope } from '@horizon/utils'

import { blobToSmallImageUrl } from '../../../utils/screenshot'
import type { ChatPrompt } from '../chat'

import type { ContextService } from '../contextManager'
import { ContextItemTypes, type ContextItemIcon, ContextItemIconTypes } from './types'

export abstract class ContextItemBase {
  abstract type: ContextItemTypes

  id: string
  fallbackIcon: string

  label: Readable<string>
  icon: Readable<ContextItemIcon>
  prompts: Writable<ChatPrompt[]>
  generatingPrompts: Writable<boolean>
  visible: Writable<boolean>

  service: ContextService
  log: ReturnType<typeof useLogScope>

  constructor(service: ContextService, id: string, fallbackIcon = 'world', icon?: ContextItemIcon) {
    this.service = service
    this.log = useLogScope(`ContextItem ${id}`)
    this.id = id
    this.fallbackIcon = fallbackIcon

    this.label = writable('')
    this.icon = writable(icon ?? { type: ContextItemIconTypes.ICON, data: fallbackIcon })
    this.prompts = writable([])
    this.generatingPrompts = writable(false)
    this.visible = writable(true)
  }

  get iconValue() {
    return get(this.icon)
  }

  get labelValue() {
    return get(this.label)
  }

  get promptsValue() {
    return get(this.prompts)
  }

  get visibleValue() {
    return get(this.visible)
  }

  setVisibility(visible: boolean) {
    this.visible.set(visible)
  }

  async getImagPreview(blob: Blob) {
    const dataUrl = await blobToSmallImageUrl(blob)
    if (!dataUrl) {
      return null
    }

    return dataUrl
  }

  async getResourceBlobData(resourceId: string) {
    const resource = await this.service.resourceManager.getResource(resourceId)
    if (!resource) {
      return null
    }

    const blob = await resource.getData()
    resource.releaseData()

    return blob
  }

  async getImageResourcePreview(resourceId: string) {
    const blob = await this.getResourceBlobData(resourceId)
    if (!blob) {
      return null
    }

    return this.getImagPreview(blob)
  }

  async getPrompts(fresh = false) {
    const storedPrompts = this.promptsValue
    if (storedPrompts.length > 0 && !fresh) {
      return storedPrompts
    }

    const generatedPrompts = await this.generatePrompts()
    this.prompts.set(generatedPrompts)
    return generatedPrompts
  }

  onDestroy() {
    this.log.debug('Destroying context item')
    // no-op
  }

  abstract getResourceIds(prompt?: string): Promise<string[]>
  abstract getInlineImages(): Promise<string[]>
  abstract generatePrompts(): Promise<ChatPrompt[]>
}
