export const isModKeyPressed = (event: KeyboardEvent | MouseEvent) => {
  return event.metaKey || event.ctrlKey
}

export const isModKeyAndKeyPressed = (event: KeyboardEvent, key: string) => {
  return isModKeyPressed(event) && event.key === key
}

export const isModKeyAndKeysPressed = (event: KeyboardEvent, keys: string[]) => {
  return isModKeyPressed(event) && keys.includes(event.key)
}
