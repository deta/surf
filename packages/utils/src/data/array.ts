export const conditionalArrayItem = <T>(condition: boolean, item: T | Array<T>): T[] => {
  if (condition) {
    return Array.isArray(item) ? item : [item]
  }

  return []
}
