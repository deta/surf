import { format, formatDistanceToNow, isToday } from 'date-fns'

export const diffToNow = (timestamp: number | string) => {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp

  return ms - Date.now()
}

const formatDistanceLocale = {
  lessThanXSeconds: '{{count}}s',
  xSeconds: '{{count}}s',
  halfAMinute: '30s',
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
  count: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any
) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  options = options || {}

  const result = formatDistanceLocale[token].replace('{{count}}', count)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (options.addSuffix) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (options.comparison > 0) {
      return 'in ' + result
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

export const getFormattedTime = (timestamp: number | string) => {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp

  return format(ms, 'HH:mm:ss.SSS')
}

export const getFormattedDate = (timestamp: number | string) => {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp

  return format(ms, 'MMMM dd, yyyy')
}

export const isDateToday = (timestamp: number | string) => {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp

  return isToday(ms)
}
