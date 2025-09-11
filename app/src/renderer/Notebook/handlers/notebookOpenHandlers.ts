import { useMessagePortClient } from '@deta/services/messagePort'
import { isModKeyPressed } from '@deta/utils/io'
import type { OpenNotebookOptions, OpenResourceOptions, OpenTarget } from '@deta/types'

export const openResource = (resourceId: string, opts?: Partial<OpenResourceOptions>) => {
  const messagePort = useMessagePortClient()

  messagePort.openResource.send({
    resourceId: resourceId,
    target: 'tab',
    ...opts
  })
}

export const openNotebook = (notebookId: string, opts?: Partial<OpenNotebookOptions>) => {
  const messagePort = useMessagePortClient()

  messagePort.openNotebook.send({
    notebookId: notebookId,
    target: 'tab',
    ...opts
  })
}

export const determineClickOpenTarget = (e: MouseEvent): OpenTarget => {
  const backgroundTab = isModKeyPressed(e) && !e.shiftKey
  return backgroundTab ? 'background_tab' : isModKeyPressed(e) ? 'tab' : 'active_tab'
}

export const handleResourceClick = (resourceId: string, e: MouseEvent) => {
  const target = determineClickOpenTarget(e)
  openResource(resourceId, {
    target
  })
}

export const handleNotebookClick = (notebookId: string, e: MouseEvent) => {
  const target = determineClickOpenTarget(e)
  openNotebook(notebookId, {
    target
  })
}
