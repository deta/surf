import type { Fn } from '@deta/types'
import { getViewType, getViewTypeData } from '@deta/utils/formatting'
import { type NotebookManager } from '@deta/services/notebooks'
import { type WebContentsView, ViewType } from '@deta/services/views'
import { useLogScope } from '@deta/utils/io'
import { wait } from '@deta/utils'

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

export async function constructBreadcrumbs(
  notebookManager: NotebookManager,
  history: { url: string; title: string }[],
  currHistoryIndex: number,
  view: WebContentsView,
  extractedResourceId: string | null,
  resourceCreatedByUser: boolean
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
        }
      }
    } else if (viewType === ViewType.Page) {
      const savedByUser = extractedResourceId && resourceCreatedByUser
      if (savedByUser) {
        // HACK: we need a small delay to ensure the resource spaceIds list is updated
        await wait(200)

        const resource = await notebookManager.resourceManager.getResource(extractedResourceId)

        const spaceIds = resource?.spaceIdsValue || []

        const lastNotebookEntry = currentHistory.findLast((entry) => {
          const type = getViewType(entry.url)
          return type === ViewType.Notebook
        })

        const viewTypeData = lastNotebookEntry && getViewTypeData(lastNotebookEntry.url)
        if (lastNotebookEntry && spaceIds.length > 0 && spaceIds.includes(viewTypeData?.id)) {
          const notebookName = await getNotebookDisplayName(notebookManager, viewTypeData.id)
          breadcrumbs.push({
            title: notebookName,
            url: lastNotebookEntry.url,
            navigationIdx: currentHistory.findIndex((entry) => entry.url === lastNotebookEntry.url)
          })
        } else if (spaceIds.length === 1) {
          const notebookId = spaceIds[0]
          const notebookName = await getNotebookDisplayName(notebookManager, notebookId)
          breadcrumbs.push({
            title: notebookName,
            url: new URL(`surf://surf/notebook/${notebookId}`).toString(),
            navigationIdx: currentHistory.findIndex((entry) =>
              entry.url.includes(`/notebook/${notebookId}`)
            )
          })
        } else if (spaceIds.length === 0) {
          breadcrumbs.push({
            title: 'Drafts',
            url: 'surf://surf/notebook/drafts',
            navigationIdx: currentHistory.findIndex(
              (entry) => entry.url === 'surf://surf/notebook/drafts'
            )
          })
        }
      }
    }

    log.debug('Final breadcrumbs:', breadcrumbs)
    return breadcrumbs
  } catch (err) {
    console.error('Error constructing breadcrumbs:', err)
    return []
  }
}
