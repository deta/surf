// 导入必要的模块
import { app, Menu, shell } from 'electron'
import { isMac, isWindows, isLinux } from '@deta/utils/system'
import { ipcSenders } from './ipcHandlers' // IPC通信发送器，用于进程间通信
import { toggleAdblocker } from './adblocker' // 广告拦截器切换函数
import { join } from 'path' // 路径处理
import { createSettingsWindow } from './settingsWindow' // 设置窗口创建函数
import { updateUserConfig, getUserConfig } from './config' // 用户配置管理
import { execFile } from 'child_process' // 子进程执行
import { promisify } from 'util' // 用于将回调函数转换为Promise
import { importFiles } from './importer' // 文件导入功能
import { useLogScope } from '@deta/utils' // 日志作用域

// 创建日志实例
const log = useLogScope('Main App Menu')
// 将execFile转换为Promise形式
const execFileAsync = promisify(execFile)

// 全局应用菜单实例
let appMenu: AppMenu | null = null

/**
 * 菜单配置接口
 * 定义了Electron应用菜单的配置项结构
 */
interface MenuConfig {
  id?: string // 菜单项唯一标识符
  label?: string // 菜单项显示文本
  role?: string // 菜单项角色（使用Electron内置功能）
  type?: 'separator' | 'submenu' | 'checkbox' | 'radio' | undefined // 菜单项类型
  accelerator?: string // 快捷键组合
  click?: () => void // 点击事件处理函数
  submenu?: MenuConfig[] // 子菜单配置
  checked?: boolean // 复选框状态（选中/未选中）
}

/**
 * 应用菜单类
 * 负责创建和管理Breakwind应用的菜单栏
 */
class AppMenu {
  private menu: Electron.Menu | null = null // Electron菜单实例
  private template: MenuConfig[] = [] // 菜单配置模板

  /**
   * 构造函数
   * 初始化菜单模板
   */
  constructor() {
    this.initializeTemplate()
  }

  /**
   * 初始化菜单模板
   * 创建所有主要菜单（应用菜单、文件菜单、编辑菜单等）
   */
  private initializeTemplate(): void {
    this.template = [
      this.getSurfMenu(), // 应用主菜单（Mac上为应用名菜单）
      this.getFileMenu(), // 文件菜单
      this.getEditMenu(), // 编辑菜单
      this.getViewMenu(), // 视图菜单
      this.getNavigateMenu(), // 导航菜单
      this.getWindowMenu(), // 窗口菜单
      this.getToolsMenu() // 工具菜单
      // this.getHelpMenu()    // 帮助菜单（目前注释掉）
    ]
  }

  /**
   * 构建应用菜单
   * 设置初始复选框状态并将菜单模板转换为Electron菜单实例
   */
  public buildMenu(): void {
    // 根据用户配置设置初始复选框状态
    this.updateCheckboxStates()
    // 从模板构建菜单
    this.menu = Menu.buildFromTemplate(this.template as any)
    // 设置为应用程序菜单
    Menu.setApplicationMenu(this.menu)
  }

  /**
   * 更新复选框菜单项状态
   * 从用户配置中读取标签方向设置并更新相应菜单项的选中状态
   */
  private updateCheckboxStates(): void {
    // 获取用户配置
    const userConfig = getUserConfig()
    // 检查标签是否为水平方向（这里注意：变量名与实际逻辑可能存在不一致）
    const isVertical = userConfig.settings.tabs_orientation === 'horizontal'

    // 更新"Show Tabs in Sidebar"菜单项的选中状态
    for (const menuItem of this.template) {
      if (menuItem.submenu) {
        const tabsMenuItem = menuItem.submenu.find((item) => item.id === 'showTabsInSidebar')
        if (tabsMenuItem) {
          tabsMenuItem.checked = isVertical // 设置选中状态
          break
        }
      }
    }
  }

