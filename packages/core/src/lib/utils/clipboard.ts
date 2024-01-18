import { writable } from 'svelte/store'

export const useClipboard = (delay = 500) => {
  const copied = writable(false)

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      copied.set(true)
      setTimeout(() => copied.set(false), delay)
    } catch (error) {
      console.error(error)
    }
  }

  return { copied, copy }
}
