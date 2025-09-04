import { type MentionItem } from '@deta/editor'
import { generateUUID, useLogScope } from '@deta/utils'

import { useBrowser } from '../../browser'
import type { ActionProvider, TeletypeAction } from '../types'

export class AskProvider implements ActionProvider {
  readonly name = 'ask'
  readonly isLocal = true
  private readonly log = useLogScope('AskProvider')
  private readonly browser = useBrowser()

  canHandle(query: string): boolean {
    return query.trim().length > 0
  }

  async getActions(query: string, mentions: MentionItem[]): Promise<TeletypeAction[]> {
    const actions: TeletypeAction[] = []
    const trimmedQuery = query.trim()

    if (!trimmedQuery) return actions

    actions.push({
      id: generateUUID(),
      name: `Ask about "${trimmedQuery}"`,
      icon: 'message',
      section: 'Ask',
      priority: 90,
      keywords: ['ask', 'question', 'ai', 'chat', 'help'],
      description: `Create a new Note about "${trimmedQuery}"`,
      buttonText: 'Ask',
      handler: async () => {
        await this.triggerAskAction(trimmedQuery, mentions)
      }
    })

    return actions
  }

  async triggerAskAction(query: string, mentions: MentionItem[]): Promise<void> {
    try {
      this.log.debug('Triggering ask action for query:', query, 'with mentions:', mentions)

      await this.browser.createNoteAndRunAIQuery(query, mentions, {
        target: 'tab',
        notebookId: 'auto'
      })
    } catch (error) {
      this.log.error('Failed to trigger ask action:', error)
    }
  }
}
