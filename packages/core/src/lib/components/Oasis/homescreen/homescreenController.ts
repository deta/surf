import { get, writable, type Readable, type Writable } from 'svelte/store'
import type { DragculaDragEvent, Vec2 } from '../../../../../../dragcula/dist'
import { DragTypeNames, type DragTypes, type Tab } from '../../../types'
import type { Resource, ResourceManager } from '../../../service/resources'
import type { OasisService, OasisSpace } from '../../../service/oasis'
import { createResourcesFromMediaItems, processDrop } from '../../../service/mediaImporter'
import log from '@horizon/utils/src/log'
import {
  AddHomescreenItemEventSource,
  AddHomescreenItemEventTrigger,
  EventContext,
  ResourceTagsBuiltInKeys,
  ResourceTypes,
  SaveToOasisEventTrigger,
  UpdateHomescreenEventAction
} from '@horizon/types'
import type { Telemetry } from '../../../service/telemetry'
import type { TabsManager } from '../../../service/tabs'
import type { Toasts } from '../../../service/toast'
import { wait } from '@horizon/utils'
import type { BentoItem } from './BentoController'
import { getResourceFromDrag } from '../../../utils/draganddrop'

export interface HomescreenItemData {
  id: string
  cellX: number
  cellY: number
  spanX: number
  spanY: number
  zIndex: number

  type: 'resource' | 'space' | 'teletype_action'
}

export interface HomescreenConfig<TItem extends Writable<HomescreenItemData>> {
  gap?: number
  cellSize?: number

  itemStore: Writable<TItem[]>
}

export interface GridRect {
  cellX: number
  cellY: number
  spanX: number
  spanY: number
}

const DEFAULT_CARD_SIZES: Record<ResourceTypes, { x: number; y: number }> = {
  [ResourceTypes.DOCUMENT_SPACE_NOTE]: { x: 5, y: 6 }
}

export class HomescreenController {
  readonly telemetry: Telemetry
  readonly oasis: OasisService
  readonly tabsManager: TabsManager
  readonly toasts: Toasts
  readonly resourceManager: ResourceManager
  readonly node: HTMLElement

  /// CFG

  readonly PADDING: Vec2<number> = { x: 0, y: 0 }
  readonly GAP: number = 10
  readonly CELL_SIZE: number = 200

  protected raf: number | null = null

  items: Writable<Writable<HomescreenItemData>[]>

  /// State

  private nodeBounds: DOMRect | null = null

  /// Internal state, flushed to store each raf callback
  private _dropTargetPreviewRaw: GridRect & { visible: boolean } = {
    visible: false,
    cellX: 0,
    cellY: 0,
    spanX: 0,
    spanY: 0
  }
  private _dropTargetPreview = writable<GridRect & { visible: boolean }>(this._dropTargetPreviewRaw)
  get gridTargetPreview(): Readable<GridRect & { visible: boolean }> {
    return this._dropTargetPreview
  }

  isDrawing = writable(false)
  private _drawState = {
    init: { x: 0, y: 0 },
    current: { x: 0, y: 0 }
  }

  constructor(
    node: HTMLElement,
    config: HomescreenConfig<Writable<HomescreenItemData>>,
    oasis: OasisService,
    tabsManager: TabsManager,
    toasts: Toasts,
    telemetry: Telemetry
  ) {
    this.telemetry = telemetry
    this.oasis = oasis
    this.tabsManager = tabsManager
    this.toasts = toasts
    this.resourceManager = oasis.resourceManager
    this.node = node
    //this.node.homescreenController = this;
    this.GAP = config.gap ?? this.GAP
    this.CELL_SIZE = config.cellSize ?? this.CELL_SIZE
    this.items = config.itemStore

    this.node.style.display = 'grid'
    this.node.style.gridTemplateColumns = `repeat(auto-fill, minmax(${this.CELL_SIZE}px, ${this.CELL_SIZE}px))`
    this.node.style.gridAutoRows = `${this.CELL_SIZE}px`
    this.node.style.gap = `${this.GAP}px`

    this.nodeBounds = this.node.getBoundingClientRect()
  }

  /// RAF