  /**
   * 更新菜单项标签文本
   * @param id 要更新的菜单项ID
   * @param newLabel 新的标签文本
   */
  public updateMenuItem(id: string, newLabel: string): void {
    for (const menuItem of this.template) {
      if (menuItem.submenu) {
        const item = menuItem.submenu.find((item) => item.id === id)
        if (item) {
          item.label = newLabel // 更新标签文本
          break
        }
      }
    }
    // 重新构建菜单以应用更改
    this.buildMenu()
  }

  /**
   * 更新标签方向菜单项
   * 根据用户配置更新标签方向相关菜单项的状态
   */
  public updateTabOrientationMenuItem(): void {
    // 获取用户配置
    const userConfig = getUserConfig()
    // 检查标签是否为水平方向
    const isVertical = userConfig.settings.tabs_orientation === 'horizontal'

    // 更新"Show Tabs in Sidebar"菜单项的选中状态
    for (const menuItem of this.template) {
      if (menuItem.submenu) {
        const tabsMenuItem = menuItem.submenu.find((item) => item.id === 'showTabsInSidebar')
        if (tabsMenuItem) {
          tabsMenuItem.checked = isVertical // 设置选中状态
          break
        }
      }
    }
    // 重新构建菜单以应用更改
    this.buildMenu()
  }

  /**
   * 获取菜单实例
   * @returns Electron菜单实例或null
   */
  public getMenu(): Electron.Menu | null {
    return this.menu
  }

  /**
   * 创建数据位置菜单项
   * 根据操作系统创建显示应用数据文件夹的菜单项
   * @returns 数据位置菜单项配置
   */
  private createDataLocationMenuItem(): MenuConfig {
    // 获取用户数据路径
    const userDataPath = app.getPath('userData')
    // Breakwind数据文件夹路径
    const surfDataPath = join(userDataPath, 'sffs_backend')
    // 根据操作系统生成不同的标签文本
    const label = isMac() ? '在访达中显示 Breakwind 数据' : '在文件管理器中显示 Breakwind 数据'

    return {
      label,
      click: () => shell.openPath(surfDataPath) // 点击时打开数据文件夹
    }
  }

  /**
   * 获取应用主菜单（Surf菜单）
   * @param isMacApp 是否为Mac应用（默认为检测结果）
   * @returns 应用主菜单配置
   */
  private getSurfMenu(isMacApp = isMac()): MenuConfig {
    // 构建菜单选项
    const surfItems = [
      // Mac系统特有菜单项
      ...(isMacApp
        ? ([{ label: 'About Breakwind', role: 'about' }, { type: 'separator' }] as MenuConfig[])
        : []),
      // 偏好设置菜单项
      {
        label: 'Preferences',
        accelerator: 'CmdOrCtrl+,',
        click: () => createSettingsWindow()
      },
      { type: 'separator' },
      // 数据位置菜单项
      this.createDataLocationMenuItem(),
      // 邀请好友菜单项（目前注释掉）
      // {
      //   label: 'Invite Friends',
      //   click: () => ipcSenders.openInvitePage()
      // },
      // Mac系统特有菜单项（隐藏相关）
      ...(isMacApp
        ? [
            { type: 'separator' },
            { role: 'services', label: 'Services' },
            { type: 'separator' },
            {
              label: 'Hide Breakwind',
              accelerator: 'CmdOrCtrl+H',
              role: 'hide'
            },
            {
              label: 'Hide Others',
              accelerator: 'CmdOrCtrl+Shift+H',
              role: 'hideOthers'
            },
            { label: 'Show All', role: 'unhide' }
          ]
        : []),
      { type: 'separator' },
      // 退出应用菜单项
      { label: 'Quit Breakwind', role: 'quit' }
    ]

    return {
      label: isMacApp ? app.name : 'Breakwind', // Mac上显示应用名，其他系统显示"Breakwind"
      submenu: surfItems as MenuConfig[]
    }
  }

