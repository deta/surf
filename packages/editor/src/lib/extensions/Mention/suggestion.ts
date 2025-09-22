import { mount, unmount } from 'svelte'
import tippy from 'tippy.js'

import MentionList from './MentionList.svelte'
import type { SuggestionOptions } from '../../utilities/Suggestion'
import type { MentionItem } from '../../types'

export default {
  allowSpaces: true,

  render: () => {
    let component: any
    let popup: any
    let element: HTMLElement

    return {
      onStart: (props) => {
        element = document.createElement('div')
        component = mount(MentionList, {
          target: element,
          props: {
            items: props.items,
            callback: props.command,
            loading: props.loading,
            hideSectionTitle: true
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

      onUpdate: (props) => {
        if (component) {
          component.items = props.items
          component.loading = props.loading
          component.callback = props.command
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect
        })
      },

      onKeyDown: (props) => {
        if (props.event.key === 'Escape' || props.event.key === 'Tab') {
          popup[0].hide()
          return true
        }

        return component?.onKeyDown?.(props.event) || false
      },

      onExit: () => {
        popup?.[0]?.destroy()
        if (component) {
          unmount(component)
        }
      }
    }
  }
} as Omit<SuggestionOptions<MentionItem>, 'editor'>

export type MentionItemsFetcher = SuggestionOptions<MentionItem>['items']
