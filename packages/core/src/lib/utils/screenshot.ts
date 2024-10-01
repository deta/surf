// TODO: electron specific code should be moved to the desktop app itself

export const takePageScreenshot = async () => {
  const dataURL = await window.api.captureWebContents()
  return dataURL
}

export const dataUrltoBlob = (dataUrl: string): Blob => {
  const [meta, data] = dataUrl.split(',')

  // Convert the base64 encoded data to a binary string.
  const byteString = atob(data)

  // Get the MIME type.
  const [mimeTypeWithDataPrefix] = meta.split(';')
  const mimeType = mimeTypeWithDataPrefix.replace('data:', '')

  // Convert the binary string to an ArrayBuffer.
  const arrayBuffer = Uint8Array.from(byteString, (c) => c.charCodeAt(0)).buffer

  // Create a blob from the ArrayBuffer.
  return new Blob([arrayBuffer], { type: mimeType })
}

export const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

export const captureScreenshot = async (rect: {
  x: number
  y: number
  width: number
  height: number
}) => {
  const dataUrl = await window.api.screenshotPage(rect)
  if (!dataUrl) {
    throw new Error('Failed to capture screenshot')
  }
  return dataUrltoBlob(dataUrl)
}

export const getScreenshotFileName = (host: string) => {
  const timestamp = new Date()
    .toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    .replace(/[/,:\s]/g, '-')
    .replace(',', '')
  return `screenshot-${host}--${timestamp}.png`
}

export const getHostFromURL = (url: string) => {
  return new URL(url).hostname
    .replace(/^www\./, '')
    .split('.')
    .slice(0, -1)
    .join('.')
}
