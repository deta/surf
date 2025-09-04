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

export async function constructBreadcrumbs(
  notebookManager: NotebookManager,
  history: { url: string; title: string }[],
  currHisotryIndex: number,
  view: WebContentsView
): Promise<BreadcrumbData[]> {
  if (!history) return []
  history = history.map((e, i) => ({ ...e, uid: i }))
  const originalHistory = [...history]

  const breadcrumbs = []
  history = history.slice(0, currHisotryIndex + 1)

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

  const hasDraftsItem = history.some((item) => item.url === 'surf://notebook/drafts')
  if (!hasDraftsItem && view.typeValue === ViewType.Resource) {
    const resourceId = view.typeDataValue.id
    if (resourceId) {
      const resource = await notebookManager.resourceManager.getResource(resourceId)
      if (resource?.spaceIdsValue.length === 0) {
        history.push({
          url: new URL('surf://notebook/drafts').toString(),
          title: 'Drafts'
        })
      }
    }
  }

  for (const entry of history) {
    const _url = new URL(entry.url)
    let title = entry.title
    if (
      _url.hostname === 'notebook' &&
      _url.pathname.length > 1 &&
      !['drafts', 'history'].map((e) => _url.pathname.startsWith(`/${e}`))
    ) {
      // Extract notebook name
      const notebookData = get((await notebookManager.getNotebook(_url.pathname.slice(1))).data)
      title =
        (notebookData.emoji ? notebookData.emoji + ' ' : '') + notebookData.folderName ??
        notebookData.name
    }

    breadcrumbs.push({
      title,
      url: entry.url,
      navigationIdx: originalHistory.findIndex((e) => e.uid === entry.uid)
    })
  }

  if (originalHistory.length === 0) return []
  if (originalHistory.length > 0) {
    if (isInternalRendererURL(originalHistory[currHisotryIndex]?.url)) {
      const _url = isInternalRendererURL(originalHistory[currHisotryIndex].url)
      const lastURL = new URL(breadcrumbs.at(-1).url)

      if (_url.href === lastURL.href) breadcrumbs.pop()
    }
  }

  return breadcrumbs
}
