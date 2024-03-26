import { AuthenticatedAPI } from '@horizon/api'
import { updateUserConfig } from './config'
import { fetch } from 'cross-fetch'

export const checkIfAppIsActivated = async (apiKey: string) => {
  const api = new AuthenticatedAPI(import.meta.env.M_VITE_API_BASE, apiKey, fetch)

  const user = await api.getUserData()
  if (!user) return false

  updateUserConfig({ user_id: user?.id, email: user?.email })

  return !!user
}
