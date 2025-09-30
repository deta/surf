import { ipcRenderer } from 'electron'
import type { MessagePortCallbackClient, MessagePortCallbackPrimary } from '../messagePort/types'
import { useLogScope } from '@deta/utils'

const log = useLogScope('MessagePort')

/**
 * Sets up a message port for communication between two renderer processes, handling the client side.
 *
 * This method should be called in other preloads with `contextBridge.exposeInMainWorld` to expose the
 * message port API to the renderer process.
 *
 * @example
 * const { onMessage, postMessage } = setupMessagePortClient()
 *
 * contextBridge.exposeInMainWorld('messagePort', {
 *   onMessage,
 *   postMessage
 * })
 */
export function setupMessagePortClient() {
  let port: MessagePort | undefined = undefined
  let queue: any[] = []
  let storedCallback: MessagePortCallbackClient | undefined = undefined

  ipcRenderer.on('port', (event, payload) => {
    try {
      log.debug('received messagePort', payload)
      port = event.ports[0]

      port.onmessage = (event) => {
        log.debug('received messagePort message', event)
        if (storedCallback) {
          storedCallback(event.data)
        } else {
          queue.push(event.data)
        }
      }
    } catch (error) {
      // noop
    }
  })

  const onMessage = (callback: MessagePortCallbackClient) => {
    storedCallback = callback

    // flush queue
    if (queue.length > 0) {
      queue.forEach((item) => {
        callback(item)
      })

      queue = []
    }
  }

  const postMessage = (payload: any) => {
    if (port) {
      port.postMessage(payload)
    }
  }

  return {
    onMessage,
    postMessage
  }
}

/**
 * Sets up a message port for communication between two renderer processes, handling the primary side.
 *
 * This method should be called in the core preload with `contextBridge.exposeInMainWorld` to expose the
 * message port API to the renderer process.
 *
 * @example
 * const { onMessage, postMessage } = setupMessagePortPrimary()
 *
 * contextBridge.exposeInMainWorld('messagePort', {
 *   onMessage,
 *   postMessage
 * })
 */
export function setupMessagePortPrimary() {
  const messagePorts = new Map<string, MessagePort>()

  const onMessage = (callback: MessagePortCallbackPrimary) => {
    ipcRenderer.on('port', (event, payload) => {
      try {
        log.debug('received messagePort', payload)
        const port = event.ports[0]
        const portId = payload.portId

        messagePorts.set(portId, port)

        port.onmessage = (event) => {
          log.debug('received messagePort message', event)
          callback({ portId: portId, payload: event.data })
        }
      } catch (error) {
        // noop
      }
    })
  }

  const postMessage = (portId: string, payload: any) => {
    const port = messagePorts.get(portId)
    if (port) {
      port.postMessage(payload)
    }
  }

  return {
    onMessage,
    postMessage
  }
}
