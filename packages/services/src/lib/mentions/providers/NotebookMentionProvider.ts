import type { MentionProvider, MentionItem, MentionType } from '../mention.types'
import { MentionTypes } from '../mention.types'
import { useLogScope } from '@deta/utils'
import { Notebook, useNotebookManager } from '../../notebooks'

export class NotebookMentionProvider implements MentionProvider {
  readonly name = 'notebooks'
  readonly type: MentionType = MentionTypes.NOTEBOOK
  readonly isLocal = true
  private readonly log = useLogScope('NotebookMentionProvider')

  private notebookManager = useNotebookManager()

  async initialize(): Promise<void> {
    this.log.debug('Initialized')
  }

  canHandle(query: string): boolean {
    return query.trim().length > 2
  }

  async getMentions(query: string): Promise<MentionItem[]> {
    try {
      const items = await this.searchNotebooks(query.trim())

      if (!items || items.length === 0) {
        return []
      }

      const mentionItems: MentionItem[] = items.map((notebook) => {
        return {
          id: notebook.id,
          type: MentionTypes.NOTEBOOK,
          name: notebook.data.name || (notebook.data as any).folderName,
          icon: 'notebook',
          priority: 50,
          keywords: ['notebook'],
          metadata: {
            resourceId: notebook.id
          }
        }
      })

      return mentionItems.slice(0, 5)

      // Strip the @ character from the query for filtering
      // const searchQuery = query.startsWith('@') ? query.slice(1) : query

      // // Filter and sort by query relevance
      // return filterAndSortMentions(mentionItems, searchQuery)
    } catch (error) {
      this.log.error('Error fetching tabs for mentions:', error)
      return []
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

  destroy(): void {
    // Cleanup if needed
  }
}
