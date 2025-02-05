import { SvelteRenderer } from 'svelte-tiptap'
import tippy from 'tippy.js'

import MentionList from './MentionList.svelte'
import type { SuggestionOptions } from '@tiptap/suggestion'
import type { MentionItem } from '../../types'

export default {
  allowSpaces: true,

  render: () => {
    let wrapper: HTMLElement
    let component: MentionList
    let renderer: SvelteRenderer
    let popup: any

    return {
      onStart: (props) => {
        const { editor } = props

        wrapper = document.createElement('div')
        editor.view.dom.parentNode?.appendChild(wrapper)

        component = new MentionList({
          target: wrapper,
          props: {
            items: props.items,
            callback: (item: MentionItem) => {
              props.command(item)
            }
          }
        })

        renderer = new SvelteRenderer(component, { element: wrapper })

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: renderer.dom,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start'
        })
      },
      onUpdate: (props) => {
        renderer.updateProps(props)
        popup[0].setProps({
          getReferenceClientRect: props.clientRect
        })
      },
      onKeyDown: (props) => {
        // TODO: on tab autocomplete the query with the first item
        if (props.event.key === 'Escape' || props.event.key === 'Tab') {
          popup[0].hide()
          return true
        }
        return component.onKeyDown(props.event)
      },
      onExit: (props) => {
        try {
          const range = {
            from: props.editor.state.selection.from,
            to: props.editor.state.selection.from + props.query.length
          }

          // Remove the mention query if it's still there
          const text = props.editor.state.doc.textBetween(range.from, range.to)
          if (text === props.query) {
            props.editor.commands.setTextSelection(range)
            props.editor.commands.deleteSelection()
          }
        } catch (error) {
          console.error(error)
        }

        popup[0].destroy()
        renderer.destroy()
        wrapper.remove()
      }
    }
  }
} as Omit<SuggestionOptions<any>, 'editor'>
