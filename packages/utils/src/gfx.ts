import type { NativeImage } from 'electron'

interface ContentBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const cropImageToContent = (
  image: NativeImage,
  options = {
    padding: 20,
    whiteThreshold: 250,
    alphaThreshold: 0
  }
): NativeImage => {
  const width = image.getSize().width
  const height = image.getSize().height
  const buffer = image.toBitmap()
  const bytesPerPixel = 4 // RGBA format
  const stride = width * bytesPerPixel

  // Initialize bounds
  let bounds: ContentBounds = {
    minX: width,
    minY: height,
    maxX: 0,
    maxY: 0
  }

  // Scan through the image data to find non-transparent/non-white pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * stride + x * bytesPerPixel
      const r = buffer[offset]
      const g = buffer[offset + 1]
      const b = buffer[offset + 2]
      const a = buffer[offset + 3]

      const isContent =
        a > options.alphaThreshold &&
        (r < options.whiteThreshold || g < options.whiteThreshold || b < options.whiteThreshold)

      if (isContent) {
        bounds.minX = Math.min(bounds.minX, x)
        bounds.minY = Math.min(bounds.minY, y)
        bounds.maxX = Math.max(bounds.maxX, x)
        bounds.maxY = Math.max(bounds.maxY, y)
      }
    }
  }

  // Add padding
  bounds.minX = Math.max(0, bounds.minX - options.padding)
  bounds.minY = Math.max(0, bounds.minY - options.padding)
  bounds.maxX = Math.min(width, bounds.maxX + options.padding)
  bounds.maxY = Math.min(height, bounds.maxY + options.padding)

  // Return cropped image if we found valid bounds
  if (bounds.maxX > bounds.minX && bounds.maxY > bounds.minY) {
    return image.crop({
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY
    })
  }

  // Return original image if no valid bounds found
  return image
}
