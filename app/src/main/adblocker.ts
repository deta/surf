/**
 * 广告拦截器模块
 * 负责初始化、配置和管理应用程序中的广告拦截功能
 */
import { ElectronBlocker } from '@ghostery/adblocker-electron'
import fetch from 'cross-fetch'
import { session } from 'electron'
import { changeMenuItemLabel } from './appMenu'
import { getUserConfig, updateUserConfigSettings } from './config'
import { ipcSenders } from './ipcHandlers'
import { getWebRequestManager } from './webRequestManager'

/**
 * 广告拦截器实例
 */
let blocker: ElectronBlocker | null = null

/**
 * 用于移除beforeRequest监听器的函数引用
 */
let removeBeforeRequest: (() => void) | null = null

/**
 * 用于移除headersReceived监听器的函数引用
 */
let removeHeadersReceived: (() => void) | null = null

/**
 * 初始化广告拦截器
 * 从预构建的广告过滤规则创建ElectronBlocker实例
 * @returns {Promise<void>}
 */
export async function setupAdblocker() {
  // 注释掉的代码使用缓存机制，但可能导致问题
  // blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch, {
  //   path: join(app.getPath('userData'), 'adblocker.bin'),
  //   read: fs.readFile,
  //   write: fs.writeFile
  // })
  // TODO: caching might be the cause
  // 直接从预构建的广告规则创建拦截器
  blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch)
}

/**
 * 为特定会话分区初始化广告拦截器
 * 从用户配置中读取广告拦截器的初始状态并应用
 * @param {string} partition - Electron会话分区名称
 */
export function initAdblocker(partition: string) {
  if (!blocker) return

  // 获取初始状态
  const config = getUserConfig()
  const isEnabled = config.settings.adblockerEnabled ?? false

  setAdblockerState(partition, isEnabled)
}

/**
 * 设置广告拦截器的启用/禁用状态
 * @param {string} partition - Electron会话分区名称
 * @param {boolean} state - 广告拦截器的目标状态 (true=启用, false=禁用)
 */
export function setAdblockerState(partition: string, state: boolean): void {
  if (!blocker) return

  const webRequestManager = getWebRequestManager()
  const targetSession = session.fromPartition(partition)

  if (state) {
    // 启用广告拦截器
    if (!blocker.isBlockingEnabled(targetSession)) {
      // 在目标会话中启用广告拦截
      blocker.enableBlockingInSession(targetSession, false)
      // 添加请求拦截监听器
      removeBeforeRequest = webRequestManager.addBeforeRequest(
        targetSession,
        blocker.onBeforeRequest
      )
      // 添加响应头拦截监听器
      removeHeadersReceived = webRequestManager.addHeadersReceived(
        targetSession,
        blocker.onHeadersReceived
      )
    }
  } else {
    // 禁用广告拦截器
    if (blocker.isBlockingEnabled(targetSession)) {
      // 在目标会话中禁用广告拦截
      blocker.disableBlockingInSession(targetSession)
      // 移除之前添加的监听器
      if (removeBeforeRequest) removeBeforeRequest()
      if (removeHeadersReceived) removeHeadersReceived()
      // 清空引用
      removeBeforeRequest = null
      removeHeadersReceived = null
    }
  }

  // 保存状态到用户配置
  updateUserConfigSettings({ adblockerEnabled: state })

  // 通知渲染进程状态变化
  ipcSenders.adBlockChanged(partition, state)

  // 修改菜单项状态
  changeMenuItemLabel('adblocker', state ? 'Disable Adblocker' : 'Enable Adblocker')
}

/**
 * 获取广告拦截器的当前状态
 * 如果配置与实际状态不一致，会自动同步
 * @param {string} partition - Electron会话分区名称
 * @returns {boolean} - 广告拦截器的当前状态
 */
export function getAdblockerState(partition: string): boolean {
  if (!blocker) return false

  // 获取当前会话中的实际拦截状态
  const isEnabled = blocker.isBlockingEnabled(session.fromPartition(partition))

  // 获取配置中存储的状态
  const config = getUserConfig()
  const stored = config.settings.adblockerEnabled ?? false

  // 如果状态不一致，同步状态
  if (stored !== isEnabled) {
    setAdblockerState(partition, isEnabled)
  }

  return isEnabled
}

/**
 * 切换广告拦截器的状态
 * @param {string} partition - Electron会话分区名称
 * @returns {boolean} - 切换后的新状态
 */
export function toggleAdblocker(partition: string): boolean {
  // 获取当前状态
  const isEnabled = getAdblockerState(partition)
  // 计算新状态
  const newState = !isEnabled

  // 应用新状态
  setAdblockerState(partition, newState)

  return newState
}

/**
 * 获取广告拦截器实例
 * @returns {ElectronBlocker | null} - 广告拦截器实例或null
 */
export function getAdblocker(): ElectronBlocker | null {
  return blocker
}
