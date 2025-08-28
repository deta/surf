import { type Writable, type Readable, writable, get, derived } from 'svelte/store'
import { useLogScope } from '@deta/utils/io'

import { blobToSmallImageUrl } from '@deta/utils/browser'

import type { ContextService } from '../contextManager'
import { ContextItemTypes, type ContextItemIcon, ContextItemIconTypes } from './types'
import { type ChatPrompt } from '@deta/types'

export abstract class ContextItemBase {
  abstract type: ContextItemTypes

  id: string
  fallbackIcon: string

  label: Readable<string>
  icon: Readable<ContextItemIcon>
  iconString: Readable<string>
  prompts: Writable<ChatPrompt[]>
  generatingPrompts: Writable<boolean>
  visible: Writable<boolean>
  loading: Writable<boolean>
  promptsPromise: Promise<ChatPrompt[]> | null = null

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
    this.loading = writable(false)

    this.iconString = derived([this.icon], ([icon]) => {
      return this.contextItemIconToString(icon, this.fallbackIcon)
    })
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

  get iconStringValue() {
    return get(this.iconString)
  }

  get loadingValue() {
    return get(this.loading)
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

    if (this.promptsPromise) {
      this.log.debug('Prompts are already being generated, waiting for them to finish')
      return this.promptsPromise
    }

    this.promptsPromise = this.generatePrompts()
    const generatedPrompts = await this.promptsPromise
    this.promptsPromise = null

    this.prompts.set(generatedPrompts)
    return generatedPrompts
  }

  contextItemIconToString = (icon: ContextItemIcon, fallback: string): string => {
    if (icon.type === ContextItemIconTypes.ICON) {
      return `icon;;${icon.data}`
    } else if (icon.type === ContextItemIconTypes.ICON_FILE) {
      return `file;;${icon.data}`
    } else if (icon.type === ContextItemIconTypes.EMOJI) {
      return `emoji;;${icon.data}`
    } else if (icon.type === ContextItemIconTypes.IMAGE) {
      return `image;;${icon.data}`
    } else if (icon.type === ContextItemIconTypes.COLORS) {
      const [color1, color2] = icon.data
      return `colors;;${color1};;${color2}`
    } else {
      return `icon;;${fallback}`
    }
  }

  onDestroy() {
    this.log.debug('Destroying context item')
    // no-op
  }

  abstract getResourceIds(prompt?: string): Promise<string[]>
  abstract getInlineImages(): Promise<string[]>
  abstract generatePrompts(): Promise<ChatPrompt[]>
}
