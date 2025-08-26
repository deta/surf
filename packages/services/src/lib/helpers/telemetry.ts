import { createTelemetry } from '../telemetry'

export const setupTelemetry = () => {
  let telemetryAPIKey = ''
  let telemetryActive = false
  let telemetryProxyUrl: string | undefined = undefined
  if (import.meta.env.PROD || import.meta.env.R_VITE_TELEMETRY_ENABLED) {
    telemetryActive = true
    telemetryProxyUrl = import.meta.env.R_VITE_TELEMETRY_PROXY_URL
    if (!telemetryProxyUrl) {
      telemetryAPIKey = import.meta.env.R_VITE_TELEMETRY_API_KEY
    }
  }

  const telemetry = createTelemetry({
    apiKey: telemetryAPIKey,
    active: telemetryActive,
    trackHostnames: false,
    proxyUrl: telemetryProxyUrl
  })

  return telemetry
}
