export const isModKeyPressed = (event: KeyboardEvent | MouseEvent) => {
  return event.metaKey || event.ctrlKey
}

export const isModKeyAndKeyPressed = (event: KeyboardEvent, key: string) => {
  return isModKeyPressed(event) && event.key === key
}

export const isModKeyAndKeysPressed = (event: KeyboardEvent, keys: string[]) => {
  return isModKeyPressed(event) && keys.includes(event.key)
}

export const isModKeyAndShiftKeyAndKeyPressed = (event: KeyboardEvent, key: string) => {
  return isModKeyPressed(event) && event.shiftKey && event.key === key
}

export const isOptKeyAndKeyPressed = (event: KeyboardEvent, key: string) => {
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  if (isMac) {
    // For Mac, check if the Alt key is pressed and the key matches
    // either the base key or the resulting character
    return event.altKey && (event.key === key || event.key === getCharFromKeyAndAlt(key))
  } else {
    // For non-Mac systems, use the original logic
    return event.altKey && event.key === key
  }
}

function getCharFromKeyAndAlt(key: string): string {
  const macAltKeyMap: { [key: string]: string } = {
    x: '≈',
    a: 'å',
    c: 'ç',
    g: '©'
  }

  return macAltKeyMap[key.toLowerCase()] || key
}
