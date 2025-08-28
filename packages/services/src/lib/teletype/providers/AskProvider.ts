import type { ActionProvider, TeletypeAction } from '../types'
import { generateUUID, useLogScope } from '@deta/utils'

export class AskProvider implements ActionProvider {
  readonly name = 'ask'
  readonly isLocal = true
  private readonly log = useLogScope('AskProvider')

  canHandle(query: string): boolean {
    return query.trim().length > 0
  }

  async getActions(query: string): Promise<TeletypeAction[]> {
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
        await this.triggerAskAction(trimmedQuery)
      }
    })

    return actions
  }

  private async triggerAskAction(query: string): Promise<void> {
    try {
      this.log.debug('Triggering ask action for query:', query)
      // AI integration will be implemented here
    } catch (error) {
      this.log.error('Failed to trigger ask action:', error)
    }
  }
}