  /**
   * 获取文件菜单
   * @returns 文件菜单配置
   */
  private getFileMenu(): MenuConfig {
    return {
      label: 'File',
      submenu: [
        // Mac系统特有菜单项（关闭窗口）
        ...(isMac() ? ([{ role: 'close', accelerator: 'CmdOrCtrl+Shift+W' }] as MenuConfig[]) : []),
        // 新建标签页
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => ipcSenders.createNewTab()
        },
        // 关闭标签页
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => ipcSenders.closeActiveTab()
        },
        { type: 'separator' },
        // 截图功能（目前注释掉）
        // {
        //   label: 'Take Screenshot',
        //   accelerator: 'CmdOrCtrl+Shift+1',
        //   click: () => ipcSenders.startScreenshotPicker()
        // },
        // 导入文件
        {
          id: 'importFiles',
          label: 'Import Files',
          click: () => importFiles()
        },
        // 导入书签和历史记录（目前注释掉）
        // {
        //   id: 'openImporter',
        //   label: 'Import Bookmarks and History',
        //   click: () => {
        //     ipcSenders.openImporter()
        //   }
        // },
        // Windows和Linux系统特有（退出应用）
        ...(isMac() ? [] : [{ type: 'separator' }, { role: 'quit' }])
      ] as MenuConfig[]
    }
  }

  /**
   * 获取编辑菜单
   * @returns 编辑菜单配置
   */
  private getEditMenu(): MenuConfig {
    return {
      label: 'Edit',
      submenu: [
        { role: 'cut' }, // 剪切
        { role: 'copy' }, // 复制
        { role: 'paste' }, // 粘贴
        { role: 'delete' }, // 删除
        { role: 'selectAll' }, // 全选
        { type: 'separator' },
        // 复制URL
        {
          label: 'Copy URL',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => ipcSenders.copyActiveTabURL()
        }
      ]
    }
  }

  /**
   * 获取视图菜单
   * @returns 视图菜单配置
   */
  private getViewMenu(): MenuConfig {
    return {
      label: 'View',
      submenu: [
        // 在侧边栏显示标签页（复选框菜单项）
        {
          id: 'showTabsInSidebar',
          label: 'Show Tabs in Sidebar',
          type: 'checkbox',
          accelerator: 'CmdOrCtrl+O',
          click: () => ipcSenders.toggleTabsPosition()
        },
        { type: 'separator' },
        // 全屏切换
        { role: 'togglefullscreen' },
        // 开发者工具切换
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac() ? 'Cmd+Option+I' : 'Ctrl+Shift+I',
          click: () => ipcSenders.openDevTools()
        }
      ]
    }
  }

  /**
   * 获取导航菜单
   * @returns 导航菜单配置
   */
  private getNavigateMenu(): MenuConfig {
    return {
      label: 'Navigate',
      submenu: [
        // 我的内容（目前注释掉）
        // {
        //   label: 'My Stuff',
        //   accelerator: 'CmdOrCtrl+O',
        //   click: () => ipcSenders.openOasis()
        // },
        // 浏览历史（目前注释掉）
        // {
        //   label: 'Browsing History',
        //   accelerator: 'CmdOrCtrl+Y',
        //   click: () => ipcSenders.openHistory()
        // },
        // { type: 'separator' },
        // 重新加载标签页
        {
          label: 'Reload Tab',
          accelerator: 'CmdOrCtrl+R',
          click: () => ipcSenders.reloadActiveTab()
        },
        // 强制重新加载标签页
        {
          label: 'Force Reload Tab',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => ipcSenders.reloadActiveTab(true)
        }
      ]
    }
  }

  /**
   * 获取工具菜单
   * @returns 工具菜单配置
   */
  private getToolsMenu(): MenuConfig {
    return {
      label: 'Tools',
      submenu: [
        // 广告拦截器（初始标签会在启动时根据存储状态自动更新）
        {
          id: 'adblocker',
          label: 'Enable Adblocker',
          click: () => toggleAdblocker('persist:horizon')
        },
        { type: 'separator' },
        // 重新加载应用
        {
          label: 'Reload App',
          role: 'reload',
          accelerator: 'CmdOrCtrl+Alt+R'
        },
        // 强制重新加载应用
        {
          label: 'Force Reload App',
          role: 'forceReload',
          accelerator: 'CmdOrCtrl+Alt+Shift+R'
        },
        // Breakwind开发者工具切换
        {
          label: 'Toggle Developer Tools for Breakwind',
          accelerator: isMac() ? 'Cmd+Shift+I' : 'Option+Shift+I',
          role: 'toggleDevTools'
        }
      ]
    }
  }

  /**
   * 获取窗口菜单
   * @returns 窗口菜单配置
   */
  private getWindowMenu(): MenuConfig {
    return {
      label: 'Window',
      submenu: [
        { role: 'minimize' }, // 最小化
        { role: 'zoom' }, // 缩放/还原
        // Mac系统特有菜单项
        ...(isMac()
          ? ([
              { type: 'separator' },
              { role: 'front' }, // 前置
              { type: 'separator' },
              { role: 'window' } // 窗口菜单
            ] as MenuConfig[])
          : [{ role: 'close' }]) // Windows和Linux系统：关闭窗口
      ]
    }
  }

  /**
   * 获取帮助菜单（目前未使用）
   * @returns 帮助菜单配置
   */
  private getHelpMenu(): MenuConfig {
    return {
      label: 'Help',
      submenu: [
        // 打开速查表
        {
          label: 'Open Cheat Sheet',
          click: () => ipcSenders.openCheatSheet(),
          accelerator: 'F1'
        },
        // 打开更新日志
        {
          label: 'Open Changelog',
          click: () => ipcSenders.openChangelog()
        },
        /* TODO: 欢迎页面准备就绪且没有bug后重新启用
        {
          label: 'Open Welcome Page',
          click: () => ipcSenders.openWelcomePage()
        },
        */
        { type: 'separator' },
        // 提供反馈
        {
          label: 'Give Feedback',
          click: () => ipcSenders.openFeedbackPage(),
          accelerator: 'CmdOrCtrl+Shift+H'
        },
        // 键盘快捷键
        {
          label: 'Keyboard Shortcuts',
          click: () => ipcSenders.openShortcutsPage()
        }
      ]
    }
  }
}

