import { useLogScope } from '@deta/utils/io'
import type { MessagePortEventPrimary } from './types'

export type MessagePortEvent = {
  payload: any
  output?: any
}

type ClientHandleHandler<T extends MessagePortEvent> = (
  payload: T['payload']
) => T['output'] | Promise<T['output']>

type PrimaryHandleHandler<T extends MessagePortEvent> = (
  payload: T['payload'],
  portId: string
) => T['output'] | Promise<T['output']>

type ClientEvent<T extends MessagePortEvent> = {
  send: (payload: T['payload']) => void
  handle: (handler: (payload: T['payload']) => void) => () => void
}

type PrimaryEvent<T extends MessagePortEvent> = {
  send: (portId: string, payload: T['payload']) => void
  on: (callback: (payload: T['payload'], portId: string) => void, portId?: string) => () => void
}

type ClientEventWithReturn<T extends MessagePortEvent> = {
  request: (payload: T['payload']) => Promise<T['output']>
  handle: (handler: ClientHandleHandler<T>) => () => void
}

type PrimaryEventWithReturn<T extends MessagePortEvent> = {
  request: (portId: string, payload: T['payload']) => Promise<T['output']>
  handle: (handler: PrimaryHandleHandler<T>, portId?: string) => () => void
}

export class MessagePortService<IsPrimary extends boolean> {
  private log: ReturnType<typeof useLogScope>
  private handlers = new Map<string, Set<(payload: any) => Promise<any> | any>>()
  private responseHandlers = new Map<string, (payload: any) => Promise<any> | any>()
  private portCallbacks = new Map<string, Set<(event: MessagePortEventPrimary) => void>>()
  private portResponseHandlers = new Map<
    string,
    Map<string, (event: MessagePortEventPrimary) => void>
  >()
  private messageQueue = new Map<string, Array<{ payload: any; portId?: string }>>()

  private primaryMode: IsPrimary
  private primaryPostMessage: ((portId: string, payload: any) => void) | undefined
  private clientPostMessage: ((payload: any) => void) | undefined

  private flushMessageQueue(type: string, handler: any, portId?: string) {
    const queuedMessages = this.messageQueue.get(type)
    if (queuedMessages && queuedMessages.length > 0) {
      this.log.debug(`Flushing ${queuedMessages.length} queued messages for type: ${type}`)

      // Process all queued messages
      while (queuedMessages.length > 0) {
        const message = queuedMessages.shift()
        if (!message) continue

        // For primary mode, only process messages for the specified port
        if (this.primaryMode && portId && message.portId !== portId) {
          continue
        }

        try {
          if (this.primaryMode) {
            handler({ payload: message.payload, portId: message.portId! })
          } else {
            handler(message.payload)
          }
        } catch (error) {
          console.error(`Error processing queued message of type ${type}:`, error)
        }
      }

      // Clean up the queue if empty
      if (queuedMessages.length === 0) {
        this.messageQueue.delete(type)
      }
    }
  }

