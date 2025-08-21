import type { NotebookData } from '@deta/types'
import type { Notebook } from './notebook'

export type NotebookManagerEmitterEvents = {
  created: (notebook: Notebook) => void
  updated: (notebook: Notebook, changes: Partial<NotebookData>) => void
  'added-resources': (notebook: Notebook, resourceIds: string[]) => void
  'removed-resources': (notebook: Notebook, resourceIds: string[]) => void
  deleted: (notebookId: string) => void
  'changed-active-notebook': (notebook: Notebook | null) => void
  'reload-notebook': (notebookId: string) => void
}
