import { NodeType } from '@tiptap/pm/model'

import {
  InputRule,
  callOrReturn,
  type ExtendedRegExpMatchArray,
  type InputRuleFinder
} from '@tiptap/core'

// match the > char followed by a space
export const detailsRegex = /^\s*>\s$/

/**
 * Build an input rule that adds a node when the
 * matched text is typed into it.
 * @see https://tiptap.dev/guide/custom-extensions/#input-rules
 */
export function detailsInputRule(config: {
  /**
   * The regex to match.
   */
  find?: InputRuleFinder

  /**
   * The node type to add.
   */
  type: NodeType

  /**
   * A function that returns the attributes for the node
   * can also be an object of attributes
   */
  getAttributes?:
    | Record<string, any>
    | ((match: ExtendedRegExpMatchArray) => Record<string, any>)
    | false
    | null
}) {
  return new InputRule({
    find: config.find || detailsRegex,
    handler: ({ state, range, match, chain }) => {
      var n
      const { schema: o, selection: s } = state,
        { $from: r, $to: i } = s,
        a = r.blockRange(i)
      if (!a) return
      const c = state.doc.slice(a.start, a.end)
      if (!o.nodes.detailsContent.contentMatch.matchFragment(c.content)) return
      const sliceTextContent = c.content.textBetween(0, c.content.size, ' ')
      const summary = sliceTextContent.trim().replace(/^>\s?/, '')

      chain()
        .insertContentAt(
          {
            from: a.start,
            to: a.end
          },
          {
            type: 'details',
            attrs: {
              open: !!summary
            },
            content: [
              {
                type: 'detailsSummary',
                content: summary
                  ? [
                      {
                        type: 'text',
                        text: summary
                      }
                    ]
                  : undefined
              },
              {
                type: 'detailsContent',
                content: [
                  {
                    type: 'paragraph',
                    content: []
                  }
                ]
              }
            ]
          }
        )
        .setTextSelection(a.start + (summary ? summary.length + 4 : 2))
        .run()
    }
  })
}
