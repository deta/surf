import { onDestroy, onMount } from 'svelte'

/**
 * Add the specifid class to the document body on mount and remove it on unmount
 * @param className class to add to the document body
 */
export const useBodyClass = (className: string) => {
  onMount(() => {
    document.body.classList.add(className)
  })

  onDestroy(() => {
    document.body.classList.remove(className)
  })
}

/**
 * Add the specifid class to the document element on mount and remove it on unmount
 * @param className class to add to the document element
 */
export const useDocumentClass = (className: string) => {
  onMount(() => {
    document.documentElement.classList.add(className)
  })

  onDestroy(() => {
    document.documentElement.classList.remove(className)
  })
}

/**
 * Add the specifid class to the svelte app element (id='app') on mount and remove it on unmount
 * @param className class to add to the svelte app element
 */
export const useSvelteAppClass = (className: string) => {
  onMount(() => {
    document.getElementById('app')?.classList.add(className)
  })

  onDestroy(() => {
    document.getElementById('app')?.classList.remove(className)
  })
}

/**
 * Set the specified title as the document title on mount
 * @param title string to set as the document title
 * @returns function to set the title
 */
export const useTitle = (title: string) => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const setTitle = (title: string) => {
    if (!document) return // SSR
    document.title = title
  }

  onMount(() => {
    setTitle(title)
  })

  return setTitle
}

/**
 * Delete the specified URL search parameter from the current location
 * Note: this replaces the current history entry
 * @param key search parameter to remove
 */
export const deleteSearchParam = (key: string) => {
  const url = new URL(window.location.href)
  url.searchParams.delete(key)
  window.history.replaceState(null, '', url)
}

/**
 * Set the specified URL search parameter in the current location
 * Note: this replaces the current history entry
 * @param key search parameter to set
 * @param value value for the search param
 */
export const setSearchParam = (key: string, value: string) => {
  if (!window) return // SSR
  const url = new URL(window.location.href)
  url.searchParams.set(key, value)
  window.history.replaceState(null, '', url)
}

/**
 * Gets the current location's search parameters
 */
export const getSearchParams = <T = { [k: string]: string }>(): Partial<T> => {
  if (!window) return {} // SSR
  const searchParams = new URLSearchParams(window.location.search)
  const params = Object.fromEntries(searchParams) as Partial<T>
  return params
}

/**
 * Gets the current location's search parameters on mount
 * @param callback callback function to which the search parameters will be passed
 */
export const useSearchParams = <T = { [k: string]: string }>(
  callback: (params: Partial<T>, deleteParam: (key: string) => void) => void
) => {
  onMount(() => {
    const params = getSearchParams<T>()
    callback(params, deleteSearchParam)
  })
}
