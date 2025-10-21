import type { NotebookData } from '@deta/types'
import type { Notebook } from './notebook.svelte'

export enum NotebookManagerEvents {
  Created = 'created-notebook',
  Updated = 'updated-notebook',
  Deleted = 'deleted-notebook',
  AddedResources = 'added-notebook-resource',
  RemovedResources = 'removed-notebook-resource',

  CreatedResource = 'created-resource',
  UpdatedResource = 'updated-resource',
  DeletedResource = 'deleted-resource'
}
export type NotebookManagerEventHandlers = {
  [NotebookManagerEvents.Created]: (notebookId: string) => void
  [NotebookManagerEvents.Updated]: (notebookId: string, changes: Partial<NotebookData>) => void
  [NotebookManagerEvents.Deleted]: (notebookId: string) => void
  [NotebookManagerEvents.AddedResources]: (notebookId: string, resourceIds: string[]) => void
  [NotebookManagerEvents.RemovedResources]: (notebookId: string, resourceIds: string[]) => void

  [NotebookManagerEvents.CreatedResource]: (resourceId: string) => void
  [NotebookManagerEvents.UpdatedResource]: (resourceId: string) => void
  [NotebookManagerEvents.DeletedResource]: (resourceId: string) => void
}
