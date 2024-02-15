export const isModKeyPressed = (event: KeyboardEvent) => {
  return event.metaKey || event.ctrlKey
}

export const isModKeyAndKeyPressed = (event: KeyboardEvent, key: string) => {
  return isModKeyPressed(event) && event.key === key
}