  protected rafCbk() {
    this._dropTargetPreview.update((v) => {
      v.visible = this._dropTargetPreviewRaw.visible
      v.cellX = this._dropTargetPreviewRaw.cellX
      v.cellY = this._dropTargetPreviewRaw.cellY
      v.spanX = this._dropTargetPreviewRaw.spanX
      v.spanY = this._dropTargetPreviewRaw.spanY
      return v
    })
    this.raf = null
  }
  protected _boundRafCbk = this.rafCbk.bind(this)

  /// Event Handlers

  public handleDragEnter(drag: DragculaDragEvent<DragTypes>) {
    this.nodeBounds = this.node.getBoundingClientRect()

    const overCell = this.cellAtXY(drag.event?.x ?? 0, drag.event?.y ?? 0)
    this._dropTargetPreviewRaw.cellX = overCell.x
    this._dropTargetPreviewRaw.cellY = overCell.y

    this._dropTargetPreviewRaw.spanX = 3
    this._dropTargetPreviewRaw.spanY = 3

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
      spanSize.x = get(desktopItem).spanX
      spanSize.y = get(desktopItem).spanY
    }
    // Use default size for resource type
    else if (resource) {
      spanSize = DEFAULT_CARD_SIZES[resource.type as ResourceTypes] ?? spanSize
    }

    this._dropTargetPreviewRaw.spanX = spanSize.x
    this._dropTargetPreviewRaw.spanY = spanSize.y

    size = {
      x: spanSize.x * this.CELL_SIZE + (spanSize.x - 1) * this.GAP,
      y: spanSize.y * this.CELL_SIZE + (spanSize.y - 1) * this.GAP
    }

    const overCell = this.cellAtXY(
      (drag.event?.x ?? 0) - size.x / 2,
      (drag.event?.y ?? 0) - size.y / 2
    )
    this._dropTargetPreviewRaw.cellX = overCell.x
    this._dropTargetPreviewRaw.cellY = overCell.y