/**
 * 获取应用菜单
 * @returns Electron菜单实例或null
 */
export const getAppMenu = (): Electron.Menu | null => {
  if (!appMenu) return null
  return appMenu.getMenu()
}

/**
 * 设置应用菜单
 * 初始化并构建应用的菜单栏
 */
export const setAppMenu = (): void => {
  appMenu = new AppMenu()
  appMenu.buildMenu()
}

/**
 * 修改菜单项标签文本
 * @param id 要更新的菜单项ID
 * @param newLabel 新的标签文本
 */
export const changeMenuItemLabel = (id: string, newLabel: string): void => {
  appMenu?.updateMenuItem(id, newLabel)
}

/**
 * 更新标签方向菜单项
 * 在标签方向设置更改时调用
 */
export const updateTabOrientationMenuItem = (): void => {
  appMenu?.updateTabOrientationMenuItem()
}

/**
 * 带有超时的变更检测函数
 * @param checkFn 检查函数，返回Promise<boolean>
 * @param interval 检查间隔（毫秒）
 * @param timeout 最大超时时间（毫秒）
 * @returns 如果在超时前检测到变更则返回true，否则返回false
 */
const checkForChangeWithTimeout = async (
  checkFn: () => Promise<boolean>,
  interval: number,
  timeout: number
): Promise<boolean> => {
  return new Promise(async (resolve) => {
    let elapsed = 0
    // 获取初始检查结果
    const initialResult = await checkFn()

    // 设置定期检查的定时器
    const intervalId = setInterval(async () => {
      elapsed += interval
      // 获取当前检查结果
      const currentResult = await checkFn()

      // 如果结果发生变化或已超时，则清除定时器并返回结果
      if (currentResult !== initialResult || elapsed >= timeout) {
        clearInterval(intervalId)
        resolve(currentResult !== initialResult)
      }
    }, interval)
  })
}
