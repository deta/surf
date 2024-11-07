import type { ActionReturn } from 'svelte/action'
import { clamp } from '../../../../../../dragcula/dist/utils/internal'
import { get, type Subscriber, type Writable } from 'svelte/store'
import type { Vec2 } from '../../../../../../dragcula/dist'

export interface BentoConfig<
  Item extends Writable<{ id: string; cellX: number; cellY: number; spanX: number; spanY: number }>
> {
  height: number
  GAP: number
  CELL_SIZE: number

  items: Writable<Item[]>
}

export class BentoController<
  Item extends Writable<{ id: string; cellX: number; cellY: number; spanX: number; spanY: number }>
> {
  //
  // === REFS

  readonly node: HTMLElement

  // === STATE

  readonly PADDING: Vec2<number>
  readonly GAP: number
  readonly CELL_SIZE: number

  protected raf: number | null = null

  /// Drop Preview
  protected dropPreview = {
    elRef: HTMLElement,
    visible: false,
    cellX: 0,
    cellY: 0,
    spanX: 0,
    spanY: 0
  }

  items: Writable<Item[]>

  protected constructor(node: HTMLElement, config: BentoConfig<Item>) {
    this.node = node
    this.node.bentoController = this

    this.PADDING = {
      x: 0, //parseFloat(window.getComputedStyle(this.node, null).getPropertyValue('padding-left')),
      y: 0 //parseFloat(window.getComputedStyle(this.node, null).getPropertyValue('padding-top'))
    }
    this.GAP = config.GAP
    this.CELL_SIZE = config.CELL_SIZE

    this.node.style.display = 'grid'
    this.node.style.gridTemplateColumns = `repeat(auto-fill, minmax(${this.CELL_SIZE}px, ${this.CELL_SIZE}px))`
    //this.node.style.padding = `${this.PADDING}px`
    this.node.style.gridAutoRows = `${this.CELL_SIZE}px`
    this.node.style.gap = `${this.GAP}px`

    this.items = config.items

    /*this.node.addEventListener('mousemove', (e) =>
      console.warn(this.getCellAt(e.clientX, e.clientY))
    )*/
  }

  static action(node: HTMLElement, props: { config: BentoConfig }): ActionReturn {
    const controller = new BentoController(node, props.config)

    return {
      destroy() {
        console.log('destroy bento')
      },
      update(props: any) {
        console.log('update bento', props)
      }
    }
  }

  /** Return the number of available cells in the X axis */
  public getCellXCount(): number {
    // TODO: cache & invalidate on resize
    return Math.floor(this.node.clientWidth / (this.CELL_SIZE + this.GAP))
  }

  /**
   * Get the cell at the given GLOBAL coordinates with 0-based-indexing.
   */
  public getCellAt(x: number, y: number): { cellX: number; cellY: number } | null {
    x = x - this.PADDING.x
    y = y - this.PADDING.y
    const cellPlusGap = this.CELL_SIZE + this.GAP
    const rect = this.node.getBoundingClientRect() // TODO: cache & invalidate on resize
    const localX = x - rect.left + this.PADDING.x
    const localY = y - rect.top + this.PADDING.y
    const col = Math.floor(localX / cellPlusGap)
    const row = Math.floor(localY / cellPlusGap)
    const cellX = clamp(col, 0, this.getCellXCount())
    const cellY = clamp(row, 0, 1000)

    return { cellX, cellY }
  }

  /**
   * Get the GLOBAL coordinates of the cell at the given cell coordinates with 0-based-indexing.
   */
  public getXYAt(cellX: number, cellY: number): { x: number; y: number } {
    const rect = this.node.getBoundingClientRect() // TODO: cache & invalidate on resize
    const cellPlusGap = this.CELL_SIZE + this.GAP
    return {
      x: rect.left + this.PADDING.x + cellX * cellPlusGap,
      y: rect.top + this.PADDING.y + cellY * cellPlusGap
    }
  }

  /**
   * Iterates all items from left to right, top to bottom and if an overlap is found,
   * try to resolve it by moving the item to the left, if possible, or to the right.
   * if an item is over the cell column limit of 8, try to move it to the next row.
   */
  public reflowItems(items: Item[]) {
    // TODO: IMPL
  }

  /// ==== CALLBACKS

  /// ==== RAF

  protected rafCbk(_: number) {
    this.raf = null
  }
  protected boundRafCbk = this.rafCbk.bind(this)
}

