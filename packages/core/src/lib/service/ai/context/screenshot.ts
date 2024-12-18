import { generateID } from '@horizon/utils'
import { type Writable, writable } from 'svelte/store'

import { blobToDataUrl } from '../../../utils/screenshot'
import { ContextItemBase } from './base'
import type { ContextManager } from '../contextManager'
import { ContextItemTypes, type ContextItemIcon, ContextItemIconTypes } from './types'

export class ContextItemScreenshot extends ContextItemBase {
  type = ContextItemTypes.SCREENSHOT
  icon: Writable<ContextItemIcon>
  data: Blob

  constructor(manager: ContextManager, screenshot: Blob) {
    super(manager, generateID(), 'screenshot')

    this.data = screenshot
    this.icon = writable({ type: ContextItemIconTypes.ICON, data: this.fallbackIcon })

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

  async getResourceIds() {
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
