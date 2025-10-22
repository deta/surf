import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import TableAddButtons from './TableAddButtons.svelte'

export const TableAddRowColumnKey = new PluginKey('tableAddRowColumn')

function absoluteRect(node: Element, editorWrapper: Element | null) {
  const data = node.getBoundingClientRect()
  const wrapperRect = editorWrapper?.getBoundingClientRect()

  return {
    top: data.top - (wrapperRect?.top ?? 0),
    bottom: data.bottom - (wrapperRect?.top ?? 0),
    left: data.left - (wrapperRect?.left ?? 0),
    right: data.right - (wrapperRect?.left ?? 0),
    width: data.width,
    height: data.height
  }
}

export const TableAddRowColumn = Extension.create({
  name: 'tableAddRowColumn',

  addOptions() {
    return {}
  },

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin({
        key: TableAddRowColumnKey,
        view(editorView) {
          // DOM elements for the buttons
          const rowButtonsElement = document.createElement('div')
          const columnButtonsElement = document.createElement('div')

          // Create button components using direct Svelte instantiation
          const rowButtons = new TableAddButtons({
            target: rowButtonsElement,
            props: {
              editor,
              visible: false,
              position: 'row',
              buttonPosition: { x: 0, y: 0 }
            }
          })

          const columnButtons = new TableAddButtons({
            target: columnButtonsElement,
            props: {
              editor,
              visible: false,
              position: 'column',
              buttonPosition: { x: 0, y: 0 }
            }
          })

          // Add buttons to DOM
          editorView.dom.parentElement?.appendChild(rowButtonsElement)
          editorView.dom.parentElement?.appendChild(columnButtonsElement)

          // Track active cell and buttons state
          let activeCell: HTMLElement | null = null
          let showingRowButton = false
          let showingColumnButton = false

          function updateButtonsVisibility(view: EditorView, event: MouseEvent) {
            if (!view.hasFocus() || !editor.isEditable) {
              if (!(rowButtons.isButtonHovered?.() || columnButtons.isButtonHovered?.())) {
                hideButtons()
              }
              return
            }

            const target = event.target as HTMLElement
            if (!target) return

            // Don't hide buttons if they're being hovered
            if (rowButtons.isButtonHovered?.() || columnButtons.isButtonHovered?.()) {
              return
            }

            // Check if hovering over a button or element inside a button
            const isHoveringRowButton = rowButtonsElement.contains(target)
            const isHoveringColumnButton = columnButtonsElement.contains(target)

            if (isHoveringRowButton || isHoveringColumnButton) {
              return
            }

            // Check if we're hovering over a table or cell
            const cell = target?.closest('td, th') as HTMLElement
            const table = target?.closest('table') as HTMLElement

            if (!table || !cell) {
              hideButtons()
              return
            }

            const editorWrapper = view.dom.parentElement
            const tableRect = absoluteRect(table, editorWrapper)

            // Find the last row and cells
            const rows = table.querySelectorAll('tr')
            if (!rows.length) {
              hideButtons()
              return
            }

            const lastRow = rows[rows.length - 1]
            const currentRow = cell.closest('tr')
            const isLastRow = currentRow === lastRow

            // Find if cell is in the last column
            const cellsInRow = currentRow?.querySelectorAll('td, th') || []
            const lastCellInRow = cellsInRow[cellsInRow.length - 1]
            const isLastColumn = cell === lastCellInRow

            // Calculate row button position (centered horizontally at bottom of table)
            const rowButtonPosition = {
              x: tableRect.left + tableRect.width / 2,
              y: tableRect.bottom + 2
            }

            // Calculate column button position (centered vertically at right of table)
            const columnButtonPosition = {
              x: tableRect.right + 2,
              y: tableRect.top + tableRect.height / 2
            }

            // Only show row button when hovering the last row
            if (isLastRow) {
              showingRowButton = true
              activeCell = cell
              rowButtons.$set({
                visible: true,
                buttonPosition: rowButtonPosition,
                cell: cell
              })
            } else if (showingRowButton && !rowButtons.isButtonHovered?.()) {
              showingRowButton = false
              rowButtons.$set({ visible: false })
            }

            // Only show column button when hovering the rightmost column
            if (isLastColumn) {
              showingColumnButton = true
              activeCell = cell
              columnButtons.$set({
                visible: true,
                buttonPosition: columnButtonPosition,
                cell: cell
              })
            } else if (showingColumnButton && !columnButtons.isButtonHovered?.()) {
              showingColumnButton = false
              columnButtons.$set({ visible: false })
            }
          }

          function hideButtons(force = false) {
            // Only hide buttons if they're not being hovered
            if (!rowButtons.isButtonHovered?.() || force) {
              showingRowButton = false
              rowButtons.$set({ visible: false })
            }

            if (!columnButtons.isButtonHovered?.() || force) {
              showingColumnButton = false
              columnButtons.$set({ visible: false })
            }
          }

          // Properly bound event listener functions
          const handleMouseMove = (e: MouseEvent) => {
            updateButtonsVisibility(editorView, e)
          }

          const handleMouseLeave = (e: MouseEvent) => {
            // Delay hiding buttons to prevent them from disappearing too quickly
            setTimeout(() => {
              // Only hide if we're not hovering over a button
              if (!(rowButtons.isButtonHovered?.() || columnButtons.isButtonHovered?.())) {
                hideButtons()
              }
            }, 50)
          }

          rowButtons.$on('add', (event) => {
            const target = event.detail.target as HTMLElement
            if (!target) return
            if (!activeCell) return

            // find cell node in the editor
            const domPos = editor.view.posAtDOM(activeCell, 0)
            const pos = editor.view.state.doc.resolve(domPos)

            // store current selection to restore it later
            const { from } = editor.state.selection

            // insert a new row after the current one
            editor
              .chain()
              .focus()
              .setNodeSelection(pos.pos)
              .addRowAfter()
              .setTextSelection(from)
              .run()

            hideButtons(true)
          })

          rowButtons.$on('remove', (event) => {
            const target = event.detail.target as HTMLElement
            if (!target) return
            if (!activeCell) return

            // find cell node in the editor
            const domPos = editor.view.posAtDOM(activeCell, 0)
            const pos = editor.view.state.doc.resolve(domPos)

            // remove row
            editor.chain().focus().setNodeSelection(pos.pos).deleteRow().run()

            hideButtons(true)
          })

          columnButtons.$on('add', (event) => {
            const target = event.detail.target as HTMLElement
            if (!target) return
            if (!activeCell) return

            // find cell node in the editor
            const domPos = editor.view.posAtDOM(activeCell, 0)
            const pos = editor.view.state.doc.resolve(domPos)

            // store current selection to restore it later
            const { from } = editor.state.selection

            // insert a new column after the current one
            editor
              .chain()
              .focus()
              .setNodeSelection(pos.pos)
              .addColumnAfter()
              .setTextSelection(from)
              .run()

            hideButtons(true)
          })

          columnButtons.$on('remove', (event) => {
            const target = event.detail.target as HTMLElement
            if (!target) return
            if (!activeCell) return

            // find cell node in the editor
            const domPos = editor.view.posAtDOM(activeCell, 0)
            const pos = editor.view.state.doc.resolve(domPos)

            // remove column
            editor.chain().focus().setNodeSelection(pos.pos).deleteColumn().run()

            hideButtons(true)
          })

          // Add event listeners
          editorView.dom.addEventListener('mousemove', handleMouseMove)
          editorView.dom.addEventListener('mouseleave', handleMouseLeave)
          // document.addEventListener('click', handleClick, true);

          return {
            destroy() {
              // Remove event listeners with the correct references
              editorView.dom.removeEventListener('mousemove', handleMouseMove)
              editorView.dom.removeEventListener('mouseleave', handleMouseLeave)
              // document.removeEventListener('click', handleClick, true);

              // Destroy Svelte components
              rowButtons.$destroy()
              columnButtons.$destroy()

              // Remove elements from DOM
              rowButtonsElement.remove()
              columnButtonsElement.remove()
            }
          }
        }
      })
    ]
  }
})

export default TableAddRowColumn
