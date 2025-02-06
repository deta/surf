import { derived, writable, type Readable, type Writable, get } from 'svelte/store'
import type { Telemetry } from './telemetry'
import { HorizonDatabase } from './storage'
import type { DesktopData, DesktopItemData, GridRect } from '../types/desktop.types'
import { tick } from 'svelte'
import {
  AddHomescreenItemEventSource,
  AddHomescreenItemEventTrigger,
  AddResourceToSpaceEventTrigger,
  EventContext,
  OpenHomescreenEventTrigger,
  RemoveHomescreenItemEventTrigger,
  ResourceTagsBuiltInKeys,
  ResourceTypes,
  SaveToOasisEventTrigger,
  UpdateHomescreenEventAction
} from '@horizon/types'
import type { ConfigService } from './config'
import type { OasisService, OasisSpace } from './oasis'
import type { TabsManager } from './tabs'
import type { Toasts } from './toast'
import type { Resource, ResourceManager } from './resources'
import type { DragculaDragEvent, Vec2 } from '../../../../dragcula/dist'
import { DragTypeNames, SpaceEntryOrigin, type DragTypes, type Tab } from '../types'
import { getResourceFromDrag } from '../utils/draganddrop'
import { createResourcesFromMediaItems, processDrop } from './mediaImporter'
import { useLocalStorageStore, useLogScope, wait, type ScopedLogger } from '@horizon/utils'
import { clamp } from '../../../../dragcula/dist/utils/internal'
import type { MiniBrowser, MiniBrowserService } from './miniBrowser'
import EventEmitter from 'events'
import type TypedEmitter from 'typed-emitter'
import { ColorService, type CustomColorData } from './colors'

const DEFAULT_CARD_SIZES: Record<ResourceTypes, { x: number; y: number }> = {
  [ResourceTypes.DOCUMENT_SPACE_NOTE]: { x: 5, y: 6 }
}

export type DesktopManagerEvents = {
  //created: (space: OasisSpace) => void
  //updated: (space: OasisSpace, changes: Partial<SpaceData>) => void
  // deleted: (spaceId: string) => void
  'changed-active-desktop': (desktop: DesktopService) => void
  'changed-desktop-background': (desktop: DesktopService) => void
}

export class DesktopManager {
  // Refs
  private readonly eventEmitter: TypedEmitter<DesktopManagerEvents>

  static self: DesktopManager
  private telemetry: Telemetry
  readonly oasis: OasisService
  tabsManager!: TabsManager
  readonly toasts: Toasts
  readonly resourceManager: ResourceManager
  private config: ConfigService
  protected colorService?: ColorService
  private miniBrowserService: MiniBrowserService
  private storage: HorizonDatabase

  // State
  protected _visible: Writable<boolean>
  get visible(): Readable<boolean> {
    return this._visible
  }
  protected _activeDesktop: Writable<DesktopService | null>
  get activeDesktop(): Readable<DesktopService | null> {
    return this._activeDesktop as Readable<DesktopService | null>
  }
  protected _activeDesktopColorScheme: Readable<Readable<DesktopBackgroundData | null>>
  get activeDesktopColorScheme(): Readable<Readable<DesktopBackgroundData | null>> {
    return this._activeDesktopColorScheme
  }
  protected _cmdVisible: Writable<boolean>
  get cmdVisible(): Readable<boolean> {
    return this._cmdVisible
  }
  activeDesktopId: Readable<string | null>
  activeDesktopVisible: Readable<boolean>

  protected loadedDesktops: Writable<Map<string, DesktopService>>
  openedDesktops: Writable<string[]>

