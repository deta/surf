import { writable } from 'svelte/store'

function createFolderStore() {
  const { subscribe, set, update } = writable('all')
  let redraw = () => {}

  return {
    subscribe,
    set,
    update,
    onRedraw: (callback) => {
      redraw = callback
    },
    triggerRedraw: () => {
      redraw()
    }
  }
}

export const selectedFolder = createFolderStore()
