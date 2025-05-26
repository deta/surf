import { derived } from 'svelte/store'

import { type TabSpace, SpaceEntryOrigin, type SpaceData } from '../../../types'
import type { OasisSpace } from '../../oasis'

import { ContextItemBase } from './base'
import type { ContextService } from '../contextManager'
import { ContextItemTypes, ContextItemIconTypes, type ContextItemIcon } from './types'

export class ContextItemSpace extends ContextItemBase {
  type = ContextItemTypes.SPACE
  sourceTab?: TabSpace
  data: OasisSpace

  constructor(service: ContextService, space: OasisSpace, sourceTab?: TabSpace) {
    super(service, space.id, 'circle-dot')

    this.sourceTab = sourceTab
    this.data = space

    this.label = derived([space.data], ([spaceData]) => {
      return spaceData.folderName ?? 'Space'
    })

    this.icon = derived([space.data], ([spaceData]) => {
      const icon = ContextItemSpace.getSpaceIcon(spaceData)
      if (icon) {
        return icon
      } else {
        return { type: ContextItemIconTypes.ICON, data: this.fallbackIcon } as ContextItemIcon
      }
    })
  }

  async getResourceIds(_prompt?: string) {
    const spaceContents = await this.service.tabsManager.oasis.getSpaceContents(this.data.id)
    const filteredContents = spaceContents
      .filter((content) => content.manually_added !== SpaceEntryOrigin.Blacklisted)
      .map((content) => content.resource_id)
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
