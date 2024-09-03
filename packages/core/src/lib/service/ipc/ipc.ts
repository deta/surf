import { ipcMain, ipcRenderer } from 'electron'
import { isRenderer } from './utils'

export type IPCServiceType = 'main' | 'renderer'

export interface IPCEvent {
  payload: any
  output?: any
}

type HandleHandler<T extends IPCEvent> = (
  event: Electron.IpcMainInvokeEvent,
  payload: T['payload']
) => T['output'] | null | Promise<T['output'] | null>

export class IPCService {
  addEvent<T>(name: string) {
    return {
      renderer: {
        on: (handler: (event: Electron.IpcRendererEvent, payload: T) => void) => {
          ipcRenderer.on(name, handler)
        },
        send: (payload: T) => {
          const mainProcess = !isRenderer()
          if (mainProcess) {
            throw new Error('Cannot send events in main process')
          } else {
            ipcRenderer.send(name, payload)
          }
        }
      },
      main: {
        on: (handler: (event: Electron.IpcMainEvent, payload: T) => void) => {
          ipcMain.on(name, handler)
        },
        once: (handler: (event: Electron.IpcMainEvent, payload: T) => void) => {
          ipcMain.once(name, handler)
        },
        sendToWebContents: (webContents: Electron.WebContents, payload: T) => {
          const mainProcess = !isRenderer()
          if (mainProcess) {
            webContents.send(name, payload)
          } else {
            throw new Error('Cannot send events to web contents in renderer process')
          }
        }
      }
    }
  }

  addEventWithReturn<T extends IPCEvent>(name: string) {
    return {
      renderer: {
        invoke: (payload: T['payload']) => {
          const mainProcess = !isRenderer()
          if (mainProcess) {
            throw new Error('Cannot invoke events in main process')
          } else {
            return ipcRenderer.invoke(name, payload) as Promise<T['output'] | null>
          }
        }
      },
      main: {
        handle: (handler: HandleHandler<T>) => {
          const mainProcess = !isRenderer()
          if (mainProcess) {
            ipcMain.handle(name, handler)
            return
          } else {
            throw new Error('Cannot handle events in renderer process')
          }
        }
      }
    }
  }

  registerEvents<T extends { [key: string]: any }>(events: T) {
    // only return the renderer event methods TODO: not working yet
    const rendererEvents = Object.keys(events).reduce(
      (acc, key) => {
        // @ts-ignore
        acc[key as keyof typeof events] = events[key as keyof typeof events].renderer
        return acc
      },
      {} as {
        [K in keyof typeof events]: (typeof events)[K]['renderer']
      }
    )

    // only return the main event methods
    const mainEvents = Object.keys(events).reduce(
      (acc, key) => {
        // @ts-ignore
        acc[key as keyof typeof events] = events[key as keyof typeof events].main
        return acc
      },
      {} as {
        [K in keyof typeof events]: (typeof events)[K]['main']
      }
    )

    return {
      main: mainEvents,
      renderer: rendererEvents
    }
  }
}

export const createIPCService = () => new IPCService()
