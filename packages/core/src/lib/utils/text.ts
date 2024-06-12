export const truncate = (text: string, length: number) => {
  return text.length > length ? text.slice(0, length) + '...' : text
}

export const capitalize = (text: string) => {
  return text[0].toUpperCase() + text.slice(1)
}
