import type { Fn } from '@deta/types'
import { getViewType, isInternalRendererURL, getViewTypeData } from '@deta/utils/formatting'
import { type NotebookManager } from '@deta/services/notebooks'
import { type WebContentsView, ViewType } from '@deta/services/views'
import { useLogScope } from '@deta/utils/io'

const log = useLogScope('Breadcrumbs')

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

async function getResourceName(
  notebookManager: NotebookManager,
  resourceId: string
): Promise<string> {
  const resource = await notebookManager.resourceManager.getResource(resourceId)
  return resource?.metadata?.name || 'Untitled'
}

export async function constructBreadcrumbs(
  notebookManager: NotebookManager,
  history: { url: string; title: string }[],
  currHistoryIndex: number,
  view: WebContentsView
): Promise<BreadcrumbData[]> {
  try {
    if (!history) return []

    const breadcrumbs: BreadcrumbData[] = []
    const currentHistory = history.slice(0, currHistoryIndex + 1)

    // Get the current view type and data
    const viewType = view.typeValue
    const viewData = view.typeDataValue

    log.debug('Constructing breadcrumbs for view type:', viewData, currentHistory)

    if (viewType === ViewType.NotebookHome) {
      log.debug('Final breadcrumbs:', breadcrumbs)
      return breadcrumbs
    } else {
      // Always start with Surf root
      breadcrumbs.push({
        title: 'Surf',
        url: new URL('surf://surf/notebook').toString(),
        navigationIdx: currentHistory.findIndex(
          (entry) => getViewType(entry.url) === ViewType.NotebookHome
        )
      })
    }

    // Handle based on current view type
    if (viewType === ViewType.Resource) {
      const resourceId = viewData?.id
      if (resourceId) {
        const resource = await notebookManager.resourceManager.getResource(resourceId)
        if (resource) {
          // Add notebook/drafts breadcrumb
          if (resource.spaceIdsValue.length === 0) {
            breadcrumbs.push({
              title: 'Drafts',
              url: new URL('surf://surf/notebook/drafts').toString(),
              navigationIdx: currentHistory.findIndex((entry) =>
                entry.url.includes('/notebook/drafts')
              )
            })
          } else {
            const notebookId = resource.spaceIdsValue[0]
            const notebookName = await getNotebookDisplayName(notebookManager, notebookId)
            breadcrumbs.push({
              title: notebookName,
              url: new URL(`surf://surf/notebook/${notebookId}`).toString(),
              navigationIdx: currentHistory.findIndex((entry) =>
                entry.url.includes(`/notebook/${notebookId}`)
              )
            })
          }

          // Add resource breadcrumb
          // breadcrumbs.push({
          //   title: resource.metadata?.name || 'Untitled',
          //   url: new URL(`surf://surf/resource/${resourceId}`).toString(),
          //   navigationIdx: currentHistory.findIndex(entry => entry.url.includes(`/resource/${resourceId}`))
          // })
        }
      }
      // } else if (viewType === ViewType.Notebook) {
      //   const notebookId = viewData?.id
      //   if (notebookId) {
      //     if (notebookId === 'drafts') {
      //       breadcrumbs.push({
      //         title: 'Drafts',
      //         url: new URL('surf://surf/notebook/drafts').toString(),
      //         navigationIdx: currentHistory.findIndex(entry => entry.url.includes('/notebook/drafts'))
      //       })
      //     } else {
      //       const notebookName = await getNotebookDisplayName(notebookManager, notebookId)
      //       breadcrumbs.push({
      //         title: notebookName,
      //         url: new URL(`surf://surf/notebook/${notebookId}`).toString(),
      //         navigationIdx: currentHistory.findIndex(entry => entry.url.includes(`/notebook/${notebookId}`))
      //       })
      //     }
      //   }
    } else if (viewType === ViewType.Page) {
      // For web pages, check if we're in a notebook context
      const lastNotebookEntry = currentHistory.findLast((entry) => {
        const type = getViewType(entry.url)
        return type === ViewType.Notebook || type === ViewType.NotebookHome
      })

      if (lastNotebookEntry) {
        const viewTypeData = getViewTypeData(lastNotebookEntry.url)
        if (viewTypeData.type === ViewType.Notebook) {
          if (viewTypeData.id === 'drafts') {
            breadcrumbs.push({
              title: 'Drafts',
              url: lastNotebookEntry.url,
              navigationIdx: currentHistory.findIndex(
                (entry) => entry.url === lastNotebookEntry.url
              )
            })
          } else if (viewTypeData.id) {
            const notebookName = await getNotebookDisplayName(notebookManager, viewTypeData.id)
            breadcrumbs.push({
              title: notebookName,
              url: lastNotebookEntry.url,
              navigationIdx: currentHistory.findIndex(
                (entry) => entry.url === lastNotebookEntry.url
              )
            })
          }
        }
      }

      // Add the page title as the last breadcrumb
      // breadcrumbs.push({
      //   title: view.titleValue || 'Untitled Page',
      //   url: view.urlValue,
      //   navigationIdx: currHistoryIndex
      // })
    }

    log.debug('Final breadcrumbs:', breadcrumbs)
    return breadcrumbs
  } catch (err) {
    console.error('Error constructing breadcrumbs:', err)
    return []
  }
}
