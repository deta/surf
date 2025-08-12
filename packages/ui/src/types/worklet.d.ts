declare function registerPaint(name: string, paintClass: { new (): any }): void
declare function registerLayout(name: string, layoutClass: { new (): any }): void

interface PaintSize {
  width: number
  height: number
}

interface PaintRenderingContext2D extends CanvasRenderingContext2D {
  // Add any additional Paint Worklet specific context methods here if needed
}

interface StylePropertyMapReadOnly {
  get(property: string): any
  getAll(property: string): any[]
  has(property: string): boolean
  entries(): IterableIterator<[string, any]>
  keys(): IterableIterator<string>
  values(): IterableIterator<any>
  forEach(callback: (value: any, key: string, map: StylePropertyMapReadOnly) => void): void
}
