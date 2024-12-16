import { get, writable, type Writable } from 'svelte/store'
import type { Optional } from '../types'
import { useLogScope, generateID } from '@horizon/utils'
import { getContext, setContext } from 'svelte'
import EventEmitter from 'events'
import type TypedEmitter from 'typed-emitter'

export type Toast = {
  id: string
  type: 'info' | 'success' | 'warning' | 'error' | 'loading'
  message: string
  timeout: number
}

// use the return type of the loading method
export type ToastItem = {
  id: string
  dismiss: () => void
  update: (message: string, type?: Toast['type'], timeout?: number) => void
  success: (message: string, timeout?: number) => void
  info: (message: string, timeout?: number) => void
  warning: (message: string, timeout?: number) => void
  error: (message: string, timeout?: number) => void
}

const DEFAULT_TIMEOUT = 3000

export type ToastsEvents = {
  'will-dismiss': (toast: Toast) => void
}

export class Toasts {
  toasts: Writable<Toast[]>
  log: ReturnType<typeof useLogScope>
  eventEmitter: TypedEmitter<ToastsEvents>

  constructor() {
    this.toasts = writable([])
    this.log = useLogScope('Toasts')
    // Svelte 5 would solve needing this event shit to notify
    this.eventEmitter = new EventEmitter() as TypedEmitter<ToastsEvents>
  }

  create(data: Optional<Toast, 'id' | 'timeout' | 'type'>) {
    const id = generateID()
    const defaults = {
      id,
      type: 'info',
      timeout: DEFAULT_TIMEOUT
    } as Toast

    const toast = Object.assign({}, defaults, data)

    this.toasts.update((v) => {
      v.push(toast)
      return v
    })
    if (toast.timeout) {
      setTimeout(() => this.dismiss(id), toast.timeout)
    }

    return id
  }

  success(message: string, timeout?: number) {
    this.create({ type: 'success', message, ...(timeout ? { timeout } : {}) })
  }

  info(message: string, timeout?: number) {
    this.create({ type: 'info', message, ...(timeout ? { timeout } : {}) })
  }

  warning(message: string, timeout?: number) {
    this.create({ type: 'warning', message, ...(timeout ? { timeout } : {}) })
  }

  error(message: string, timeout?: number) {
    this.create({ type: 'error', message, ...(timeout ? { timeout } : {}) })
  }

  loading(message: string) {
    const id = this.create({ type: 'loading', message, timeout: 0 })

    const updateToast = (message: string, type?: Toast['type'], timeout?: number) => {
      this.toasts.update((all) => {
        const toast = all.find((t) => t.id === id)
        if (toast) {
          toast.message = message
          if (type) {
            toast.type = type
          }

          if (timeout) {
            toast.timeout = timeout
          }
        }
        return all
      })

      if (timeout) {
        setTimeout(() => this.dismiss(id), timeout)
      }
    }

    return {
      id,
      dismiss: () => this.dismiss(id),
      update: updateToast,
      success: (message: string, timeout?: number) =>
        updateToast(message, 'success', timeout ?? DEFAULT_TIMEOUT),
      info: (message: string, timeout?: number) =>
        updateToast(message, 'info', timeout ?? DEFAULT_TIMEOUT),
      warning: (message: string, timeout?: number) =>
        updateToast(message, 'warning', timeout ?? DEFAULT_TIMEOUT),
      error: (message: string, timeout?: number) =>
        updateToast(message, 'error', timeout ?? DEFAULT_TIMEOUT)
    } as ToastItem
  }

  dismiss(id: string) {
    this.log.debug('Dismissing toast', id)
    const toast = get(this.toasts).find((e) => e.id === id)
    if (!toast) return
    this.eventEmitter.emit('will-dismiss', toast)
    setTimeout(() => this.toasts.update((all) => all.filter((t) => t.id !== id)), 300)
  }

  static provide() {
    const toasts = new Toasts()
    setContext('toasts', toasts)
    return toasts
  }

  static use() {
    return getContext<Toasts>('toasts')
  }
}

export const provideToasts = Toasts.provide
export const useToasts = Toasts.use
