/*
    Code From: https://github.com/pierre-lgb/slashwriter/blob/main/shared/editor/extensions/DragAndDrop/DragHandle.ts
*/

// https://github.com/ueberdosis/tiptap/blob/main/demos/src/Experiments/GlobalDragHandle/Vue/DragHandle.js

import { NodeSelection, Plugin } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { DOMSerializer } from 'prosemirror-model'
import tippy from 'tippy.js'
import { DragHandleDebugTools, type DebugData } from './DragHandleDebug'
import { useLogScope } from '@deta/utils/io'

const log = useLogScope('Drag Handle')

export interface DragHandleOptions {
  /**
   * The width of the drag handle
   */
  dragHandleWidth: number
  /**
   * Enable debug tools for drag handle positioning
   */
  enableDebug?: boolean
}

function absoluteRect(
  node: Element,
  editorWrapper: Element | null,
  debugTools?: DragHandleDebugTools | null
) {
  const data = node.getBoundingClientRect()
  const wrapperRect = editorWrapper?.getBoundingClientRect()

  const result = {
    top: data.top - (wrapperRect?.top ?? 0),
    left: data.left - (wrapperRect?.left ?? 0),
    width: data.width
  }

  // Debug logging via debug tools
  debugTools?.logAbsoluteRect({
    nodeBounds: data,
    wrapperBounds: wrapperRect,
    scrollTop: editorWrapper?.scrollTop,
    scrollLeft: editorWrapper?.scrollLeft,
    simpleCalculation: {
      topDiff: data.top - (wrapperRect?.top ?? 0),
      leftDiff: data.left - (wrapperRect?.left ?? 0)
    },
    result
  })

  return result
}

function nodeDOMAtCoords(coords: { x: number; y: number }) {
  return document
    .elementsFromPoint(coords.x, coords.y)
    .find(
      (elem: Element) =>
        !elem.classList.contains('no-drag-handle') &&
        (elem.parentElement?.matches?.('.ProseMirror') ||
          elem.matches(
            [
              'li',
              'p:not(:first-child)',
              'pre',
              'blockquote',
              'h1, h2, h3',
              'resource',
              'output',
              '[data-type=callout]',
              '[data-type=horizontalRule]',
              '.tableWrapper',
              '.node-subdocument',
              '.node-equationBlock'
            ].join(', ')
          ))
    )
}

export function nodePosAtDOM(node: Element, view: EditorView) {
  const boundingRect = node.getBoundingClientRect()
  const pos = view.posAtCoords({
    left: boundingRect.left + 1,
    top: boundingRect.top + 1
  })

  if (!pos) return undefined

  // Special handling for list items
  if (node.matches('li')) {
    const $pos = view.state.doc.resolve(pos.pos)
    // Find the actual list item position
    if ($pos.parent.type.name === 'listItem' || $pos.parent.type.name === 'bulletList') {
      return $pos.before($pos.depth)
    }
  }

  // For images, find the image node position
  if (node.matches('img')) {
    let $pos = view.state.doc.resolve(pos.pos)

    // Look for the closest image node
    while ($pos.pos > 0) {
      const nodeAtPos = view.state.doc.nodeAt($pos.pos)
      if (nodeAtPos?.type.name === 'image') {
        return $pos.pos
      }
      $pos = view.state.doc.resolve($pos.pos - 1)
    }
    return undefined
  }

  // for output nodes grab the entire output node
  if (node.matches('output')) {
    const $pos = view.state.doc.resolve(pos.pos)
    return $pos.before($pos.depth)
  }

  // For all other nodes
  return pos.inside > -1 ? pos.inside : pos.pos
}

