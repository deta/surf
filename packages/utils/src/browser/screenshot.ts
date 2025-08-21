// TODO: electron specific code should be moved to the desktop app itself

export const takePageScreenshot = async () => {
  // @ts-ignore
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

export const blobToSmallImageUrl = (blob: Blob, size = 64) => {
  return new Promise<string | null>((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resolve(null)
      return
    }

    const image = new Image()
    image.src = URL.createObjectURL(blob)

    image.onload = () => {
      const aspectRatio = image.width / image.height
      let drawWidth = size
      let drawHeight = size
      let offsetX = 0
      let offsetY = 0

      if (aspectRatio > 1) {
        drawHeight = size
        drawWidth = size * aspectRatio
        offsetX = (drawWidth - size) / 2
      } else {
        drawWidth = size
        drawHeight = size / aspectRatio
        offsetY = (drawHeight - size) / 2
      }

      ctx.drawImage(image, -offsetX, -offsetY, drawWidth, drawHeight)
      const dataUrl = canvas.toDataURL()

      URL.revokeObjectURL(image.src)

      resolve(dataUrl)
    }
  })
}

export const captureScreenshot = async (rect: {
  x: number
  y: number
  width: number
  height: number
}) => {
  // @ts-ignore
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
