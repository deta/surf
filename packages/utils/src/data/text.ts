export const truncate = (text: string, length: number) => {
  if (text === null || text === undefined) return ''
  return text.length > length ? text.slice(0, length) + '…' : text
}

export const capitalize = (text: string) => {
  return text[0].toUpperCase() + text.slice(1)
}

export const optimisticParseJSON = <T>(text: string): T | null => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
