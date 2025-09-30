import { type MentionItem } from '@deta/editor'
import { generateUUID, useLogScope } from '@deta/utils'

import { useBrowser } from '../../browser'
import type { ActionProvider, TeletypeAction } from '../types'
import { TeletypeService } from '../teletypeService'

export class AskProvider implements ActionProvider {
  readonly name = 'ask'
  readonly isLocal = true

  private readonly service: TeletypeService
  private readonly log = useLogScope('AskProvider')

  constructor(service: TeletypeService) {
    this.service = service
  }

  canHandle(query: string): boolean {
    return query.trim().length > 0
  }

  async getActions(query: string, mentions: MentionItem[]): Promise<TeletypeAction[]> {
    const actions: TeletypeAction[] = []
    const trimmedQuery = query.trim()

    if (!trimmedQuery) return actions

    actions.push({
      id: 'ask-action',
      name: `${trimmedQuery}`,
      icon: 'face',
      section: 'Ask Surf',
      priority: 95,
      keywords: ['ask', 'question', 'ai', 'chat', 'help'],
      // description: `Create a new Note about "${trimmedQuery}"`,
      buttonText: 'Ask Surf',
      handler: async () => {
        await this.triggerAskAction(trimmedQuery, mentions)
      }
    })

    return actions
  }

  async triggerAskAction(query: string, mentions: MentionItem[]): Promise<void> {
    try {
      this.log.debug('Triggering ask action for query:', query, 'with mentions:', mentions)
      await this.service.ask({ query, mentions })
    } catch (error) {
      this.log.error('Failed to trigger ask action:', error)
    }
  }
}
