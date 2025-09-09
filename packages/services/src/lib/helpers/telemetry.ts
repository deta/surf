import { createTelemetry } from '../telemetry'

export const setupTelemetry = (apiKey?: string) => {
  let telemetryAPIKey = apiKey || ''
  let telemetryActive = false
  let telemetryProxyUrl: string | undefined = undefined
  if (
    (import.meta.env.PROD || import.meta.env.R_VITE_TELEMETRY_ENABLED) &&
    import.meta.env.R_VITE_TELEMETRY_PROXY_URL
  ) {
    telemetryActive = true
    telemetryProxyUrl = import.meta.env.R_VITE_TELEMETRY_PROXY_URL
  }
  const telemetry = createTelemetry({
    apiKey: telemetryAPIKey,
    active: telemetryActive,
    proxyUrl: telemetryProxyUrl
  })
  return telemetry
}