export interface BentoItemData {
  id: string
  cellX: number
  cellY: number
  spanX?: number
  spanY?: number
}
export class BentoItem {
  // === REFS

  private readonly node: HTMLElement
  private readonly _controller: BentoController
  get controller(): BentoController<any> | null {
    if (this._controller) return this._controller
    let parent = this.node.parentElement
    while (parent && !parent.bentoController) {
      parent = parent.parentElement
    }
    this._controller = parent?.bentoController
    return this._controller
  }

  private readonly destroyCallbacks: Subscriber<BentoItemData>[] = []

  // === STATE

  #rafCbk: number | null = null

  readonly id: string
  readonly data: Writable<BentoItemData>

  #cellX: number
  #cellY: number
  #spanX: number
  #spanY: number

  get cellX() {
    return this.#cellX
  }
  get cellY() {
    return this.#cellY
  }
  get spanX() {
    return this.#spanX
  }
  get spanY() {
    return this.#spanY
  }

  set cellX(value: number) {
    this.#cellX = value
    this.saveData()
  }
  set cellY(value: number) {
    this.#cellY = value
    this.saveData()
  }
  set spanX(value: number) {
    this.#spanX = value
    this.saveData()
  }
  set spanY(value: number) {
    this.#spanY = value
    this.saveData()
  }

  protected constructor(node: HTMLElement, data: Writable<BentoItemData>) {
    this.node = node
    this.node.bentoItem = this

    this.data = data
    const _data = get(data)
    this.id = _data.id
    this.#cellX = _data.cellX
    this.#cellY = _data.cellY
    this.#spanX = _data.spanX ?? 2
    this.#spanY = _data.spanY ?? 2

    //this.destroyCallbacks.push(data.subscribe(this.applyData.bind(this)))
    //data.subscribe(this.applyData.bind(this))

    this.queueRaf()
  }

  static action(node: HTMLElement, props: { data: Writable<BentoItemData> }): ActionReturn {
    const controller = new BentoItem(node, props.data)

    return {
      destroy() {
        console.log('destroy bentoItem')
        controller.destroy()
      },
      update(props: any) {
        console.log('update bentoItem', props)
      }
    }
  }

  destroy() {
    const data = get(this.data)
    //this.destroyCallbacks.forEach((cb) => cb(data))
    cancelAnimationFrame(this.#rafCbk!)
  }

  applyData(data: BentoItemData) {
    this.#cellX = data.cellX
    this.#cellY = data.cellY
    this.#spanX = data.spanX ?? 2
    this.#spanY = data.spanY ?? 2

    this.queueRaf()
  }

  saveData() {
    this.data.update((data) => {
      data.cellX = this.#cellX
      data.cellY = this.#cellY
      data.spanX = this.#spanX
      data.spanY = this.#spanY
      return data
    })
    this.queueRaf()
  }

  /// === RAF

  rafCbk(_: number) {
    this.node.style.gridColumn = `${this.#cellX + 1} / span ${this.#spanX}`
    this.node.style.gridRow = `${this.#cellY + 1} / span ${this.#spanY}`
    this.#rafCbk = null
  }
  boundRafCbk = this.rafCbk.bind(this)

  // === GETTERS

  // Math utils
  get xyTopLeft(): Vec2<number> | null {
    const xy = this.controller?.getXYAt(this.cellX, this.cellY)
    if (!xy) return null
    return {
      x: xy.x,
      y: xy.y
    }
  }
  get width(): number {
    return this.spanX * this.controller.CELL_SIZE + (this.spanX - 1) * this.controller.GAP
  }
  get height(): number {
    return this.spanY * this.controller.CELL_SIZE + (this.spanY - 1) * this.controller.GAP
  }

  /// === UTILS

  queueRaf() {
    if (this.#rafCbk) return
    this.#rafCbk = requestAnimationFrame(this.boundRafCbk)
  }
}
