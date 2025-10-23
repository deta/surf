import { useMessagePortClient } from '@deta/services/messagePort'
import { isModKeyPressed } from '@deta/utils/io'
import type { OpenNotebookOptions, OpenResourceOptions, OpenTarget } from '@deta/types'

export const openResource = (resourceId: string, opts?: Partial<OpenResourceOptions>) => {
  const messagePort = useMessagePortClient()

  try {
    const result = messagePort.openResource.send({
      resourceId: resourceId,
      target: 'tab',
      ...opts
    })
  } catch (error) {}
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
  if (e.type === 'auxclick') {
    if (e.button === 1) {
      e.preventDefault()
      e.stopPropagation()

      return 'background_tab'
    }

    return 'auto'
  }

  const backgroundTab = isModKeyPressed(e) && !e.shiftKey
  const sidebarTab = e.shiftKey
  return backgroundTab
    ? 'background_tab'
    : isModKeyPressed(e)
      ? 'tab'
      : sidebarTab
        ? 'sidebar'
        : 'auto'
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