  constructor(refs: {
    telemetry: Telemetry
    config: ConfigService
    oasis: OasisService
    toasts: Toasts
    miniBrowserService: MiniBrowserService
  }) {
    this.eventEmitter = new EventEmitter() as TypedEmitter<DesktopManagerEvents>

    this.telemetry = refs.telemetry
    this.config = refs.config
    this.oasis = refs.oasis
    this.resourceManager = this.oasis.resourceManager
    this.toasts = refs.toasts
    this.miniBrowserService = refs.miniBrowserService
    this.storage = new HorizonDatabase()

    this._visible = writable(false)
    this._activeDesktop = writable(null)
    this._cmdVisible = writable(false)

    this.loadedDesktops = writable(new Map())
    this.openedDesktops = useLocalStorageStore<string[]>('opened-desktops', [], true)

    this.activeDesktopId = derived(this._activeDesktop, (_activeDesktop) => {
      return _activeDesktop?.id ?? null
    })

    this.activeDesktopVisible = derived(
      [this.activeDesktopId, this.openedDesktops, this._visible, this._cmdVisible],
      ([activeDesktopId, openedDesktops, visible, cmdVisible]) => {
        if (cmdVisible) return true
        return visible && !!activeDesktopId && openedDesktops.includes(activeDesktopId)
      }
    )

    this._activeDesktopColorScheme = derived(this.activeDesktop, (desktop) => {
      return desktop
        ? (desktop.background_image as Readable<DesktopBackgroundData | null>)
        : (writable(null) as Readable<null>)
    })

    this.loadDefault()

    // TODO: This doesnt have unsubscribers.. thats fine? should we have them? maybe
    window.api.onResetBackgroundImage(() => {
      if (get(this.activeDesktop)) {
        const desktop = get(this.activeDesktop)
        desktop?.background_image.set(undefined)
        desktop?.store()
      }
    })
  }

  on<E extends keyof DesktopManagerEvents>(
    event: E,
    listener: DesktopManagerEvents[E]
  ): () => void {
    this.eventEmitter.on(event, listener)

    return () => {
      this.eventEmitter.off(event, listener)
    }
  }

  emit<E extends keyof DesktopManagerEvents>(
    event: E,
    ...args: Parameters<DesktopManagerEvents[E]>
  ) {
    this.eventEmitter.emit(event, ...args)
  }

  attachTabsManager(tabsManager: TabsManager) {
    this.tabsManager = tabsManager
  }
  attachColorService(colorService: ColorService) {
    this.colorService = colorService
  }

  async loadDefault() {
    let desktop = await this.useDesktop('$$default')
    if (!desktop) {
      desktop = await this.createDesktop({
        id: '$$default',
        items: []
      })
    }
    this._activeDesktop.set(desktop)
  }

  /** Used to retrieve all desktop that exist, NOTE: This doesnt not load them fully / add them to
   *  the list of loaded desktops.
   */
  async getAllDesktops(): Promise<DesktopService[]> {
    let data = await this.storage.desktop.all()
    const desktopServices = data.map(
      (d) =>
        new DesktopService(d, {
          telemetry: this.telemetry,
          desktopManager: this,
          miniBrowserService: this.miniBrowserService
        })
    )
    return desktopServices
  }

  /**
   * Returns the DesktopService given the desktop id or null if not found
   */
  async useDesktop(id: string): Promise<DesktopService | null> {
    if (get(this.loadedDesktops).has(id)) {
      return get(this.loadedDesktops).get(id) ?? null
    }

    let data = await this.storage.desktop.read(id)
    if (data === undefined) {
      return this.createDesktop({
        id,
        items: []
      })
    }

    const desktop = new DesktopService(data, {
      telemetry: this.telemetry,
      desktopManager: this,
      miniBrowserService: this.miniBrowserService
    })
    this.loadedDesktops.update((v) => {
      v.set(desktop.id, desktop)
      return v
    })

    // If not on disk, null
    return desktop
  }

