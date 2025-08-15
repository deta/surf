import { get, writable, type Writable } from 'svelte/store'
import { useLogScope, generateID, isDev, EventEmitterBase } from '@deta/utils'
import { type Optional } from '@deta/types'
import { getContext, setContext } from 'svelte'

export type ToastAction = {
  label: string
  handler: () => void | { preventDismiss?: boolean }
}

export type ToastData = {
  id: string
  type: 'info' | 'success' | 'warning' | 'error' | 'loading'
  message: string
  timeout: number
  dismissable: boolean
  dismissText: string
  action?: ToastAction
}

export type CreateToastOpts = Partial<Omit<ToastData, 'id' | 'type' | 'message'>>
export type CreateLoadingToastOpts = Omit<CreateToastOpts, 'timeout'>
export type UpdateToastOpts = Partial<Omit<ToastData, 'id'>>

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

export class Toast {
  id: string
  type: 'info' | 'success' | 'warning' | 'error' | 'loading'
  message: string
  timeout: number
  dismissable: boolean
  dismissText: string
  action?: ToastAction

  manager: Toasts
  log: ReturnType<typeof useLogScope>

  createdAt: number
  remainingTime: number | null
  timeoutCall: ReturnType<typeof setTimeout> | null = null
  isHovering: Writable<boolean>

  constructor(data: ToastData, manager: Toasts) {
    this.id = data.id
    this.type = data.type
    this.message = data.message
    this.timeout = data.timeout
    this.dismissable = data.dismissable
    this.dismissText = data.dismissText
    this.action = data.action

    this.createdAt = Date.now()
    this.remainingTime = null
    this.isHovering = writable(false)

    this.manager = manager
    this.log = manager.log

    if (data.timeout) {
      this.createTimeout(data.timeout)
    }

    this.isHovering.subscribe((v) => {
      if (v) {
        this.remainingTime = (this.remainingTime ?? this.timeout) - (Date.now() - this.createdAt)
        this.clearTimeout()
      } else if (this.timeout) {
        this.createTimeout(this.remainingTime ?? this.timeout)
      }
    })
  }

  get isHoveringValue() {
    return get(this.isHovering)
  }

  private createTimeout(delay: number) {
    this.clearTimeout()

    this.createdAt = Date.now()
    this.timeoutCall = setTimeout(() => {
      if (this.isHoveringValue) return
      this.dismiss()
    }, delay)
  }

  private clearTimeout() {
    if (this.timeoutCall) {
      clearTimeout(this.timeoutCall)
    }

    this.timeoutCall = null
  }

  update(data: UpdateToastOpts) {
    this.message = data.message ?? this.message
    this.type = data.type ?? this.type
    this.timeout = data.timeout ?? this.timeout
    this.dismissable = data.dismissable ?? this.dismissable
    this.dismissText = data.dismissText ?? this.dismissText
    this.action = data.action ?? this.action

    if (data.timeout) {
      this.createdAt = Date.now()
      this.remainingTime = null
      this.createTimeout(data.timeout)
    }

    this.manager.triggerReactivityUpdate(this)
  }

  dismiss() {
    this.manager.dismiss(this.id)
  }

  success(message: string, opts?: UpdateToastOpts) {
    this.update({ timeout: DEFAULT_TIMEOUT, ...opts, message, type: 'success' })
  }

  error(message: string, opts?: UpdateToastOpts) {
    this.update({ timeout: DEFAULT_TIMEOUT, ...opts, message, type: 'error' })
  }

  warning(message: string, opts?: UpdateToastOpts) {
    this.update({ timeout: DEFAULT_TIMEOUT, ...opts, message, type: 'warning' })
  }

  info(message: string, opts?: UpdateToastOpts) {
    this.update({ timeout: DEFAULT_TIMEOUT, ...opts, message, type: 'info' })
  }

  loading(message: string, opts?: UpdateToastOpts) {
    this.update({ ...opts, message, type: 'loading', timeout: 0 })
  }

  handleClick() {
    this.manager.log.debug('Toast action clicked', this)
    if (this.action) {
      const returnValue = this.action.handler()
      if (returnValue?.preventDismiss) return

      this.dismiss()
    }
  }
}

export class Toasts extends EventEmitterBase<ToastsEvents> {
  toasts: Writable<Toast[]>
  log: ReturnType<typeof useLogScope>

  static self: Toasts

  constructor() {
    super()
    this.toasts = writable([])
    this.log = useLogScope('Toasts')

    if (isDev) {
      // @ts-ignore
      window.toasts = this
    }
  }

  get toastsValue() {
    return get(this.toasts)
  }

  triggerReactivityUpdate(toast: Toast) {
    this.toasts.update((toasts) => toasts.map((t) => (t.id === toast.id ? toast : t)))
  }

  create(data: Optional<ToastData, 'id' | 'timeout' | 'type' | 'dismissable' | 'dismissText'>) {
    const id = generateID()
    const defaults = {
      id,
      type: 'info',
      timeout: DEFAULT_TIMEOUT,
      dismissable: true,
      dismissText: 'Dismiss'
    } as Toast

    const toastData = {
      ...defaults,
      ...Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined))
    }

    const toast = new Toast(toastData, this)
    this.toasts.update((v) => {
      v.push(toast)
      return v
    })

    return toast
  }

  updateToast(id: string, updates: UpdateToastOpts) {
    const toast = this.toastsValue.find((e) => e.id === id)
    if (!toast) return

    toast.update(updates)
  }

  success(message: string, opts?: CreateToastOpts) {
    return this.create({ type: 'success', message, ...opts })
  }

  info(message: string, opts?: CreateToastOpts) {
    return this.create({ type: 'info', message, ...opts })
  }

  warning(message: string, opts?: CreateToastOpts) {
    return this.create({ type: 'warning', message, ...opts })
  }

  error(message: string, opts?: CreateToastOpts) {
    return this.create({ type: 'error', message, ...opts })
  }

  loading(message: string, opts?: CreateLoadingToastOpts) {
    return this.create({ type: 'loading', message, ...opts, timeout: 0 })
  }

  dismiss(id: string) {
    const toast = this.toastsValue.find((e) => e.id === id)
    if (!toast) return

    this.emit('will-dismiss', toast)

    setTimeout(() => this.toasts.update((all) => all.filter((t) => t.id !== id)), 300)

    if (toast.timeoutCall) {
      clearTimeout(toast.timeoutCall)
    }
  }

  static provide() {
    const toasts = new Toasts()
    setContext('toasts', toasts)

    if (!Toasts.self) Toasts.self = toasts

    return toasts
  }

  static use() {
    if (!Toasts.self) return getContext<Toasts>('toasts')
    return Toasts.self
  }
}

export const provideToasts = Toasts.provide
export const useToasts = Toasts.use
