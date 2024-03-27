export const parseDateString = (dateString: string) => {
  try {
    return new Date(dateString).toISOString()
  } catch (e) {
    return null
  }
}

export const makeAbsoluteURL = (urlOrPath: string, base: URL) => {
  try {
    return new URL(urlOrPath, base.origin).href
  } catch (e) {
    return null
  }
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