export default function DragHandle(options: DragHandleOptions) {
  function handleDragStart(event: DragEvent, view: EditorView) {
    view.focus()

    if (!event.dataTransfer) return

    const node = nodeDOMAtCoords({
      x: event.clientX + 50 + options.dragHandleWidth,
      y: event.clientY
    })

    if (!(node instanceof Element)) return

    const nodePos = nodePosAtDOM(node, view)
    if (nodePos === undefined) return

    const $pos = view.state.doc.resolve(nodePos)
    let selection = NodeSelection.create(view.state.doc, nodePos)

    // Handle list items specially
    if ($pos.parent.type.name === 'listItem' || $pos.node().type.name === 'listItem') {
      // Include the entire list item and its content
      const start = $pos.before($pos.depth)
      selection = NodeSelection.create(view.state.doc, start)
    }

    view.dispatch(view.state.tr.setSelection(selection))

    const slice = view.state.selection.content()
    const serializer = DOMSerializer.fromSchema(view.state.schema)
    const dom = document.createElement('div')
    dom.appendChild(serializer.serializeFragment(slice.content))
    const text = slice.content.textBetween(0, slice.content.size)

    event.dataTransfer.clearData()
    event.dataTransfer.setData('text/html', dom.innerHTML)
    event.dataTransfer.setData('text/plain', text)
    event.dataTransfer.effectAllowed = 'copyMove'

    const dragImage = node.matches('li') ? node.closest('li') || node : node
    event.dataTransfer.setDragImage(dragImage, 0, 0)

    view.dragging = { slice, move: event.ctrlKey }
  }

  function handleClick(event: MouseEvent, view: EditorView) {
    view.focus()

    view.dom.classList.remove('dragging')

    const node = nodeDOMAtCoords({
      x: event.clientX + 50 + options.dragHandleWidth,
      y: event.clientY
    })

    if (!(node instanceof Element)) return

    const nodePos = nodePosAtDOM(node, view)
    if (!nodePos) return

    // dragMenu = tippy(node, {
    //     content: "Drag to move",
    //     placement: 'top-start'
    // })

    // dragMenu.show()

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)))
  }

  let dragHandleElement: HTMLElement | null = null
  let debugTools: DragHandleDebugTools | null = null

  function hideDragHandle() {
    if (dragHandleElement) {
      dragHandleElement.classList.add('hidden')
    }

    debugTools?.hide()
  }

  function showDragHandle() {
    if (dragHandleElement) {
      dragHandleElement.classList.remove('hidden')
    }

    debugTools?.show()
  }

  return new Plugin({
    view: (view) => {
      dragHandleElement = document.createElement('div')
      dragHandleElement.draggable = true
      dragHandleElement.dataset.dragHandle = ''
      dragHandleElement.classList.add('drag-handle')
      dragHandleElement.addEventListener('dragstart', (e) => {
        handleDragStart(e, view)
      })
      dragHandleElement.addEventListener('click', (e) => {
        handleClick(e, view)
      })

      hideDragHandle()

      const editorWrapper = view.dom.closest('.editor-wrapper') as HTMLElement | null
      const container = editorWrapper || view?.dom?.parentElement

      if (container) {
        container.appendChild(dragHandleElement)

        if (options.enableDebug) {
          debugTools = new DragHandleDebugTools(container)
        }
      }

      return {
        destroy: () => {
          dragHandleElement?.remove?.()
          dragHandleElement = null
          debugTools?.destroy()
          debugTools = null
        }
      }
    },
    props: {
      handleDOMEvents: {
        mousemove: (view, event) => {
          if (!view.editable) {
            return
          }

          const node = nodeDOMAtCoords({
            x: event.clientX + 50 + options.dragHandleWidth,
            y: event.clientY
          })

          if (!(node instanceof Element)) {
            hideDragHandle()
            return
          }

          if (node.matches('p') && node.textContent?.trim() === '') {
            hideDragHandle()
            return
          }

          const compStyle = window.getComputedStyle(node)
          const lineHeight = parseInt(compStyle.lineHeight, 10)
          const paddingTop = parseInt(compStyle.paddingTop, 10)

          // Find the actual scrolling container (.editor-wrapper)
          let editorWrapper = view.dom.parentElement
          while (editorWrapper && !editorWrapper.classList.contains('editor-wrapper')) {
            editorWrapper = editorWrapper.parentElement
          }

          const rect = absoluteRect(node, editorWrapper, debugTools)
          const originalRect = { ...rect }

          rect.top += (lineHeight - 24) / 2
          rect.top += paddingTop
          // Li markers
          if (node.matches('ul:not([data-type=taskList]) li, ol li')) {
            rect.left -= options.dragHandleWidth
          }
          rect.width = options.dragHandleWidth

          const finalLeft = rect.left - rect.width
          const finalTop = rect.top

          if (!dragHandleElement) return

          // Prepare debug data
          const wrapperBounds = editorWrapper?.getBoundingClientRect()
          const nodeBounds = node.getBoundingClientRect()

          const debugData: DebugData = {
            mouseEvent: { x: event.clientX, y: event.clientY },
            targetNode: node.tagName + (node.className ? `.${node.className}` : ''),
            nodeText: (node.textContent || '').slice(0, 30) + '...',
            editorWrapper: {
              element: `${editorWrapper?.tagName || 'NOT_FOUND'}.${Array.from(editorWrapper?.classList || []).join('.')}`,
              scrollTop: editorWrapper?.scrollTop || 0,
              scrollLeft: editorWrapper?.scrollLeft || 0,
              bounds: wrapperBounds
            },
            positioning: {
              nodeBounds,
              wrapperBounds,
              originalRect,
              adjustedRect: rect,
              finalPosition: { left: finalLeft, top: finalTop }
            },
            computedStyle: { lineHeight, paddingTop },
            dragHandleWidth: options.dragHandleWidth
          }

          // Update debug tools
          debugTools?.updateDebugInfo(debugData)
          debugTools?.updateBoundsVisualizer(nodeBounds, wrapperBounds)
          debugTools?.logDragHandleDebug({ ...debugData, editorWrapperElement: editorWrapper })

          dragHandleElement.style.left = `${finalLeft}px`
          dragHandleElement.style.top = `${finalTop}px`
          showDragHandle()
        },
        keydown: () => {
          hideDragHandle()
        },
        mousewheel: () => {
          hideDragHandle()
        },
        // dragging class is used for CSS
        dragstart: (view) => {
          view.dom.classList.add('dragging')
        },
        drop: (view) => {
          view.dom.classList.remove('dragging')
        },
        dragend: (view) => {
          view.dom.classList.remove('dragging')
        }
      }
    }
  })
}
