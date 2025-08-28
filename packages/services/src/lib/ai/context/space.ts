import { derived } from 'svelte/store'

import { SpaceEntryOrigin, type SpaceData } from '@deta/types'

import { ContextItemBase } from './base'
import type { ContextService } from '../contextManager'
import { ContextItemTypes, ContextItemIconTypes, type ContextItemIcon } from './types'

export class ContextItemSpace extends ContextItemBase {
  type = ContextItemTypes.SPACE
  sourceTab?: any
  data: any

  constructor(service: ContextService, space: any, sourceTab?: any) {
    super(service, space.id, 'circle-dot')

    this.sourceTab = sourceTab
    this.data = space

    this.label = derived([space.data], ([spaceData]) => {
      return spaceData.folderName ?? 'Space'
    })

    this.icon = derived([space.data], ([spaceData]) => {
      const icon = ContextItemSpace.getSpaceIcon(spaceData as any)
      if (icon) {
        return icon
      } else {
        return { type: ContextItemIconTypes.ICON, data: this.fallbackIcon } as ContextItemIcon
      }
    })

    this.iconString = derived([this.icon], ([icon]) => {
      return this.contextItemIconToString(icon, this.fallbackIcon)
    })
  }

  async getResourceIds(_prompt?: string) {
    const spaceContents = await this.service.tabsManager.oasis.getSpaceContents(this.data.id)
    const filteredContents = spaceContents
      // TODO: support sub spaces in the context
      .filter(
        (content) =>
          content.manually_added !== SpaceEntryOrigin.Blacklisted && content.entry_type !== 'space'
      )
      .map((content) => content.entry_id)
    return filteredContents
  }

  async getInlineImages() {
    // TODO: in theory we could grab all image resources here
    return []
  }

  async generatePrompts() {
    return []
  }

  static getSpaceIcon(spaceData: SpaceData): ContextItemIcon | null {
    if (spaceData.emoji) {
      return { type: ContextItemIconTypes.EMOJI, data: spaceData.emoji }
    } else if (spaceData.imageIcon) {
      return { type: ContextItemIconTypes.IMAGE, data: spaceData.imageIcon }
    } else if (spaceData.colors) {
      return { type: ContextItemIconTypes.COLORS, data: spaceData.colors }
    } else {
      return null
    }
  }
}