    if (this.raf === null) this.raf = requestAnimationFrame(this._boundRafCbk)
  }

  async handleDrop(drag: DragculaDragEvent<DragTypes>) {
    this._dropTargetPreviewRaw.visible = false
    if (this.raf === null) this.raf = requestAnimationFrame(this._boundRafCbk)

    if (drag.isNative) {
      await this.handleDropNative(drag)
    } else if (drag.data?.hasData(DragTypeNames.DESKTOP_ITEM)) {
      const item = drag.data?.getData(DragTypeNames.DESKTOP_ITEM)
      await this.handleDropBentoItem(drag, item)
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
    log.debug('Parsed', parsed)

    const newResources = await createResourcesFromMediaItems(this.resourceManager, parsed, '')
    log.debug('Resources', newResources)

    this.items.update((items) => {
      for (const resource of newResources) {
        items.push(
          writable({
            id: crypto.randomUUID(),
            cellX: this._dropTargetPreviewRaw.cellX,
            cellY: this._dropTargetPreviewRaw.cellY,
            spanX: this._dropTargetPreviewRaw.spanX,
            spanY: this._dropTargetPreviewRaw.spanY,
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
  private async handleDropBentoItem(drag: DragculaDragEvent<DragTypes>, item: Writable<BentoItem>) {
    this.items.update((items) => {
      const data = items.find((i) => get(i).id === get(item).id)
      if (!data) throw 'UNEXPECTED: DesktopItem not found in HomescreenController.items'
      const { cellX, cellY, spanX, spanY } = this._dropTargetPreviewRaw
      data.update((v) => {
        v.cellX = cellX
        v.cellY = cellY
        v.spanX = spanX
        v.spanY = spanY
        return v
      })
      return items
    })
  }
  private async handleDropResource(drag: DragculaDragEvent<DragTypes>, resource: Resource) {
    const { cellX, cellY, spanX, spanY } = this._dropTargetPreviewRaw
    this.items.update((items) => {
      items.push(
        writable({
          id: crypto.randomUUID(),
          cellX,
          cellY,
          spanX,
          spanY,
          resourceId: resource.id
        })
      )
      return items
    })
  }
  private async handleDropSpace(drag: DragculaDragEvent<DragTypes>, space: OasisSpace) {
    const { cellX, cellY, spanX, spanY } = this._dropTargetPreviewRaw
    this.items.update((items) => {
      items.push(
        writable({
          id: crypto.randomUUID(),
          cellX,
          cellY,
          spanX,
          spanY,
          spaceId: space.id
        })
      )
      return items
    })
  }
  private async handleDropTab(drag: DragculaDragEvent<DragTypes>, tab: Tab) {
    if (!get(this.tabsManager.activatedTabs).includes(tab.id)) {
      this.tabsManager.activatedTabs.update((tabs) => {
        return [...tabs, tab.id]
      })

      // give the tab some time to load
      await wait(200)
    }
    const browserTab = get(this.tabsManager.browserTabs)[tab.id]
    if (!browserTab) {
      log.error('Browser tab not found', tab.id)
      throw Error(`Browser tab not found`)
    }

    const toast = this.toasts.loading('Pinning item to homescreen...')
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

    this.telemetry.trackSaveToOasis(resource.type, SaveToOasisEventTrigger.Homescreen, false)

    const { cellX, cellY, spanX, spanY } = this._dropTargetPreviewRaw

    this.items.update((items) => {
      items.push(
        writable({
          id: crypto.randomUUID(),
          cellX,
          cellY,
          spanX,
          spanY,
          resourceId: resource.id
        })
      )
      return items
    })
  }

  public handleMouseDown(e: MouseEvent) {
    if ((e.target as HTMLElement) !== this.node) return

    this._drawState.init = { x: e.clientX, y: e.clientY }

    window.addEventListener('mousemove', this._boundHandleMouseMove, { capture: true })
    window.addEventListener('mouseup', this._boundHandleMouseUp, { once: true, capture: true })
    this.isDrawing.set(true)
  }

  protected handleMouseMove(e: MouseEvent) {
    this._drawState.current = { x: e.clientX, y: e.clientY }

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

    if (this.raf === null) this.raf = requestAnimationFrame(this._boundRafCbk)
  }
  protected handleMouseUp(e: MouseEvent) {
    this.isDrawing.set(false)
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

    this._dropTargetPreviewRaw.cellX = 0
    this._dropTargetPreviewRaw.cellY = 0
    this._dropTargetPreviewRaw.spanX = 0
    this._dropTargetPreviewRaw.spanY = 0
  }
  protected _boundHandleMouseMove = this.handleMouseMove.bind(this)
  protected _boundHandleMouseUp = this.handleMouseUp.bind(this)

  /// Utils

  get cellXCount(): number {
    return Math.floor(this.node.clientWidth / (this.CELL_SIZE + this.GAP))
  }

  /**
   * Converts a GridRect into absolute units. NOTE: xy are not absolute coordinated relative to the
   * Viewport, but relative to the grid origin.
   */
  rectToAbsolute(rect: GridRect): { x: number; y: number; width: number; height: number } {
    return {
      x: rect.cellX * (this.CELL_SIZE + this.GAP),
      y: rect.cellY * (this.CELL_SIZE + this.GAP),
      width: rect.spanX * (this.CELL_SIZE + this.GAP) - this.GAP,
      height: rect.spanY * (this.CELL_SIZE + this.GAP) - this.GAP
    }
  }

  /**
   * Converts an absolute viewport xy coord into a cell inside the grid.
   */
  cellAtXY(x: number, y: number): Vec2<number> {
    x = x - this.nodeBounds!.left
    y = y - this.nodeBounds!.top
    return {
      x: Math.round((x - this.GAP) / (this.CELL_SIZE + this.GAP) + 1),
      y: Math.round((y - this.GAP) / (this.CELL_SIZE + this.GAP) + 1)
    }
  }

  xyAtCell(cellX: number, cellY: number): Vec2<number> {
    // TODO: Check if we need this offset here as well
    cellX += 1
    cellY += 1
    return {
      x: this.nodeBounds!.left + cellX * (this.CELL_SIZE + this.GAP),
      y: this.nodeBounds!.top + cellY * (this.CELL_SIZE + this.GAP)
    }
  }
}