  async createDesktop(data: Omit<DesktopData, 'createdAt' | 'updatedAt'>) {
    const desktop = new DesktopService(
      {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        telemetry: this.telemetry,
        desktopManager: this,
        miniBrowserService: this.miniBrowserService
      }
    )
    await desktop.store()
    this.loadedDesktops.update((v) => {
      v.set(desktop.id, desktop)
      return v
    })
    return desktop
  }
  deleteDesktop() {
    // TODO: impl
  }

  async storeDesktop(desktop: DesktopService) {
    const id = desktop.id
    const serialized = desktop.serialize()
    if (await this.storage.desktop.read(id)) this.storage.desktop.update(id, serialized)
    else this.storage.desktop.create(serialized)
  }

  async setActive(id: string) {
    let desktop = await this.useDesktop(id)
    if (!desktop) {
      desktop = await this.createDesktop({
        id,
        items: []
      })
    }

    this._activeDesktop.set(desktop)

    const shouldBeVisible = get(this.openedDesktops).includes(id)
    if (shouldBeVisible) {
      await this.setVisible(true, { desktop: id })
    }

    this.emit('changed-active-desktop', desktop)
  }

  async setVisible(
    visible: boolean,
    opts?: { trigger?: OpenHomescreenEventTrigger; desktop?: string }
  ) {
    // TODO: Timeout if visibility changed to unload old one after 5 mins & call destroy()

    if (
      this.tabsManager.unpinnedTabsValue.length <= 0 &&
      this.tabsManager.pinnedTabsValue.length <= 0 &&
      !visible
    )
      return
    if (this.tabsManager.activeTabIdValue === '' && !visible) return

    if (!visible) {
      this._cmdVisible.set(false)
    }

    const options = Object.assign(
      {
        desktop: get(this.activeDesktopId)
      },
      opts
    )

    const desktopId = options.desktop

    console.warn('[TabsService] Setting desktop visibility', visible, desktopId)

    this.openedDesktops.update((v) => {
      if (visible) {
        if (desktopId) {
          if (!v.includes(desktopId)) v.push(desktopId)
        }
      } else {
        v = v.filter((id) => id !== desktopId)
      }

      return v
    })

    if (visible === get(this._visible)) return // NOTE: Prevents many viewtransitions

    const transition = document.startViewTransition(async () => {
      this._visible.set(visible)
      await tick()
    })
    if (visible && options.trigger) {
      this.telemetry.trackOpenHomescreen(options.trigger)
    }
    return transition.finished
  }

  async setCmdVisible(visible: boolean) {
    if (visible === get(this._cmdVisible)) return // NOTE: Prevents many viewtransitions

    // If active desktop is visible, just set the cmd visible without a view transition
    if (get(this.activeDesktopVisible)) {
      this._cmdVisible.set(visible)
      return
    }

    const transition = document.startViewTransition(async () => {
      this._cmdVisible.set(visible)
      await tick()
    })

    return transition.finished
  }
}

export const provideDesktopManager = (refs: {
  telemetry: Telemetry
  config: ConfigService
  oasis: OasisService
  toasts: Toasts
  miniBrowserService: MiniBrowserService
}): DesktopManager => {
  if (!DesktopManager.self) DesktopManager.self = new DesktopManager(refs)
  return DesktopManager.self
}
export const useDesktopManager = (): DesktopManager => {
  if (!DesktopManager.self) throw 'DesktopManager not initialized!'
  return DesktopManager.self
}

export interface DesktopBackgroundData {
  resourceId: string
  colorPalette: [number, number, number][]
}

export class DesktopService {
  // Refs
  private readonly unsubscribers: (() => void)[] = []
  private telemetry: Telemetry
  private desktopManager: DesktopManager
  private log: ScopedLogger
  miniBrowser: MiniBrowser
  readonly id: string

  readonly createdAt: string
  readonly updatedAt: string

  readonly node: HTMLElement | null = null

  readonly CELL_SIZE = 50
  readonly CELL_GAP = 10

  // State
  protected readonly nodeBounds: DOMRect | null = null

