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
