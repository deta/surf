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
    .map(char => char.charCodeAt(0))
    .reduce((acc, val) => acc + val, 0)

  const hue = seedNumber % 360
  return hue
}

export const generateRandomPastelColor = (seed?: string) => {
  const hue = generateRandomHue(seed)
  const pastel = `hsl(${hue}, 100%, 87.5%`
  return pastel
}
