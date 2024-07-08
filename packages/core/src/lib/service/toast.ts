import { writable, type Writable } from 'svelte/store'
import type { Optional } from '../types'
import { generateID } from '../utils/id'
import { getContext, setContext } from 'svelte'
import { useLogScope } from '../utils/log'
import { update } from 'lodash'

export type Toast = {
  id: string
  type: 'info' | 'success' | 'warning' | 'error' | 'loading'
  message: string
  timeout: number
}

const DEFAULT_TIMEOUT = 3000

export class Toasts {
  toasts: Writable<Toast[]>
  log: ReturnType<typeof useLogScope>

  constructor() {
    this.toasts = writable([])
    this.log = useLogScope('Toasts')
  }

  create(data: Optional<Toast, 'id' | 'timeout' | 'type'>) {
    const id = generateID()
    const defaults = {
      id,
      type: 'info',
      timeout: DEFAULT_TIMEOUT
    } as Toast

    const toast = Object.assign({}, defaults, data)

    this.toasts.update((all) => [toast, ...all])
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
    }
  }

  dismiss(id: string) {
    this.log.debug('Dismissing toast', id)
    this.toasts.update((all) => all.filter((t) => t.id !== id))
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
