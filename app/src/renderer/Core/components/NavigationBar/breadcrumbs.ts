import type { Fn } from '@deta/types'
import { get } from 'svelte/store'
import { isInternalRendererURL } from '@deta/utils/formatting'
import { type NotebookManager } from '@deta/services/notebooks'
import { type WebContentsView, ViewType } from '@deta/services/views'

interface BreadcrumbData {
  title: string
  url: string
  navigationIdx: number
  onclick?: Fn
}

async function getNotebookDisplayName(
  notebookManager: NotebookManager,
  notebookId: string
): Promise<string> {
  const notebook = await notebookManager.getNotebook(notebookId)
  return notebook.nameValue
}

export async function constructBreadcrumbs(
  notebookManager: NotebookManager,
  history: { url: string; title: string }[],
  currHistoryIndex: number,
  view: WebContentsView
): Promise<BreadcrumbData[]> {
  if (!history) return []
  history = history.map((e, i) => ({ ...e, uid: i }))
  const originalHistory = [...history]

  const breadcrumbs = []
  history = history.slice(0, currHistoryIndex + 1)

  // Replace all internal urls with parsed version
  history = history.map((entry) => {
    const internalURL = isInternalRendererURL(entry.url)
    if (!internalURL) return entry
    else
      return {
        ...entry,
        url: internalURL.toString()
      }
  })

  // We manually prepend surf root
  if (
    !history
      .map((e) => e.url)
      .find((e) => {
        const rendererURL = isInternalRendererURL(e)
        return (
          rendererURL && rendererURL.hostname === 'notebook' && rendererURL.pathname.length <= 1
        )
      })
  ) {
    history.unshift({
      url: new URL('surf://notebook').toString(),
      title: 'Surf'
    })
  }

  // Slice from last surf://notebook/ item
  history = history
    .slice(
      history.findLastIndex((e) => {
        const url = new URL(e.url)
        return url.hostname === 'notebook' && url.pathname.length <= 1
      })
    )
    .filter((e) => {
      const url = isInternalRendererURL(e.url)
      return url && url.hostname === 'notebook'
    })

  history = history.filter((item, i, arr) => arr.findIndex((obj) => obj.url === item.url) === i)

  history = history.slice(
    history.findLastIndex((e) => {
      const rendererURL = isInternalRendererURL(e.url)
      return rendererURL && rendererURL.pathname.length <= 1
    })
  )

  // breadcrumbs should only have one notebook slot
  let notebookSlot = null
  if (view.typeValue === ViewType.Resource) {
    const resourceId = view.typeDataValue?.id
    if (resourceId) {
      const resource = await notebookManager.resourceManager.getResource(resourceId)
      if (resource?.spaceIdsValue.length === 0) {
        notebookSlot = {
          url: new URL('surf://notebook/drafts').toString(),
          title: 'Drafts'
        }
      } else {
        const notebookId = resource?.spaceIdsValue[0]
        if (notebookId) {
          notebookSlot = {
            url: new URL(`surf://notebook/${notebookId}`).toString(),
            title: await getNotebookDisplayName(notebookManager, notebookId)
          }
        }
      }
    }
  }

  if (!notebookSlot) {
    const notebookEntry = history.find((item) => {
      const url = new URL(item.url)
      return (
        url.hostname === 'notebook' &&
        url.pathname.length > 1 &&
        !['drafts', 'history'].some((e) => url.pathname.startsWith(`/${e}`))
      )
    })

    if (notebookEntry) {
      const url = new URL(notebookEntry.url)
      const notebookId = url.pathname.slice(1) // remove leading slash

      notebookSlot = {
        url: notebookEntry.url,
        title: await getNotebookDisplayName(notebookManager, notebookId)
      }
    }
  }

  // remove any existing notebook/drafts items from history
  history = history.filter((item) => {
    const url = new URL(item.url)
    if (url.hostname !== 'notebook' || url.pathname.length <= 1) {
      return true
    }
    return false
  })

  if (notebookSlot) {
    history.push(notebookSlot)
  }

  for (const entry of history) {
    breadcrumbs.push({
      title: entry.title,
      url: entry.url,
      navigationIdx: originalHistory.findIndex((e) => e.uid === entry.uid)
    })
  }

  if (originalHistory.length === 0) return []
  if (originalHistory.length > 0) {
    if (isInternalRendererURL(originalHistory[currHistoryIndex]?.url)) {
      const _url = isInternalRendererURL(originalHistory[currHistoryIndex].url)
      const lastURL = new URL(breadcrumbs.at(-1).url)

      if (_url.href === lastURL.href) breadcrumbs.pop()
    }
  }

  return breadcrumbs
}