  background_image: Writable<DesktopBackgroundData | undefined>
  items: Writable<Writable<DesktopItemData>[]>

  /// UI State
  protected raf: number | null = null

  /// Internal state, flushed to store each raf callback
  private _dropTargetPreviewRaw: GridRect & { visible: boolean } = {
    visible: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0
  }
  private _dropTargetPreview = writable<GridRect & { visible: boolean }>(this._dropTargetPreviewRaw)
  get gridTargetPreview(): Readable<GridRect & { visible: boolean }> {
    return this._dropTargetPreview
  }

  constructor(
    data: DesktopData,
    refs: {
      telemetry: Telemetry
      desktopManager: DesktopManager
      miniBrowserService: MiniBrowserService
    }
  ) {
    this.telemetry = refs.telemetry
    this.desktopManager = refs.desktopManager
    this.log = useLogScope('DesktopService::' + data.id)
    this.miniBrowser = refs.miniBrowserService.createScopedBrowser(data.id, true)

    this.id = data.id
    this.createdAt = data.createdAt
    this.updatedAt = data.updatedAt
    this.background_image = writable(data.background_image ?? undefined)

    this.items = writable(
      data.items.map((desktopItemData) => {
        return writable(desktopItemData)
      })
    )

    this.unsubscribers.push(
      this.resourceManager.on('deleted', (id) => {
        this.items.update((v) => {
          // @ts-ignore this is fine
          v = v.filter((e) => get(e).resourceId !== id)
          return v
        })
      })
    )
    this.unsubscribers.push(
      this.oasis.on('deleted', (id) => {
        this.items.update((v) => {
          // @ts-ignore this is fine
          v = v.filter((e) => get(e).spaceId !== id)
          return v
        })
      })
    )
  }

  /// Should be called when the desktop is unloaded / destroyed to unsubscribe from listeners
  destroy() {
    for (const f of this.unsubscribers) f()
  }

  async store() {
    this.desktopManager.storeDesktop(this)
  }

