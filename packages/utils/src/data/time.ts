import { format, formatDistanceToNow, isToday } from 'date-fns'
import { writable } from 'svelte/store'

export const diffToNow = (timestamp: number | string) => {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp

  return ms - Date.now()
}

const formatDistanceLocale = {
  lessThanXSeconds: 'just now',
  xSeconds: 'just now',
  halfAMinute: 'just now',
  lessThanXMinutes: '{{count}}m',
  xMinutes: '{{count}}m',
  aboutXHours: '{{count}}h',
  xHours: '{{count}}h',
  xDays: '{{count}}d',
  aboutXWeeks: '{{count}}w',
  xWeeks: '{{count}}w',
  aboutXMonths: '{{count}}mo',
  xMonths: '{{count}}mo',
  aboutXYears: '{{count}}y',
  xYears: '{{count}}y',
  overXYears: '{{count}}y',
  almostXYears: '{{count}}y'
}

const formatDistance = (
  token: keyof typeof formatDistanceLocale,
  count: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any
) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  options = options || {}

  const result = formatDistanceLocale[token].replace('{{count}}', count + '')

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (options.addSuffix) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (options.comparison > 0) {
      return 'in ' + result
    } else if (result === 'just now') {
      return result
    } else {
      return result + ' ago'
    }
  }

  return result
}

export const getHumanDistanceToNow = (timestamp: number | string) => {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp

  if (timestamp === '0001-01-01T00:00:00Z') {
    return 'long ago'
  }

  return formatDistanceToNow(ms, {
    addSuffix: true,
    includeSeconds: true,
    locale: {
      formatDistance
    }
  })
}

export const getFormattedTime = (timestamp: number | string, exact = true) => {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp

  return format(ms, exact ? 'HH:mm:ss.SSS' : 'HH:mm')
}

export const getFormattedDate = (timestamp: number | string) => {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp

  return format(ms, 'MMMM dd, yyyy')
}

export const isDateToday = (timestamp: number | string) => {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp

  return isToday(ms)
}

export const getHumanFormattedDate = (timestamp: number | string) => {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp

  // if the date is within the last 12 hours, return relative time
  if (diffToNow(ms) > -12 * 60 * 60 * 1000 && diffToNow(ms) < 0) {
    return getHumanDistanceToNow(ms)
  }

  if (isDateToday(ms)) {
    return getFormattedTime(ms, false)
  } else {
    return getFormattedDate(ms)
  }
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const writableAutoReset = <T>(defaultValue: T, delay = 500) => {
  const value = writable<T>(defaultValue)

  const set = (newValue: T) => {
    value.set(newValue)

    if (newValue) {
      setTimeout(() => {
        value.set(defaultValue)
      }, delay)
    }
  }

  return { set, update: value.update, subscribe: value.subscribe } as typeof value
}

export const parseTextIntoISOString = (dateString: string) => {
  try {
    return new Date(dateString).toISOString()
  } catch (e) {
    return null
  }
}
