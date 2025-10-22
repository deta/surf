import { mount, unmount } from 'svelte'
import Slash from './Slash.svelte'
import tippy from 'tippy.js'
import { BUILT_IN_SLASH_COMMANDS } from './actions'
import type { SuggestionOptions } from '../../utilities/Suggestion'
import type { SlashMenuItem, SlashCommandPayload } from './types'

export default {
  items: ({ query }) => {
    return BUILT_IN_SLASH_COMMANDS.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.keywords.some((keyword) => keyword.includes(query.toLowerCase()))
    )
  },

  render: () => {
    let component: Slash
    let popup: any
    let keyDownHandler: ((e: KeyboardEvent) => boolean) | null = null

    return {
      onStart: (props) => {
        let element = document.createElement('div')
        component = mount(Slash, {
          target: element,
          props: {
            editor: props.editor,
            range: props.range,
            items: props.items,
            query: props.query,
            loading: props.loading,
            callback: (payload: SlashCommandPayload) => {
              props.command(payload)
            },
            onKeyDownRef: (handler: (e: KeyboardEvent) => boolean) => {
              keyDownHandler = handler
            }
          }
        })

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start'
        })
      },

      onUpdate(props) {
        component.$set({
          editor: props.editor,
          range: props.range,
          items: props.items,
          loading: props.loading,
          query: props.query
        })
        if (!props.clientRect) {
          return
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect
        })
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup[0].hide()
          return true
        }

        return keyDownHandler ? keyDownHandler(props.event) : false
      },

      onExit() {
        if (popup && popup[0]) {
          popup[0].destroy()
        }
        if (component) {
          unmount(component)
        }
      }
    }
  }
} as Omit<SuggestionOptions<SlashMenuItem>, 'editor'>

export type SlashItemsFetcher = SuggestionOptions<SlashMenuItem>['items']
