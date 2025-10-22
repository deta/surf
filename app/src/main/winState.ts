import { BrowserWindow, app } from 'electron'

import { useDebounce } from '@deta/utils/system'
import { getConfig, setConfig } from './config'

export interface State {
  /**
   * The current window width
   */
  width: number

  /**
   * The current window height
   */
  height: number

  /**
   * The current window x position
   */
  x?: number

  /**
   * The current window y position
   */
  y?: number

  /**
   * Indicates if the window is maximized
   */
  isMaximized?: boolean

  /**
   * Indicates if the window is in fullscreen
   */
  isFullScreen?: boolean
}

export type Options = {
  storePath: string
  storeName: string
  debounce: number
  saveImmediately: boolean
}

export class WindowState {
  opts: Options
  state: State
  win?: BrowserWindow

  constructor(opts: Partial<Options>, defaultState?: Partial<State>) {
    const defaultOptions = {
      storePath: app.getPath('userData'),
      storeName: 'winState.json',
      debounce: 500,
      saveImmediately: false
    }

    this.opts = Object.assign({}, defaultOptions, opts)
    this.state = this.getState(defaultState)
  }

  getState(defaultState: Partial<State> = {}) {
    const stored = getConfig<State>(this.opts.storePath, this.opts.storeName)
    return Object.assign(defaultState, stored) as State
  }

  saveState() {
    setConfig(this.opts.storePath, this.state, this.opts.storeName)
  }

  manage(win: BrowserWindow) {
    this.win = win

    this.win.on(
      'resize',
      useDebounce(() => this.changeHandler(), this.opts.debounce)
    )
    this.win.on(
      'move',
      useDebounce(() => this.changeHandler(), this.opts.debounce)
    )
    this.win.on('close', () => this.unmanage())
    this.win.on('closed', () => this.saveState())
  }

  unmanage() {
    if (this.win) {
      this.win.removeListener(
        'resize',
        useDebounce(() => this.changeHandler(), this.opts.debounce)
      )
      this.win.removeListener(
        'move',
        useDebounce(() => this.changeHandler(), this.opts.debounce)
      )
      this.win.removeListener('close', () => this.unmanage())
      this.win.removeListener('closed', () => this.saveState())
      this.win = undefined
    }
  }

  changeHandler() {
    try {
      if (!this.win) return

      const winBounds = this.win.getBounds()

      if (this.isNormal()) {
        this.state.x = winBounds.x
        this.state.y = winBounds.y
        this.state.width = winBounds.width
        this.state.height = winBounds.height
      }

      this.state.isMaximized = this.win.isMaximized()
      this.state.isFullScreen = this.win.isFullScreen()

      if (this.opts.saveImmediately) {
        this.saveState()
      }
    } catch (err) {
      // Don't throw an error when window was closed
    }
  }

  isNormal() {
    return !this.win?.isMaximized() && !this.win?.isMinimized() && !this.win?.isFullScreen()
  }
}
