import { getAttributes } from '@tiptap/core'
import type { MarkType } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

export type LinkClickHandler = (event: MouseEvent, href: string) => void

type ClickHandlerOptions = {
  type: MarkType
  onclick?: LinkClickHandler
}

export function clickHandler(options: ClickHandlerOptions): Plugin {
  const handleClick = (view: EditorView, event: MouseEvent) => {
    if (event.button !== 0 && event.button !== 1) {
      return false
    }

    if (!view.editable) {
      return false
    }

    let link: HTMLAnchorElement | null = null

    if (event.target instanceof HTMLAnchorElement) {
      link = event.target
    } else {
      let a = event.target as HTMLElement
      const els = []

      while (a.nodeName !== 'DIV') {
        els.push(a)
        a = a.parentNode as HTMLElement
      }
      link = els.find((value) => value.nodeName === 'A') as HTMLAnchorElement
    }

    if (!link) {
      return false
    }

    const attrs = getAttributes(view.state, options.type.name)
    const href = link?.href ?? attrs.href
    const target = link?.target ?? attrs.target

    if (link && href) {
      if (options.onclick) {
        options.onclick(event, href)
      } else {
        window.open(href, target)
      }

      return true
    }

    return false
  }

  return new Plugin({
    key: new PluginKey('handleClickLink'),
    props: {
      handleDOMEvents: {
        click: (view, event) => {
          return handleClick(view, event)
        },
        auxclick: (view, event) => {
          return handleClick(view, event)
        }
      }
    }
  })
}
