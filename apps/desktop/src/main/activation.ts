import { AuthenticatedAPI } from '@horizon/api'
import { getUserConfig, updateUserConfig } from './config'
import { fetch } from 'cross-fetch'
import { v4 as uuidv4 } from 'uuid'

export const checkIfAppIsActivated = async (apiKey: string) => {
  const api = new AuthenticatedAPI(import.meta.env.M_VITE_API_BASE, apiKey, fetch)

  const user = await api.getUserData()
  if (!user) return false
  if (user.anon_telemetry) {
    const existingUserConfig = getUserConfig()
    let anonId = existingUserConfig.anon_id
    if (!anonId) {
      anonId = uuidv4()
    }
    updateUserConfig({
      user_id: user?.id,
      anon_id: anonId,
      anon_telemetry: user?.anon_telemetry
    })
  } else {
    updateUserConfig({
      user_id: user?.id,
      email: user?.email,
      anon_telemetry: user?.anon_telemetry
    })
  }

  return !!user
}
