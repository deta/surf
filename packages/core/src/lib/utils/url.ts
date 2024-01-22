export const prependProtocol = (url: string) => {
  if (!url.startsWith('http')) {
    return `https://${url}`
  }
  return url
}

export const checkIfUrl = (url: string) => {
  try {
    new URL(url)
    return true
  } catch (_) {
    return false
  }
}

export const optimisticCheckIfUrl = (url: string) => {
  const pattern = /^(?:https?:\/\/)?(?:[\w-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?$/
  return pattern.test(url)
}

export const parseStringIntoUrl = (raw: string) => {
  try {
    const isValidURL = optimisticCheckIfUrl(raw)
    if (!isValidURL) {
      return null
    }

    const text = prependProtocol(raw)
    return new URL(text)
  } catch (_) {
    return null
  }
}

export const checkIfYoutubeUrl = (url: URL) => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(m\.)?(youtube(-nocookie)?\.com|youtu\.?be)\/.+$/

  return youtubeRegex.test(url.toString())
}

export const getYoutubeVideoId = (url: URL) => {
  const youtubeVideoIdRegex =
    /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

  if (checkIfYoutubeUrl(url)) {
    return url.toString().match(youtubeVideoIdRegex)?.[1] ?? null
  }
  return null
}

export const getInstanceAlias = (url: URL) => {
  const subdomain = url.hostname.split('.')[0]
  if (subdomain.endsWith('-embed')) {
    return subdomain.split('-embed')[0]
  }

  return subdomain
}

export const checkIfSpaceApp = (url: URL) => {
  return (
    url.hostname.endsWith('deta.app') ||
    url.hostname.endsWith('deta.pizza') ||
    url.hostname.endsWith('deta.dev')
  )
}
