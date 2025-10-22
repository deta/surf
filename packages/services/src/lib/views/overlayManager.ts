import {
  isDev,
  createDummyPromise,
  useLogScope,
  type ScopedLogger,
  type DummyPromise
} from '@deta/utils'
import { useViewManager, type ViewManager } from './viewManager.svelte'
import {
  WebContentsViewActionType,
  WebContentsViewEventType,
  type Fn,
  type WebContentsViewActionOutputs,
  type WebContentsViewEvent
} from '@deta/types'

export class Overlay {
  id: string
  window: Window
  bounds: Electron.Rectangle | null

  private log: ScopedLogger
  private manager: OverlayManager
  private unsubs: Fn[] = []

  domReady: DummyPromise<void> | null = null

  constructor(
    manager: OverlayManager,
    data: { id: string; window: Window; bounds?: Electron.Rectangle }
  ) {
    this.log = useLogScope('Overlay')
    this.manager = manager
    this.id = data.id
    this.window = data.window
    this.bounds = data.bounds || null
  }

  async init() {
    this.log.debug(`Initializing overlay with ID: ${this.id}`, this)

    this.domReady = createDummyPromise()
    this.attachListeners()

    if (this.bounds) {
      await this.saveBounds(this.bounds)
    }

    await this.activate()

    // await this.domReady.promise
  }

  get wrapperElement(): HTMLElement | null {
    return this.window.document.getElementById('wcv-overlay-content') || this.window.document.body
  }

  handleClickOutside(event: MouseEvent) {
    this.manager.destroy(this.id)
  }

  attachListeners() {
    const unsubWebContentsEvents = window.preloadEvents.onWebContentsViewEvent(
      (event: WebContentsViewEvent) => {
        // only handle events for our own view
        if (event.viewId !== this.id) {
          return
        }

        this.log.debug(`Received WebContentsViewEvent for overlay ${this.id}`, event)

        if (event.type === WebContentsViewEventType.DOM_READY) {
          this.domReady?.resolve()
        }
      }
    )

    this.unsubs.push(unsubWebContentsEvents)

    window.addEventListener('click', (event) => this.handleClickOutside(event), { passive: true })
  }

  async saveBounds(bounds: Electron.Rectangle) {
    this.bounds = bounds
    ;(await window.api.webContentsViewAction(this.id, WebContentsViewActionType.SET_BOUNDS, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    })) as Promise<WebContentsViewActionOutputs[WebContentsViewActionType.SET_BOUNDS]>
  }

  async activate() {
    return (await window.api.webContentsViewAction(
      this.id,
      WebContentsViewActionType.ACTIVATE,
      {}
    )) as Promise<WebContentsViewActionOutputs[WebContentsViewActionType.ACTIVATE]>
  }

  async focus() {
    return (await window.api.webContentsViewAction(
      this.id,
      WebContentsViewActionType.FOCUS,
      {}
    )) as Promise<WebContentsViewActionOutputs[WebContentsViewActionType.FOCUS]>
  }

  async hide() {
    return (await window.api.webContentsViewAction(
      this.id,
      WebContentsViewActionType.HIDE,
      {}
    )) as Promise<WebContentsViewActionOutputs[WebContentsViewActionType.HIDE]>
  }

  async openDevTools() {
    return (await window.api.webContentsViewAction(
      this.id,
      WebContentsViewActionType.OPEN_DEV_TOOLS,
      {}
    )) as Promise<WebContentsViewActionOutputs[WebContentsViewActionType.OPEN_DEV_TOOLS]>
  }

  destroy() {
    this.unsubs.forEach((unsub) => unsub())
    this.unsubs = []

    window.removeEventListener('click', (event) => this.handleClickOutside(event))

    return window.api.webContentsViewAction(
      this.id,
      WebContentsViewActionType.DESTROY,
      {}
    ) as Promise<WebContentsViewActionOutputs[WebContentsViewActionType.DESTROY]>
  }
}

export class OverlayManager {
  private static self: OverlayManager | null = null

  private log: ScopedLogger
  viewManager: ViewManager

  overlays: Map<string, Overlay> = new Map() // Maps overlay IDs to overlay instances
  private overlayPool: Overlay[] = [] // Pool of pre-created overlays
  private readonly poolSize = 1 // Number of overlays to pre-create

  constructor() {
    this.log = useLogScope('OverlayManager')
    this.viewManager = useViewManager()

    if (isDev) {
      // @ts-ignore
      window.overlayManager = this
    }

    this.log.debug(`Initializing overlay pool with ${this.poolSize} overlays`)
    this.refillPool()
  }

  private async refillPool() {
    this.log.debug('Refilling overlay pool')
    const needed = this.poolSize - this.overlayPool.length

    if (needed <= 0) return

    for (let i = 0; i < needed; i++) {
      const overlay = await this.createOverlay({ hidden: true })
      this.overlayPool.push(overlay)
    }
  }

  private async createOverlay(opts?: { bounds?: Electron.Rectangle; hidden?: boolean }) {
    const overlayId = `overlay-${Date.now()}`

    const overlayWindow = window.open(
      'surf-internal://Core/Overlay/overlay.html',
      `portal_${overlayId}`,
      `componentId=${overlayId}`
    ) as Window | null

    if (!overlayWindow) {
      throw new Error('Failed to create overlay web contents')
    }

    this.log.debug(`Creating overlay with ID: ${overlayId}`, overlayWindow)

    const overlay = new Overlay(this, {
      id: overlayId,
      window: overlayWindow,
      bounds: opts?.bounds
    })

    await overlay.init()

    if (!opts?.hidden) {
      await overlay.activate()
    }

    return overlay
  }

  async create(opts?: { bounds?: Electron.Rectangle }) {
    // Try to get an overlay from the pool
    const pooledOverlay = this.overlayPool.pop()
    if (pooledOverlay) {
      this.log.debug('Reusing overlay from pool', pooledOverlay)

      if (opts?.bounds) {
        await pooledOverlay.saveBounds(opts.bounds)
      }

      await pooledOverlay.activate()
      this.overlays.set(pooledOverlay.id, pooledOverlay)

      // Refill the pool asynchronously
      setTimeout(() => this.refillPool(), 0)

      return pooledOverlay
    }

    // If no overlay is available in the pool, create a new one
    const overlay = await this.createOverlay(opts)
    this.overlays.set(overlay.id, overlay)

    return overlay
  }

  async destroy(overlayId: string) {
    const overlay = this.overlays.get(overlayId)
    if (!overlay) {
      this.log.warn(`Overlay with ID ${overlayId} not found`)
      return
    }

    this.log.debug(`Destroying overlay with ID: ${overlayId}`, overlay)
    this.overlays.delete(overlayId)
    await overlay.destroy()
  }

  static getInstance(): OverlayManager {
    if (!OverlayManager.self) {
      OverlayManager.self = new OverlayManager()
    }
    return OverlayManager.self
  }

  // Add methods for managing overlays here
}

export const useOverlayManager = () => OverlayManager.getInstance()
