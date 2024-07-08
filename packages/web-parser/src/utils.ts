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

export const generateNameFromURL = (url: string) => {
  try {
    const urlObj = new URL(url)

    // use the hostname as the name and clean it up (remove www, replace dots with spaces, capitalize and get rid of the TLD)
    return urlObj.hostname
      .split('.')
      .slice(-2)
      .join('.')
      .replace(/\./g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .split(' ')[0]
  } catch (e) {
    return null
  }
}
