/**
 * Change hex color opacity by adding alpha to hex color value
 * @param color Hex color value
 * @param opacity Opacity value as a float
 * @returns Hex color value with alpha
 */
export const changeHexColorOpacity = (color: string, opacity: number) => {
  // coerce values so ti is between 0 and 1.
  const _opacity = Math.round(Math.min(Math.max(opacity || 1, 0), 1) * 255)
  return color + _opacity.toString(16).toUpperCase()
}

export const generateRandomHue = (seed?: string) => {
  if (!seed) {
    seed = Math.random().toString(36).substr(2, 9)
  }
  const seedNumber = seed
    .split('')
    .map((char) => char.charCodeAt(0))
    .reduce((acc, val) => acc + val, 0)

  const hue = seedNumber % 360
  return hue
}

export const generateRandomPastelColor = (seed?: string, opacity: number = 0.875) => {
  const hue = generateRandomHue(seed)
  const pastel = `hsl(${hue}, 100%, ${opacity * 100}%)`
  return pastel
}

// Utility functions for color conversion
export const hexToHsl = (hex: string) => {
  hex = hex.replace(/^#/, '')
  let bigint = parseInt(hex, 16)
  let r = (bigint >> 16) & 255
  let g = (bigint >> 8) & 255
  let b = bigint & 255

  ;(r /= 255), (g /= 255), (b /= 255)
  let max = Math.max(r, g, b),
    min = Math.min(r, g, b)
  let h: number = 0
  let s
  let l = (max + min) / 2

  if (max == min) {
    h = s = 0 // achromatic
  } else {
    let d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }
  return [h * 360, s * 100, l * 100]
}

export const hslToHex = (h: number, s: number, l: number) => {
  s /= 100
  l /= 100
  let c = (1 - Math.abs(2 * l - 1)) * s
  let x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  let m = l - c / 2
  let r = 0,
    g = 0,
    b = 0
  if (0 <= h && h < 60) {
    r = c
    g = x
    b = 0
  } else if (60 <= h && h < 120) {
    r = x
    g = c
    b = 0
  } else if (120 <= h && h < 180) {
    r = 0
    g = c
    b = x
  } else if (180 <= h && h < 240) {
    r = 0
    g = x
    b = c
  } else if (240 <= h && h < 300) {
    r = x
    g = 0
    b = c
  } else if (300 <= h && h < 360) {
    r = c
    g = 0
    b = x
  }
  r = Math.round((r + m) * 255)
  g = Math.round((g + m) * 255)
  b = Math.round((b + m) * 255)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`
}
