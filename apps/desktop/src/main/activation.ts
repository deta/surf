import { AuthenticatedAPI } from '@horizon/api'
import { getUserConfig, updateUserConfig } from './config'
import { fetch } from 'cross-fetch'
import { v4 as uuidv4 } from 'uuid'

export const checkIfAppIsActivated = async (apiKey: string) => {
  const api = new AuthenticatedAPI(import.meta.env.M_VITE_API_BASE, apiKey, fetch)

  const user = await api.getUserData()
  if (!user) return false

  const existingUserConfig = getUserConfig()
  let anon_id = existingUserConfig.anon_id

  if (user.anon_telemetry) {
    if (!anon_id) {
      anon_id = uuidv4()
    }
  }

  // NOTE: We still use the anon_id if the telemetry is non-anon, so we dont lose unique users
  // in Amplitude! The amplitude User id is NEVER allowed to change.
  updateUserConfig({
    user_id: user?.id,
    anon_id,
    email: user?.email,
    anon_telemetry: user?.anon_telemetry
  })

  return !!user
}
