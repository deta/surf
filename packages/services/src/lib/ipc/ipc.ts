import { ipcMain, ipcRenderer } from 'electron'
import { isRenderer } from './utils'

export type IPCServiceType = 'main' | 'renderer'

export interface IPCEvent {
  payload: any
  output?: any
}

export type IPCListenerUnsubscribe = () => void

type HandleHandler<T extends IPCEvent> = (
  event: Electron.IpcMainInvokeEvent,
  payload: T['payload']
) => T['output'] | null | Promise<T['output'] | null>

export class IPCService {
  private requestCounter = 0
  private pendingRequests: Map<number, (response: any) => void> = new Map()
  private handleRendererRequest: ((payload: any) => Promise<any> | any) = () => {
    throw new Error('No handler registered for renderer request')
  }

  addEvent<T>(name: string) {
    return {
      renderer: {
        on: (handler: (event: Electron.IpcRendererEvent, payload: T) => void) => {
          ipcRenderer.on(name, handler)

          return (() => {
            ipcRenderer.off(name, handler)
          }) as IPCListenerUnsubscribe
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

          return (() => {
            ipcMain.off(name, handler)
          }) as IPCListenerUnsubscribe
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
    // Set up response handler for main-to-renderer requests
    if (isRenderer()) {
      const responseName = `${name}:response`
      ipcRenderer.on(`${name}:request`, (event, { id, payload }) => {
        if (!this.handleRendererRequest) {
          event.sender.send(responseName, { id, error: 'No handler registered for renderer request' })
          return
        }

        Promise.resolve()
          .then(() => this.handleRendererRequest(payload))
          .then(response => {
            event.sender.send(responseName, { id, response })
          })
          .catch(error => {
            event.sender.send(responseName, { id, error: error.message })
          })
      })
    }

    return {
      renderer: {
        invoke: (payload: T['payload']) => {
          const mainProcess = !isRenderer()
          if (mainProcess) {
            throw new Error('Cannot invoke events in main process')
          } else {
            return ipcRenderer.invoke(name, payload) as Promise<T['output'] | null>
          }
        },
        handle: (handler: (payload: T['payload']) => Promise<T['output']> | T['output']) => {
          if (!isRenderer()) {
            throw new Error('Cannot handle renderer requests in main process')
          }
          this.handleRendererRequest = handler
        }
      },
      main: {
        handle: (handler: HandleHandler<T>) => {
          const mainProcess = !isRenderer()
          if (mainProcess) {
            ipcMain.handle(name, handler)
            return (() => {
              ipcMain.removeHandler(name)
            }) as IPCListenerUnsubscribe
          } else {
            throw new Error('Cannot handle events in renderer process')
          }
        },
        requestFromRenderer: (webContents: Electron.WebContents, payload: T['payload']): Promise<T['output']> => {
          const mainProcess = !isRenderer()
          if (!mainProcess) {
            throw new Error('Cannot request from renderer in renderer process')
          }

          const requestId = ++this.requestCounter
          const responseName = `${name}:response`

          if (webContents.isDestroyed()) {
            return Promise.reject(new Error('WebContents is already destroyed'))
          }

          return new Promise((resolve, reject) => {
            let isCleanedUp = false
            let timeoutId: NodeJS.Timeout | null = null

            const cleanup = () => {
              if (isCleanedUp) return
              isCleanedUp = true

              if (timeoutId) clearTimeout(timeoutId)
              this.pendingRequests.delete(requestId)
              ipcMain.removeListener(responseName, responseHandler)
              webContents.removeListener('destroyed', handleDestroyed)
            }

            const handleError = (error: Error) => {
              cleanup()
              reject(error)
            }

            const responseHandler = (event: Electron.IpcMainEvent, response: { id: number; response?: any; error?: string }) => {
              if (response.id !== requestId) return
              
              if (response.error) {
                handleError(new Error(`Renderer Error: ${response.error}`))
              } else {
                cleanup()
                resolve(response.response)
              }
            }

            const handleDestroyed = () => {
              handleError(new Error('Renderer was destroyed'))
            }

            // Set up timeout
            timeoutId = setTimeout(() => {
              handleError(new Error('Request to renderer timed out after 30 seconds'))
            }, 30000) // 30 second timeout

            try {
              this.pendingRequests.set(requestId, resolve)
              ipcMain.on(responseName, responseHandler)
              webContents.once('destroyed', handleDestroyed)
              
              // Make sure webContents is still valid before sending
              if (webContents.isDestroyed()) {
                throw new Error('WebContents was destroyed')
              }
              
              webContents.send(`${name}:request`, { id: requestId, payload })
            } catch (err) {
              handleError(err instanceof Error ? err : new Error('Failed to send request to renderer'))
            }
          })
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
