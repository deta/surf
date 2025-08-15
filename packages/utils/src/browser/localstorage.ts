import { writable } from 'svelte/store'

type Value = string | number | boolean | null | { [key: string]: unknown } | Object | Value[]

export const setValue = (key: string, value: Value) => {
  const stringValue = typeof value !== 'string' ? JSON.stringify(value) : value
  localStorage.setItem(key, stringValue)
}

export const getValue = <T>(key: string, parse = false) => {
  const stringValue = localStorage.getItem(key)
  if (!stringValue) return null

  if (parse) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(stringValue) as T
  }

  return stringValue as T
}

export const useLocalStorage = <T extends Value>(key: string, defaultValue: T, parse = false) => {
  const get = () => {
    const stored = getValue<T>(key, parse)
    return stored !== null ? stored : defaultValue
  }

  const set = (value: T) => {
    setValue(key, value)
  }

  return { get, set }
}

export const useLocalStorageItem = <T extends Value>(
  itemId: string,
  scope?: string,
  defaultValue?: T,
  autoSave = true
) => {
  const ITEM_KEY = scope ? `${scope}_${itemId}` : itemId

  const value = defaultValue !== undefined ? writable<T>(defaultValue) : writable<T | null>(null)

  const revalidate = () => {
    const stored = getValue<T>(ITEM_KEY, true)
    if (stored !== null) {
      value.set(stored)
    }
  }

  const persist = (value: T) => {
    setValue(ITEM_KEY, value)
  }

  revalidate()

  if (autoSave) {
    value.subscribe((value) => {
      if (value === null) {
        localStorage.removeItem(ITEM_KEY)
      } else {
        persist(value)
      }
    })
  }

  return { value, revalidate, persist }
}

export const useLocalStorageStore = <T extends Value>(
  key: string,
  defaultValue: T,
  parse = false
) => {
  const store = writable<T>(defaultValue)

  const load = (key: string) => {
    const stored = getValue<T>(key, parse)
    if (typeof stored === 'string' && stored === 'null') {
      store.set(null as unknown as T)
      return
    }

    if (stored !== null) {
      store.set(stored)
    }
  }

  const set = (value: T) => {
    setValue(key, value)
    store.set(value)
  }

  const update = (fn: (value: T) => T) => {
    store.update((value) => {
      const newValue = fn(value)
      setValue(key, newValue)
      return newValue
    })
  }

  load(key)

  return { set, update, subscribe: store.subscribe, load }
}
