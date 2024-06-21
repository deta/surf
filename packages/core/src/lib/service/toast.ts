import { writable, type Writable } from 'svelte/store'
import type { Optional } from '../types'
import { generateID } from '../utils/id'
import { getContext, setContext } from 'svelte'
import { useLogScope } from '../utils/log'

export type Toast = {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  timeout: number
}

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
      timeout: 3000
    } as Toast

    const toast = Object.assign({}, defaults, data)

    this.toasts.update((all) => [toast, ...all])
    if (toast.timeout) {
      setTimeout(() => this.dismiss(id), toast.timeout)
    }
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
