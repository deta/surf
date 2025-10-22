import type { SuggestionOptions } from '@tiptap/suggestion'

export default {
  items: ({ query }) => {
    return []
    // return [
    //   'Lea Thompson',
    //   'Cyndi Lauper',
    //   'Tom Cruise',
    //   'Madonna',
    //   'Jerry Hall',
    //   'Joan Collins',
    //   'Winona Ryder',
    //   'Christina Applegate',
    //   'Alyssa Milano',
    //   'Molly Ringwald',
    //   'Ally Sheedy',
    //   'Debbie Harry',
    //   'Olivia Newton-John',
    //   'Elton John',
    //   'Michael J. Fox',
    //   'Axl Rose',
    //   'Emilio Estevez',
    //   'Ralph Macchio',
    //   'Rob Lowe',
    //   'Jennifer Grey',
    //   'Mickey Rourke',
    //   'John Cusack',
    //   'Matthew Broderick',
    //   'Justine Bateman',
    //   'Lisa Bonet',
    // ]
    //   .filter(item => item.toLowerCase().startsWith(query.toLowerCase()))
    //   .slice(0, 5)
  },

  render: () => {
    return {
      onStart: (props) => {},

      onUpdate(props) {},

      onKeyDown(props) {
        return false
      },

      onExit(props) {
        if (props.query === '') {
          return false
        }

        props.command({ id: props.query })
      }
    }
  }
} as Omit<SuggestionOptions<any>, 'editor'>
