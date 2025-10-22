import { derived } from 'svelte/store'

import { SpaceEntryOrigin, type SpaceData } from '@deta/types'

import { ContextItemBase } from './base'
import type { ContextService } from '../contextManager'
import { ContextItemTypes, ContextItemIconTypes, type ContextItemIcon } from './types'
import { Notebook } from '../../notebooks'

export class ContextItemNotebook extends ContextItemBase {
  type = ContextItemTypes.NOTEBOOK
  sourceTab?: any
  data: Notebook

  constructor(service: ContextService, notebook: Notebook, sourceTab?: any) {
    super(service, notebook.id, 'circle-dot')

    this.sourceTab = sourceTab
    this.data = notebook

    this.label = derived([notebook.data], ([notebookData]) => {
      return notebookData.name ?? 'Notebook'
    })

    this.icon = derived([notebook.data], ([notebookData]) => {
      // TODO: use new IconData type for context items
      const icon = notebookData.icon as unknown as ContextItemIcon
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
    const notebookContents = await this.data.fetchContents()
    const filteredContents = notebookContents
      // TODO: support sub notebooks in the context
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
