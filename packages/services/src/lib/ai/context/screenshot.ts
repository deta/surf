import { generateID } from '@deta/utils'
import { type Writable, writable } from 'svelte/store'

import { blobToDataUrl } from '@deta/utils/browser'
import { ContextItemBase } from './base'
import type { ContextService } from '../contextManager'
import { ContextItemTypes, type ContextItemIcon, ContextItemIconTypes } from './types'

export class ContextItemScreenshot extends ContextItemBase {
  type = ContextItemTypes.SCREENSHOT
  icon: Writable<ContextItemIcon>
  data: Blob

  constructor(service: ContextService, screenshot: Blob) {
    super(service, generateID(), 'screenshot')

    this.data = screenshot
    this.icon = writable({ type: ContextItemIconTypes.ICON, data: this.fallbackIcon })
    this.label = writable('Screenshot')

    this.setIcon()
  }

  async setIcon() {
    const imagePreview = await this.getImagPreview(this.data)
    if (imagePreview) {
      this.icon.set({ type: ContextItemIconTypes.IMAGE, data: imagePreview })
    } else {
      this.icon.set({ type: ContextItemIconTypes.ICON, data: this.fallbackIcon })
    }
  }

  async getResourceIds(_prompt?: string) {
    return []
  }

  async getInlineImages() {
    const url = await blobToDataUrl(this.data)
    if (!url) {
      return []
    }

    return [url]
  }

  async generatePrompts() {
    return []
  }
}
