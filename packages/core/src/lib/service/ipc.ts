import { ipcMain, ipcRenderer } from 'electron'

export type IPCServiceType = 'main' | 'renderer'

export interface IPCEvent {
  name: string
  payload: any
}

export interface IPCEventHandler<T extends IPCEvent> {
  handle: (handler: (event: any, payload: T['payload']) => any) => void
  invoke: (payload: T['payload']) => void
  on: (handler: (event: any, payload: T['payload']) => any) => void
  send: (payload: T['payload']) => void
  sendToWebContents(webContents: Electron.WebContents, payload: T['payload']): void
}

export class IPCService {
  private type: IPCServiceType
  private events: Record<string, IPCEventHandler<IPCEvent>> = {}

  constructor(type: IPCServiceType = 'main') {
    this.type = type
  }

  addEvent<T extends IPCEvent>(name: string) {
    this.events[name] = {
      handle: (handler: (event: any, payload: T['payload']) => any) => {
        if (this.type === 'main') {
          ipcMain.handle(name, handler)
          return
        } else if (this.type === 'renderer') {
          throw new Error('Cannot handle events in renderer process')
        }
      },
      invoke: (payload: T['payload']) => {
        if (this.type === 'main') {
          throw new Error('Cannot invoke events in main process')
        } else if (this.type === 'renderer') {
          ipcRenderer.invoke(name, payload)
        }
      },
      on: (handler: (event: any, payload: T['payload']) => any) => {
        if (this.type === 'main') {
          ipcMain.on(name, handler)
          return
        } else if (this.type === 'renderer') {
          ipcRenderer.on(name, handler)
        }
      },
      send: (payload: T['payload']) => {
        if (this.type === 'main') {
          throw new Error('Cannot send events in main process')
        } else if (this.type === 'renderer') {
          ipcRenderer.send(name, payload)
        }
      },
      sendToWebContents: (webContents: Electron.WebContents, payload: T['payload']) => {
        if (this.type === 'main') {
          webContents.send(name, payload)
        } else if (this.type === 'renderer') {
          throw new Error('Cannot send events to web contents in renderer process')
        }
      }
    }

    return this.events[name] as unknown as IPCEventHandler<T>
  }

  getEvents() {
    return this.events
  }

  getEvent<T extends IPCEvent>(name: string) {
    return this.events[name] as unknown as IPCEventHandler<T>
  }

  removeEvent(name: string) {
    delete this.events[name]
  }

  removeAllEvents() {
    this.events = {}
  }

  destroy() {
    this.removeAllEvents()
  }
}

export const ipcService = new IPCService()

interface SubtractEvent extends IPCEvent {
  name: 'SUBTRACT_CHANNEL'
  payload: {
    n1: number
    n2: number
  }
}

export const subtractEvent = ipcService.addEvent<SubtractEvent>('SUBTRACT_CHANNEL')

// in main process
subtractEvent.handle((_event, { n1, n2 }) => {
  return n1 - n2
})

// in renderer process
subtractEvent.invoke({ n1: 10, n2: 5 })

// in main process
subtractEvent.on((_event, { n1, n2 }) => {
  console.log(n1 - n2)
})

// in renderer process
subtractEvent.send({ n1: 10, n2: 5 })

// in renderer process
subtractEvent.on((_event, { n1, n2 }) => {
  console.log(n1 - n2)
})

// in main process
subtractEvent.sendToWebContents(webContents, { n1: 10, n2: 5 })
