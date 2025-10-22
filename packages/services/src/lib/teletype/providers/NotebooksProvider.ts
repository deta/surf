import { type MentionItem } from '@deta/editor'
import type { ActionProvider, TeletypeAction } from '../types'
import { generateUUID, useLogScope, truncate } from '@deta/utils'
import { useBrowser } from '../../browser'
import { Notebook, useNotebookManager } from '../../notebooks'

export class NotebooksProvider implements ActionProvider {
  readonly name = 'notebooks-search'
  readonly isLocal = false
  private readonly log = useLogScope('NotebooksProvider')
  private readonly notebookManager = useNotebookManager()
  private readonly browser = useBrowser()

  canHandle(query: string): boolean {
    return query.trim().length >= 2
  }

  async getActions(query: string, _mentions: MentionItem[]): Promise<TeletypeAction[]> {
    const actions: TeletypeAction[] = []
    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 2) return actions

    try {
      const items = await this.searchNotebooks(trimmedQuery)
      items.forEach((item, index) => {
        actions.push(this.createAction(item, 80 - index, ['search', 'notebook', 'note', 'context']))
      })

      if ('drafts'.includes(query.trim().toLowerCase())) {
        actions.push({
          id: generateUUID(),
          name: 'Drafts',
          icon: `notebook`,
          section: 'Your Notebooks',
          priority: 80,
          keywords: ['search', 'notebook', 'note', 'context'],
          description: ``,
          buttonText: 'Open',
          handler: async () => {
            await this.browser.openNotebookInCurrentTab('drafts')
          }
        })
      }
    } catch (error) {
      this.log.error('Failed to fetch search suggestions:', error)
    }

    return actions
  }

  private createAction(notebook: Notebook, priority: number, keywords: string[]): TeletypeAction {
    return {
      id: generateUUID(),
      name: truncate(notebook.nameValue, 30),
      icon: `notebook`,
      section: 'Your Notebooks',
      priority,
      keywords,
      description: ``,
      buttonText: 'Open',
      handler: async () => {
        await this.browser.openNotebookInCurrentTab(notebook.id)
      }
    }
  }

  private async searchNotebooks(query: string): Promise<Notebook[]> {
    try {
      const notebooks = Array.from(this.notebookManager.notebooks.values())
      return notebooks.filter((notebook) =>
        notebook.nameValue.toLowerCase().includes(query.toLowerCase())
      )
    } catch (error) {
      this.log.error('Error fetching Google suggestions:', error)
      return []
    }
  }
}
