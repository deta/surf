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

export const uuidToBase62 = (uuid: string) => {
  // Remove hyphens and convert to Buffer/array of bytes
  const bytes = Buffer.from(uuid.replace(/-/g, ''), 'hex')

  // Base62 characters (0-9, a-z, A-Z)
  const base62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

  let result = ''
  let number = BigInt('0x' + uuid.replace(/-/g, ''))

  while (number > 0n) {
    result = base62[Number(number % 62n)] + result
    number = number / 62n
  }

  return result
}