  constructor(onMessage: (callback: any) => void, postMessage: any, primaryMode: IsPrimary) {
    this.log = useLogScope(`MessagePortService ${primaryMode ? 'Primary' : 'Client'}`)
    this.primaryMode = primaryMode

    if (primaryMode) {
      this.primaryPostMessage = postMessage
      onMessage((event: MessagePortEventPrimary) => {
        this.log.debug('onMessage:', event)

        // Check for response handlers first
        const responseHandlers = this.portResponseHandlers.get(event.portId)
        if (responseHandlers) {
          const responseHandler = responseHandlers.get(event.payload.type)
          if (responseHandler) {
            responseHandler(event)
            return
          }
        }

        // Then check regular handlers
        // First check port-specific handlers
        const portCallbacks = this.portCallbacks.get(event.portId)
        const allPortsCallbacks = this.portCallbacks.get('*')

        if (portCallbacks || allPortsCallbacks) {
          if (portCallbacks) {
            portCallbacks.forEach((callback) => callback(event))
          }
          if (allPortsCallbacks) {
            allPortsCallbacks.forEach((callback) => callback(event))
          }
        } else {
          // Queue the message if no handlers are registered
          this.log.debug(
            `Queueing message of type: ${event.payload.type} for port: ${event.portId}`
          )
          if (!this.messageQueue.has(event.payload.type)) {
            this.messageQueue.set(event.payload.type, [])
          }
          this.messageQueue.get(event.payload.type)?.push({
            payload: event.payload,
            portId: event.portId
          })
        }
      })
    } else {
      this.clientPostMessage = postMessage
      onMessage((payload: any) => {
        this.log.debug('onMessage:', payload)

        // First check if this is a response to a request
        const responseHandler = this.responseHandlers.get(payload.type)
        if (responseHandler) {
          responseHandler(payload)
          return
        }

        // Otherwise look for a regular message handler
        const handlers = this.handlers.get(payload.type)
        if (handlers && handlers.size > 0) {
          // Call all registered handlers for this event type
          handlers.forEach((handler) => {
            try {
              const result = handler(payload.data)
              if (result instanceof Promise) {
                result
                  .then((response) => {
                    if (response !== undefined) {
                      this.clientPostMessage?.({
                        type: `${payload.type}:response`,
                        data: response
                      })
                    }
                  })
                  .catch((error) => {
                    console.error('Error handling message:', error)
                    this.clientPostMessage?.({
                      type: `${payload.type}:error`,
                      data: error instanceof Error ? error.message : 'Unknown error'
                    })
                  })
              } else if (result !== undefined) {
                // Handle synchronous return values
                this.clientPostMessage?.({
                  type: `${payload.type}:response`,
                  data: result
                })
              }
            } catch (error) {
              console.error('Error handling message:', error)
              this.clientPostMessage?.({
                type: `${payload.type}:error`,
                data: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          })
        } else {
          // Queue the message if no handler is registered
          this.log.debug(`Queueing message of type: ${payload.type}`)
          if (!this.messageQueue.has(payload.type)) {
            this.messageQueue.set(payload.type, [])
          }
          this.messageQueue.get(payload.type)?.push({ payload })
        }
      })
    }
  }

  addEvent<T extends MessagePortEvent>(
    name: string
  ): IsPrimary extends true ? PrimaryEvent<T> : ClientEvent<T> {
    if (this.primaryMode) {
      return {
        send: (portId: string, payload: T) => {
          if (!this.primaryPostMessage) throw new Error('Primary post message not initialized')
          this.primaryPostMessage(portId, { type: name, data: payload })
        },
        on: (callback: (payload: T, portId: string) => void, portId?: string) => {
          const wrappedCallback = (event: MessagePortEventPrimary) => {
            if (event.payload.type === name) {
              if (portId && event.portId !== portId) return
              callback(event.payload.data, event.portId)
            }
          }

          if (portId) {
            // Register for specific port
            let callbacks = this.portCallbacks.get(portId)
            if (!callbacks) {
              callbacks = new Set()
              this.portCallbacks.set(portId, callbacks)
            }
            callbacks.add(wrappedCallback)

            return () => {
              const callbacks = this.portCallbacks.get(portId)
              if (callbacks) {
                callbacks.delete(wrappedCallback)
                if (callbacks.size === 0) {
                  this.portCallbacks.delete(portId)
                }
              }
            }
          } else {
            // Register for all ports using a special key
            const allPortsKey = '*'
            let callbacks = this.portCallbacks.get(allPortsKey)
            if (!callbacks) {
              callbacks = new Set()
              this.portCallbacks.set(allPortsKey, callbacks)
            }
            callbacks.add(wrappedCallback)

            return () => {
              const callbacks = this.portCallbacks.get(allPortsKey)
              if (callbacks) {
                callbacks.delete(wrappedCallback)
                if (callbacks.size === 0) {
                  this.portCallbacks.delete(allPortsKey)
                }
              }
            }
          }
        }
      } as IsPrimary extends true ? PrimaryEvent<T> : ClientEvent<T>
    } else {
      return {
        send: (payload: T) => {
          if (!this.clientPostMessage) throw new Error('Client post message not initialized')
          this.clientPostMessage({ type: name, data: payload })
        },
        handle: (handler: (payload: T) => void) => {
          // Get or create a Set for this event type
          let handlers = this.handlers.get(name)
          if (!handlers) {
            handlers = new Set()
            this.handlers.set(name, handlers)
          }

          // Add the handler to the Set
          handlers.add(handler)

          // Flush any queued messages for this event type
          this.flushMessageQueue(name, (payload: any) => handler(payload.data))

          // Return cleanup function that removes only this specific handler
          return () => {
            const handlers = this.handlers.get(name)
            if (handlers) {
              handlers.delete(handler)
              // Clean up the Set if it's empty
              if (handlers.size === 0) {
                this.handlers.delete(name)
              }
            }
          }
        }
      } as IsPrimary extends true ? PrimaryEvent<T> : ClientEvent<T>
    }
  }

  addEventWithReturn<T extends MessagePortEvent>(
    name: string
  ): IsPrimary extends true ? PrimaryEventWithReturn<T> : ClientEventWithReturn<T> {
    if (this.primaryMode) {
      return {
        request: (portId: string, payload: T['payload']): Promise<T['output']> => {
          if (!this.primaryPostMessage) throw new Error('Primary post message not initialized')

          return new Promise((resolve, reject) => {
            const responseHandler = (event: MessagePortEventPrimary) => {
              if (event.payload.type === `${name}:response`) {
                resolve(event.payload.data)
                cleanup()
              } else if (event.payload.type === `${name}:error`) {
                reject(new Error(event.payload.data))
                cleanup()
              }
            }

            const cleanup = () => {
              const handlers = this.portResponseHandlers.get(portId)
              if (handlers) {
                handlers.delete(`${name}:response`)
                handlers.delete(`${name}:error`)
                if (handlers.size === 0) {
                  this.portResponseHandlers.delete(portId)
                }
              }
            }

            let handlers = this.portResponseHandlers.get(portId)
            if (!handlers) {
              handlers = new Map()
              this.portResponseHandlers.set(portId, handlers)
            }
            handlers.set(`${name}:response`, responseHandler)
            handlers.set(`${name}:error`, responseHandler)
            this.primaryPostMessage!(portId, { type: name, data: payload })
          })
        },
        handle: (handler: PrimaryHandleHandler<T>, portId?: string) => {
          const wrappedHandler = async (event: MessagePortEventPrimary) => {
            if (event.payload.type !== name) return
            if (portId && event.portId !== portId) return

            try {
              const response = await handler(event.payload.data, event.portId)
              if (response !== undefined) {
                this.primaryPostMessage?.(event.portId, {
                  type: `${name}:response`,
                  data: response
                })
              }
            } catch (error) {
              this.primaryPostMessage?.(event.portId, {
                type: `${name}:error`,
                data: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          }

          if (portId) {
            // Register for specific port
            let callbacks = this.portCallbacks.get(portId)
            if (!callbacks) {
              callbacks = new Set()
              this.portCallbacks.set(portId, callbacks)
            }
            callbacks.add(wrappedHandler)

            return () => {
              const callbacks = this.portCallbacks.get(portId)
              if (callbacks) {
                callbacks.delete(wrappedHandler)
                if (callbacks.size === 0) {
                  this.portCallbacks.delete(portId)
                }
              }
            }
          } else {
            // Register for all ports using a special key
            const allPortsKey = '*'
            let callbacks = this.portCallbacks.get(allPortsKey)
            if (!callbacks) {
              callbacks = new Set()
              this.portCallbacks.set(allPortsKey, callbacks)
            }
            callbacks.add(wrappedHandler)

            // Flush any queued messages for this event type
            this.flushMessageQueue(name, wrappedHandler)

            return () => {
              const callbacks = this.portCallbacks.get(allPortsKey)
              if (callbacks) {
                callbacks.delete(wrappedHandler)
                if (callbacks.size === 0) {
                  this.portCallbacks.delete(allPortsKey)
                }
              }
            }
          }
        }
      } as IsPrimary extends true ? PrimaryEventWithReturn<T> : ClientEventWithReturn<T>
    } else {
      return {
        request: (payload: T['payload']): Promise<T['output']> => {
          if (!this.clientPostMessage) throw new Error('Client post message not initialized')

          return new Promise((resolve, reject) => {
            const responseHandler = (payload: any) => {
              if (payload.type === `${name}:response`) {
                resolve(payload.data)
                cleanup()
              } else if (payload.type === `${name}:error`) {
                reject(new Error(payload.data))
                cleanup()
              }
            }

            const cleanup = () => {
              // Remove only the response handler
              this.responseHandlers.delete(`${name}:response`)
              this.responseHandlers.delete(`${name}:error`)
            }

            // Set response handlers
            this.responseHandlers.set(`${name}:response`, responseHandler)
            this.responseHandlers.set(`${name}:error`, responseHandler)
            this.clientPostMessage!({ type: name, data: payload })
          })
        },
        handle: (handler: ClientHandleHandler<T>) => {
          // Get or create a Set for this event type
          let handlers = this.handlers.get(name)
          if (!handlers) {
            handlers = new Set()
            this.handlers.set(name, handlers)
          }

          // Add the handler to the Set
          handlers.add(handler)

          // Flush any queued messages for this event type
          this.flushMessageQueue(name, (payload: any) => handler(payload.data))

          // Return cleanup function that removes only this specific handler
          return () => {
            const handlers = this.handlers.get(name)
            if (handlers) {
              handlers.delete(handler)
              // Clean up the Set if it's empty
              if (handlers.size === 0) {
                this.handlers.delete(name)
              }
            }
          }
        }
      } as IsPrimary extends true ? PrimaryEventWithReturn<T> : ClientEventWithReturn<T>
    }
  }

  registerEvents<Events extends Record<string, MessagePortEvent>>(events: {
    [K in keyof Events]: ReturnType<
      Events[K] extends { output: any }
        ? typeof this.addEventWithReturn<Events[K]>
        : typeof this.addEvent<Events[K]>
    >
  }) {
    return events
  }
}

export const createMessagePortService = <IsPrimary extends boolean = false>(
  onMessage: (callback: any) => void,
  postMessage: any,
  primaryMode: IsPrimary = false as IsPrimary
) => new MessagePortService<IsPrimary>(onMessage, postMessage, primaryMode)
