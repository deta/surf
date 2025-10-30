// 导入类型定义：函数类型
import type { Fn } from '@deta/types'
// 导入视图类型处理工具
import { getViewType, getViewTypeData } from '@deta/utils/formatting'
// 导入笔记本管理器类型
import { type NotebookManager } from '@deta/services/notebooks'
// 导入视图相关类型
import { type WebContentsView, ViewType } from '@deta/services/views'
// 导入日志工具
import { useLogScope } from '@deta/utils/io'
// 导入等待工具函数
import { wait } from '@deta/utils'

// 初始化日志记录器，作用域为 'Breadcrumbs'
const log = useLogScope('Breadcrumbs')

/**
 * 面包屑数据接口
 */
interface BreadcrumbData {
  title: string // 面包屑标题
  url: string // 面包屑对应的 URL
  navigationIdx: number // 在导航历史中的索引位置
  onclick?: Fn // 可选的点击事件处理函数
}

/**
 * 获取笔记本的显示名称
 * @param notebookManager 笔记本管理器实例
 * @param notebookId 笔记本 ID
 * @returns 笔记本名称
 */
async function getNotebookDisplayName(
  notebookManager: NotebookManager,
  notebookId: string
): Promise<string> {
  // 通过笔记本管理器获取笔记本信息
  const notebook = await notebookManager.getNotebook(notebookId)
  // 返回笔记本名称
  return notebook.nameValue
}

/**
 * 构建面包屑导航数据
 * 根据当前视图类型和历史记录生成导航路径
 * @param notebookManager 笔记本管理器实例
 * @param history 浏览历史记录数组
 * @param currHistoryIndex 当前历史记录索引
 * @param view 当前视图实例
 * @param extractedResourceId 提取的资源 ID
 * @param resourceCreatedByUser 资源是否由用户创建
 * @returns 面包屑数据数组
 */
export async function constructBreadcrumbs(
  notebookManager: NotebookManager,
  history: { url: string; title: string }[],
  currHistoryIndex: number,
  view: WebContentsView,
  extractedResourceId: string | null,
  resourceCreatedByUser: boolean
): Promise<BreadcrumbData[]> {
  try {
    // 参数校验：如果没有历史记录，返回空数组
    if (!history) return []

    // 初始化面包屑数组和当前历史记录
    const breadcrumbs: BreadcrumbData[] = []
    // 获取从开始到当前索引的历史记录片段
    const currentHistory = history.slice(0, currHistoryIndex + 1)

    // 获取当前视图类型和数据
    const viewType = view.typeValue
    const viewData = view.typeDataValue

    log.debug('Constructing breadcrumbs for view type:', viewData, currentHistory)

    // 处理笔记本主页的情况
    if (viewType === ViewType.NotebookHome) {
      log.debug('Final breadcrumbs:', breadcrumbs)
      return breadcrumbs
    } else {
      // 其他视图类型：始终以 Breakwind 根目录开始
      breadcrumbs.push({
        title: 'Breakwind', // 应用名称
        url: new URL('surf://surf/notebook').toString(), // 笔记本主页 URL
        navigationIdx: currentHistory.findIndex(
          (entry) => getViewType(entry.url) === ViewType.NotebookHome
        ) // 在历史记录中的索引位置
      })
    }

    // 根据视图类型处理不同的面包屑逻辑
    if (viewType === ViewType.Resource) {
      // 处理资源视图
      const resourceId = viewData?.id
      if (resourceId) {
        // 获取资源信息
        const resource = await notebookManager.resourceManager.getResource(resourceId)
        if (resource) {
          // 根据资源所属的空间添加笔记本或草稿面包屑
          if (resource.spaceIdsValue.length === 0) {
            // 草稿资源：添加草稿面包屑
            breadcrumbs.push({
              title: 'Drafts',
              url: new URL('surf://surf/notebook/drafts').toString(),
              navigationIdx: currentHistory.findIndex((entry) =>
                entry.url.includes('/notebook/drafts')
              )
            })
          } else {
            // 笔记本中的资源：添加对应笔记本的面包屑
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
      // 处理页面视图
      const savedByUser = extractedResourceId && resourceCreatedByUser
      if (savedByUser) {
        // 临时解决方案：添加延迟确保资源空间 ID 列表已更新
        await wait(200)

        // 获取资源信息
        const resource = await notebookManager.resourceManager.getResource(extractedResourceId)
        // 获取资源所属的空间 ID 列表
        const spaceIds = resource?.spaceIdsValue || []

        // 查找历史记录中最后一个笔记本条目
        const lastNotebookEntry = currentHistory.findLast((entry) => {
          const type = getViewType(entry.url)
          return type === ViewType.Notebook
        })

        // 获取最后一个笔记本条目的类型数据
        const viewTypeData = lastNotebookEntry && getViewTypeData(lastNotebookEntry.url)

        // 逻辑分支1：如果最后一个笔记本在资源的空间列表中
        if (lastNotebookEntry && spaceIds.length > 0 && spaceIds.includes(viewTypeData?.id)) {
          const notebookName = await getNotebookDisplayName(notebookManager, viewTypeData.id)
          breadcrumbs.push({
            title: notebookName,
            url: lastNotebookEntry.url,
            navigationIdx: currentHistory.findIndex((entry) => entry.url === lastNotebookEntry.url)
          })
        }
        // 逻辑分支2：资源只属于一个笔记本
        else if (spaceIds.length === 1) {
          const notebookId = spaceIds[0]
          const notebookName = await getNotebookDisplayName(notebookManager, notebookId)
          breadcrumbs.push({
            title: notebookName,
            url: new URL(`surf://surf/notebook/${notebookId}`).toString(),
            navigationIdx: currentHistory.findIndex((entry) =>
              entry.url.includes(`/notebook/${notebookId}`)
            )
          })
        }
        // 逻辑分支3：资源不属于任何笔记本（草稿）
        else if (spaceIds.length === 0) {
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
    // 错误处理：记录错误并返回空数组
    console.error('Error constructing breadcrumbs:', err)
    return []
  }
}
