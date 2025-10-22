import { randomBytes } from 'crypto'

interface TokenData<T> {
  data: T
  expiresAt: number
  timeout: NodeJS.Timeout
}

const tokens: Map<string, TokenData<any>> = new Map()

const DEFAULT_TTL = 30_000

const tokenManager = {
  create: <T>(data: T, ttl: number = DEFAULT_TTL): string => {
    const token = randomBytes(32).toString('hex')
    const expiresAt = Date.now() + ttl
    const timeout = setTimeout(() => {
      tokens.delete(token)
    }, ttl)

    tokens.set(token, { data, expiresAt, timeout })
    return token
  },

  verify: <T>(token: string, data: T): boolean => {
    const tokenData = tokens.get(token)
    if (!tokenData) return false

    const now = Date.now()
    if (now > tokenData.expiresAt) {
      tokenManager.revoke(token)
      return false
    }

    return tokenData.data === data
  },

  revoke: (token: string): boolean => {
    const tokenData = tokens.get(token)
    if (tokenData) {
      clearTimeout(tokenData.timeout)
      return tokens.delete(token)
    }
    return false
  }
}

export default tokenManager
