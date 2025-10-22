export const isAltKeyPressed = (event: KeyboardEvent | MouseEvent) => {
  return event.altKey
}

export const isAltKeyAndKeyPressed = (event: KeyboardEvent, key: string) => {
  return isAltKeyPressed(event) && event.key === key
}

export const isAltKeyAndKeysPressed = (event: KeyboardEvent, keys: string[]) => {
  return (
    isAltKeyPressed(event) &&
    keys.map((key) => (key.match(/^\d$/) ? `Digit${key}` : key)).includes(event.code)
  )
}

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

export const isModKeyAndEventCodeIs = (event: KeyboardEvent, code: string) => {
  return isModKeyPressed(event) && event.code === code
}
