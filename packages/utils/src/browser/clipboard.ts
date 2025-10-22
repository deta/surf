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

export const copyToClipboard = async (content: any) => {
  try {
    // @ts-ignore
    if (window.api.copyToClipboard) {
      // @ts-ignore
      window.api.copyToClipboard(content)
    } else {
      await navigator.clipboard.writeText(content)
    }

    // You can also show a user-friendly message or indication that the content was copied
  } catch (err) {
    console.error('Failed to copy: ', err)
  }
}
