import { AuthenticatedAPI } from '@deta/api'
import { getUserConfig, updateUserConfig } from './config'
import { fetch } from 'cross-fetch'
import { v4 as uuidv4 } from 'uuid'

export const checkIfAppIsActivated = async (apiKey?: string) => {
  const existingUserConfig = getUserConfig()
  const existingApiKey = apiKey || existingUserConfig.api_key
  if (!existingApiKey) return null

  const api = new AuthenticatedAPI(import.meta.env.M_VITE_API_BASE, existingApiKey, fetch)

  const user = await api.getUserData()
  if (!user) return null

  let anon_id = existingUserConfig.anon_id
  if (user.anon_telemetry) {
    if (!anon_id) {
      anon_id = uuidv4()
    }
  }

  const newData = {
    user_id: user?.id,
    anon_id,
    email: user?.email,
    anon_telemetry: user?.anon_telemetry
  }

  // NOTE: We still use the anon_id if the telemetry is non-anon, so we dont lose unique users
  // in Amplitude! The amplitude User id is NEVER allowed to change.
  updateUserConfig(newData)

  return !!user
}
