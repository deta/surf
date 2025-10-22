import type { EditorView } from 'prosemirror-view'

export interface DebugData {
  mouseEvent: { x: number; y: number }
  targetNode: string
  nodeText: string
  editorWrapper: {
    element: string
    scrollTop: number
    scrollLeft: number
    bounds: DOMRect | undefined
  }
  positioning: {
    nodeBounds: DOMRect
    wrapperBounds: DOMRect | undefined
    originalRect: { top: number; left: number; width: number }
    adjustedRect: { top: number; left: number; width: number }
    finalPosition: { left: number; top: number }
  }
  computedStyle: {
    lineHeight: number
    paddingTop: number
  }
  dragHandleWidth: number
}

export class DragHandleDebugTools {
  private debugOverlay: HTMLElement | null = null
  private boundsVisualizer: HTMLElement | null = null
  private isEnabled: boolean = true

  constructor(private container: Element) {
    this.createDebugElements()
  }

  private createDebugElements() {
    // Create debug overlay
    this.debugOverlay = document.createElement('div')
    this.debugOverlay.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px;
      font-family: monospace;
      font-size: 11px;
      z-index: 1000;
      border-radius: 6px;
      min-width: 350px;
      max-width: 400px;
      display: none;
      pointer-events: none;
      line-height: 1.3;
      border: 1px solid #444;
    `
    this.container.appendChild(this.debugOverlay)

    // Create bounds visualizer
    this.boundsVisualizer = document.createElement('div')
    this.boundsVisualizer.style.cssText = `
      position: absolute;
      border: 2px solid red;
      background: rgba(255, 0, 0, 0.1);
      pointer-events: none;
      z-index: 999;
      display: none;
    `
    this.container.appendChild(this.boundsVisualizer)
  }

  show() {
    if (!this.isEnabled) return

    if (this.debugOverlay) {
      this.debugOverlay.style.display = 'block'
    }

    if (this.boundsVisualizer) {
      this.boundsVisualizer.style.display = 'block'
    }
  }

  hide() {
    if (this.debugOverlay) {
      this.debugOverlay.style.display = 'none'
    }

    if (this.boundsVisualizer) {
      this.boundsVisualizer.style.display = 'none'
    }
  }

  updateDebugInfo(data: DebugData) {
    if (!this.isEnabled || !this.debugOverlay) return

    this.debugOverlay.innerHTML = `
      <div><strong>🐛 DRAG HANDLE DEBUG</strong></div>
      <div><strong>MOUSE:</strong> (${data.mouseEvent.x}, ${data.mouseEvent.y})</div>
      <div><strong>TARGET:</strong> ${data.targetNode}</div>
      <div><strong>TEXT:</strong> "${data.nodeText}"</div>
      <div style="border-top: 1px solid #666; margin: 5px 0; padding-top: 5px;"></div>
      <div><strong>SCROLL CONTAINER:</strong></div>
      <div>Element: ${data.editorWrapper.element}</div>
      <div>ScrollTop: ${data.editorWrapper.scrollTop}px</div>
      <div>ScrollLeft: ${data.editorWrapper.scrollLeft}px</div>
      <div style="border-top: 1px solid #666; margin: 5px 0; padding-top: 5px;"></div>
      <div><strong>ELEMENT BOUNDS (viewport):</strong></div>
      <div>Node: (${data.positioning.nodeBounds.left.toFixed(1)}, ${data.positioning.nodeBounds.top.toFixed(1)}) ${data.positioning.nodeBounds.width.toFixed(1)}×${data.positioning.nodeBounds.height.toFixed(1)}</div>
      <div>Wrapper: (${data.positioning.wrapperBounds?.left.toFixed(1) || 0}, ${data.positioning.wrapperBounds?.top.toFixed(1) || 0}) ${data.positioning.wrapperBounds?.width.toFixed(1) || 0}×${data.positioning.wrapperBounds?.height.toFixed(1) || 0}</div>
      <div style="border-top: 1px solid #666; margin: 5px 0; padding-top: 5px;"></div>
      <div><strong>POSITIONING:</strong></div>
      <div>Raw Calc: (${data.positioning.originalRect.left.toFixed(1)}, ${data.positioning.originalRect.top.toFixed(1)})</div>
      <div>With Adjustments: (${data.positioning.adjustedRect.left.toFixed(1)}, ${data.positioning.adjustedRect.top.toFixed(1)})</div>
      <div><strong>FINAL HANDLE POS:</strong> (${data.positioning.finalPosition.left.toFixed(1)}, ${data.positioning.finalPosition.top.toFixed(1)})</div>
      <div style="border-top: 1px solid #666; margin: 5px 0; padding-top: 5px;"></div>
      <div>LineHeight: ${data.computedStyle.lineHeight}px, Padding: ${data.computedStyle.paddingTop}px</div>
      <div>Handle Width: ${data.dragHandleWidth}px</div>
    `
  }

  updateBoundsVisualizer(targetBounds: DOMRect, wrapperBounds: DOMRect | undefined) {
    if (!this.isEnabled || !this.boundsVisualizer || !wrapperBounds) return

    this.boundsVisualizer.style.left = `${targetBounds.left - wrapperBounds.left}px`
    this.boundsVisualizer.style.top = `${targetBounds.top - wrapperBounds.top}px`
    this.boundsVisualizer.style.width = `${targetBounds.width}px`
    this.boundsVisualizer.style.height = `${targetBounds.height}px`
  }

  logAbsoluteRect(data: {
    nodeBounds: DOMRect
    wrapperBounds: DOMRect | undefined
    scrollTop: number | undefined
    scrollLeft: number | undefined
    simpleCalculation: {
      topDiff: number
      leftDiff: number
    }
    result: { top: number; left: number; width: number }
  }) {
    if (!this.isEnabled) return

    console.log('🐛 absoluteRect debug:', data)
  }

  logDragHandleDebug(
    data: DebugData & {
      editorWrapperElement: Element | null
    }
  ) {
    if (!this.isEnabled) return

    console.log('🐛 DRAG HANDLE DEBUG:', {
      mouseEvent: data.mouseEvent,
      targetNode: data.targetNode,
      nodeText: data.nodeText,
      computedStyle: data.computedStyle,
      editorWrapper: data.editorWrapper,
      positioning: data.positioning,
      editorWrapperElement: data.editorWrapperElement
    })
  }

  destroy() {
    this.debugOverlay?.remove()
    this.debugOverlay = null
    this.boundsVisualizer?.remove()
    this.boundsVisualizer = null
  }

  enable() {
    this.isEnabled = true
  }

  disable() {
    this.isEnabled = false
    this.hide()
  }

  toggle() {
    this.isEnabled = !this.isEnabled
    if (!this.isEnabled) {
      this.hide()
    }
  }
}