  serialize(): DesktopData {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
      background_image: get(this.background_image),
      items: (get(this.items) ?? []).map((item) => get(item))
    }
  }

  /// Whether this Desktop is currently the active one
  get isActive(): boolean {
    return get(this.desktopManager.activeDesktop)?.id === this.id
  }

  /// Whether this Desktop is currently visible (active & visible in general)
  get isVisible(): boolean {
    return (
      get(this.desktopManager.visible) && get(this.desktopManager.activeDesktop)?.id === this.id
    )
  }

  addItem() {
    // TODO: impl & move drop handler logic to call this
  }
  addResourceItem() {
    // TODO: impl
  }
  addSpaceItem() {
    // TODO: impl
  }

  removeItem(id: string) {
    this.log.debug('Removing desktop item: ' + id)
    this.items.update((items) => {
      items = items.filter((i) => get(i).id !== id)
      return items
    })
    this.store()
    this.telemetry.trackRemoveHomescreenItem(RemoveHomescreenItemEventTrigger.ContextMenu)
  }

  async setBackgroundImage(resourceOrId: Resource | string | undefined) {
    if (resourceOrId === undefined) {
      this.background_image.set(undefined)
    } else {
      let resourceId = ''
      if (typeof resourceOrId === 'string') resourceId = resourceOrId
      else resourceId = resourceOrId.id

      const colorPalette = (await this.desktopManager.colorService?.calculateImagePalette(
        resourceId
      )!)!

      // NOTE: Hacky way for now to get diff results & store in the same structure
      colorPalette.sort((a, b) => {
        return ColorService.rgbToPerceivedBrightness(b) - ColorService.rgbToPerceivedBrightness(a)
      })

      this.background_image.set({
        resourceId: `${resourceId}`,
        colorPalette
      })
    }
    this.store()
    this.telemetry.trackUpdateHomescreen(UpdateHomescreenEventAction.SetBackground)
    this.desktopManager.emit('changed-desktop-background', this)
  }

  //====  GRID CONTROLLING LOGIC

  attachNode(node: HTMLElement) {
    ;(this.node as HTMLElement) = node
    if (!this.node) return // TODO: Update on resize
    ;(this.nodeBounds as any) = this.node.getBoundingClientRect()
  }

  /*isDrawing = writable(false)
  private _drawState = {
    init: { x: 0, y: 0 },
    current: { x: 0, y: 0 }
  }*/

  /// RAF

  protected rafCbk() {
    this._dropTargetPreview.update((v) => ({
      ...this._dropTargetPreviewRaw
    }))
    this.raf = null
  }
  protected _boundRafCbk = this.rafCbk.bind(this)

  /// Event Handlers

  public handleDragEnter(drag: DragculaDragEvent<DragTypes>) {
    if (!this.node) return
    ;(this.nodeBounds as DOMRect) = this.node.getBoundingClientRect()

    const overCell = this.cellAtXY(drag.event?.x ?? 0, drag.event?.y ?? 0)
    this._dropTargetPreviewRaw.x = overCell.x
    this._dropTargetPreviewRaw.y = overCell.y

    this._dropTargetPreviewRaw.width = 3
    this._dropTargetPreviewRaw.height = 3

    this._dropTargetPreviewRaw.visible = true

    if (this.raf === null) this.raf = requestAnimationFrame(this._boundRafCbk)
  }

  public handleDragLeave(drag: DragculaDragEvent<DragTypes>) {
    this._dropTargetPreviewRaw.visible = false

    if (this.raf === null) this.raf = requestAnimationFrame(this._boundRafCbk)
  }

  public async handleDragOver(drag: DragculaDragEvent<DragTypes>) {
    const desktopItem = drag.item?.data.getData(DragTypeNames.DESKTOP_ITEM)
    const resource = await getResourceFromDrag(drag, this.resourceManager)
    let spanSize = { x: 3, y: 3 }
    let size = { x: 3 * this.CELL_SIZE, y: 3 * this.CELL_SIZE }
    if (desktopItem) {
      spanSize.x = get(desktopItem).width
      spanSize.y = get(desktopItem).height
    }
    // Use default size for resource type
    else if (resource) {
      spanSize = DEFAULT_CARD_SIZES[resource.type as ResourceTypes] ?? spanSize
    }

    this._dropTargetPreviewRaw.width = spanSize.x
    this._dropTargetPreviewRaw.height = spanSize.y

    size = {
      x: spanSize.x * this.CELL_SIZE + (spanSize.x - 1) * this.CELL_GAP,
      y: spanSize.y * this.CELL_SIZE + (spanSize.y - 1) * this.CELL_GAP
    }

    const overCell = this.cellAtXY(
      (drag.event?.x ?? 0) - size.x / 2,
      (drag.event?.y ?? 0) - size.y / 2
    )
    this._dropTargetPreviewRaw.x = clamp(overCell.x, 0, this.cellXCount)
    this._dropTargetPreviewRaw.y = clamp(overCell.y, 0, 100)

    if (this.raf === null) this.raf = requestAnimationFrame(this._boundRafCbk)
  }

  async handleDrop(drag: DragculaDragEvent<DragTypes>) {
    this._dropTargetPreviewRaw.visible = false
    if (this.raf === null) this.raf = requestAnimationFrame(this._boundRafCbk)

    if (drag.isNative) {
      await this.handleDropNative(drag)
    } else if (drag.data?.hasData(DragTypeNames.DESKTOP_ITEM)) {
      const item = drag.data?.getData(DragTypeNames.DESKTOP_ITEM)
      await this.handleDropDesktopItem(drag, item)
      this.telemetry.trackUpdateHomescreen(UpdateHomescreenEventAction.MoveItem)
    } else if (
      drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE) ||
      drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE) ||
      drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE_ID)
    ) {
      let resource: Resource | null = await getResourceFromDrag(drag, this.resourceManager)

      if (resource === null) {
        console.warn('Dropped resource but resource is null! Aborting drop!')
        drag.abort()
        return
      }

      // Make resource visible if it was silent
      const isSilent = (resource.tags ?? []).some(
        (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
      )

      if (isSilent) {
        await this.resourceManager.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.SILENT)
        this.oasis.reloadStack()
      }

      await this.handleDropResource(drag, resource)
      this.telemetry.trackAddHomescreenItem(
        AddHomescreenItemEventTrigger.Drop,
        'resource',
        this.getDropSource(drag)
      )
    } else if (drag.data?.hasData(DragTypeNames.SURF_SPACE)) {
      const space = drag.data?.getData(DragTypeNames.SURF_SPACE)
      await this.handleDropSpace(drag, space)
      this.telemetry.trackAddHomescreenItem(
        AddHomescreenItemEventTrigger.Drop,
        'space',
        this.getDropSource(drag)
      )
    } else if (drag.data?.hasData(DragTypeNames.SURF_TAB)) {
      // NOTE: We already checked for resource so we force save the tab in this case as no resource
      // is attached
      const tab = drag.data.getData(DragTypeNames.SURF_TAB)
      // TODO: We dont have any way to easily call a function & get the resource crated :')
      // All just dispatched to Browser.svelte but cannot get resource returnd
      // We should have this common behavior in some service
      await this.handleDropTab(drag, tab)
      this.telemetry.trackAddHomescreenItem(
        AddHomescreenItemEventTrigger.Drop,
        'resource',
        this.getDropSource(drag)
      )
    }
    drag.continue()
    this.store()
  }

  private getDropSource(
    drag: DragculaDragEvent<DragTypes>
  ): AddHomescreenItemEventSource | undefined {
    if (drag.isNative) return AddHomescreenItemEventSource.NativeDrop
    else if (drag.from?.id.startsWith('drawer')) return AddHomescreenItemEventSource.Stuff
    else if (drag.from?.id.startsWith('sidebar')) return AddHomescreenItemEventSource.Tabs
    else if (drag.from?.id.startsWith('stuff-stack')) return AddHomescreenItemEventSource.Stack
    else if (drag.from?.id.startsWith('magic-chat')) return AddHomescreenItemEventSource.Chat
    // TODO: command menu when we allow dragigng from there
    return undefined
  }

  private async handleDropNative(drag: DragculaDragEvent<DragTypes>) {
    const parsed = await processDrop(drag.event!)
    this.log.debug('Parsed', parsed)

    const newResources = await createResourcesFromMediaItems(this.resourceManager, parsed, '')
    this.log.debug('Resources', newResources)

    this.items.update((items) => {
      for (const resource of newResources) {
        items.push(
          writable({
            ...this._dropTargetPreviewRaw,
            z: Date.now(),
            id: crypto.randomUUID(),
            type: 'resource',
            resourceId: resource.id
          })
        )

        this.telemetry.trackAddHomescreenItem(
          AddHomescreenItemEventTrigger.Drop,
          'resource',
          this.getDropSource(drag)
        )
        this.telemetry.trackSaveToOasis(
          resource.type,
          SaveToOasisEventTrigger.Drop,
          false,
          EventContext.Homescreen
        )
      }
      return items
    })

    drag.continue()
  }
  private async handleDropDesktopItem(
    drag: DragculaDragEvent<DragTypes>,
    item: Writable<DesktopItemData>
  ) {
    this.items.update((items) => {
      const data = items.find((i) => get(i).id === get(item).id)
      if (!data) throw 'UNEXPECTED: DesktopItem not found in DesktopServiece.items'
      data.update((v) => ({
        ...v,
        x: this._dropTargetPreviewRaw.x,
        y: this._dropTargetPreviewRaw.y,
        width: this._dropTargetPreviewRaw.width,
        height: this._dropTargetPreviewRaw.height,
        z: Date.now()
      }))
      return items
    })
  }
  private async handleDropResource(drag: DragculaDragEvent<DragTypes>, resource: Resource) {
    if (this.id !== '$$default') {
      const space = await this.oasis.getSpace(this.id)
      if (space) {
        await this.oasis.addResourcesToSpace(
          space.id,
          [resource.id],
          SpaceEntryOrigin.ManuallyAdded
        )
        this.telemetry.trackAddResourceToSpace(
          resource.type,
          AddResourceToSpaceEventTrigger.DropHomescreen,
          false
        )
      }
    }

    this.items.update((items) => {
      items.push(
        writable({
          id: crypto.randomUUID(),
          ...this._dropTargetPreviewRaw,
          z: Date.now(),
          type: 'resource',
          resourceId: resource.id
        })
      )
      return items
    })
  }
  private async handleDropSpace(drag: DragculaDragEvent<DragTypes>, space: OasisSpace) {
    this.items.update((items) => {
      items.push(
        writable({
          id: crypto.randomUUID(),
          ...this._dropTargetPreviewRaw,
          z: Date.now(),
          type: 'space',
          spaceId: space.id,
          viewLayout: 'masonry'
        })
      )
      return items
    })
  }
  private async handleDropTab(drag: DragculaDragEvent<DragTypes>, tab: Tab) {
    if (!get(this.tabsManager.activatedTabs).includes(tab.id)) {
      this.desktopManager.tabsManager.activatedTabs.update((tabs) => {
        return [...tabs, tab.id]
      })

      // give the tab some time to load
      await wait(200)
    }
    const browserTab = get(this.tabsManager.browserTabs)[tab.id]
    if (!browserTab) {
      this.log.error('Browser tab not found', tab.id)
      throw Error(`Browser tab not found`)
    }

    const toast = this.desktopManager.toasts.loading('Pinning item to homescreen...')
    let resource: Resource
    try {
      resource = await browserTab.bookmarkPage({
        freshWebview: true,
        silent: true
      })
    } catch (e) {
      toast.dismiss()
      this.toasts.error('Failed to pin item to homescreen')
      throw e
    }
    toast.dismiss()

    if (this.id !== '$$default') {
      const space = await this.oasis.getSpace(this.id)
      if (space) {
        await this.oasis.addResourcesToSpace(
          space.id,
          [resource.id],
          SpaceEntryOrigin.ManuallyAdded
        )
        this.telemetry.trackAddResourceToSpace(
          resource.type,
          AddResourceToSpaceEventTrigger.DropHomescreen,
          false
        )
      }
    }

    this.telemetry.trackSaveToOasis(resource.type, SaveToOasisEventTrigger.Homescreen, false)

    this.items.update((items) => {
      items.push(
        writable({
          id: crypto.randomUUID(),
          ...this._dropTargetPreviewRaw,
          z: Date.now(),
          type: 'resource',
          resourceId: resource.id
        })
      )
      return items
    })
  }

  public handleMouseDown(e: MouseEvent) {
    /*if ((e.target as HTMLElement) !== this.node) return

    this._drawState.init = { x: e.clientX, y: e.clientY }

    window.addEventListener('mousemove', this._boundHandleMouseMove, { capture: true })
    window.addEventListener('mouseup', this._boundHandleMouseUp, { once: true, capture: true })
    this.isDrawing.set(true)*/
  }

  protected handleMouseMove(e: MouseEvent) {
    /* this._drawState.current = { x: e.clientX, y: e.clientY }

    const start = {
      x: Math.min(this._drawState.init.x, this._drawState.current.x),
      y: Math.min(this._drawState.init.y, this._drawState.current.y)
    }
    const startCell = this.cellAtXY(start.x, start.y)

    const end = {
      x: Math.max(this._drawState.init.x, this._drawState.current.x),
      y: Math.max(this._drawState.init.y, this._drawState.current.y)
    }
    const endCell = this.cellAtXY(end.x, end.y)

    this._dropTargetPreviewRaw.cellX = startCell.x
    this._dropTargetPreviewRaw.cellY = startCell.y

    this._dropTargetPreviewRaw.spanX = endCell.x - startCell.x
    this._dropTargetPreviewRaw.spanY = endCell.y - startCell.y

    this._dropTargetPreviewRaw.visible = true

    if (this.raf === null) this.raf = requestAnimationFrame(this._boundRafCbk)*/
  }
  protected handleMouseUp(e: MouseEvent) {
    /*this.isDrawing.set(false)
    this._dropTargetPreviewRaw.visible = false
    if (this.raf === null) this.raf = requestAnimationFrame(this._boundRafCbk)
    window.removeEventListener('mousemove', this._boundHandleMouseMove, { capture: true })

    if (
      e.button !== 0 ||
      this._dropTargetPreviewRaw.spanX <= 0 ||
      this._dropTargetPreviewRaw.spanY <= 0
    )
      return

    this.node.dispatchEvent(
      new CustomEvent('drawend', {
        detail: {
          cellX: this._dropTargetPreviewRaw.cellX,
          cellY: this._dropTargetPreviewRaw.cellY,
          spanX: this._dropTargetPreviewRaw.spanX,
          spanY: this._dropTargetPreviewRaw.spanY
        },
        bubbles: false
      })
    )

    this._dropTargetPreviewRaw.x = 0
    this._dropTargetPreviewRaw.y = 0
    this._dropTargetPreviewRaw.width = 0
    this._dropTargetPreviewRaw.height = 0*/
  }
  protected _boundHandleMouseMove = this.handleMouseMove.bind(this)
  protected _boundHandleMouseUp = this.handleMouseUp.bind(this)

  /// Utils

  get cellXCount(): number {
    if (!this.node) return -1
    return Math.floor(this.node.clientWidth / (this.CELL_SIZE + this.CELL_GAP))
  }

  /**
   * Converts a GridRect into absolute units. NOTE: xy are not absolute coordinated relative to the
   * Viewport, but relative to the grid origin.
   */
  rectToAbsolute(rect: GridRect): { x: number; y: number; width: number; height: number } {
    return {
      x: rect.x * (this.CELL_SIZE + this.CELL_GAP),
      y: rect.y * (this.CELL_SIZE + this.CELL_GAP),
      width: rect.width * (this.CELL_SIZE + this.CELL_GAP) - this.CELL_GAP,
      height: rect.height * (this.CELL_SIZE + this.CELL_GAP) - this.CELL_GAP
    }
  }

  /**
   * Converts an absolute viewport xy coord into a cell inside the grid.
   */
  cellAtXY(x: number, y: number): Vec2<number> {
    x = x - this.nodeBounds!.left
    y = y - this.nodeBounds!.top
    return {
      x: Math.round((x - this.CELL_GAP) / (this.CELL_SIZE + this.CELL_GAP) + 1),
      y: Math.round((y - this.CELL_GAP) / (this.CELL_SIZE + this.CELL_GAP) + 1)
    }
  }

  xyAtCell(cellX: number, cellY: number): Vec2<number> {
    // TODO: Check if we need this offset here as well
    cellX += 1
    cellY += 1
    return {
      x: this.nodeBounds!.left + cellX * (this.CELL_SIZE + this.CELL_GAP),
      y: this.nodeBounds!.top + cellY * (this.CELL_SIZE + this.CELL_GAP)
    }
  }

  // Passthrough utils
  get tabsManager() {
    return this.desktopManager.tabsManager
  }
  get oasis() {
    return this.desktopManager.oasis
  }
  get resourceManager() {
    return this.desktopManager.resourceManager
  }
  get toasts() {
    return this.desktopManager.toasts
  }
}
