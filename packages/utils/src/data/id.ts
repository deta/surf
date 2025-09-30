import { v4 as uuidv4 } from 'uuid'

export const generateID = () => {
  const random = Math.random().toString(36).substr(2, 10)
  return `${random}`
}

export const generateUUID = () => {
  return uuidv4()
}

export const hashString = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}
