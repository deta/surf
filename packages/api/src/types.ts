export interface AppActivationResponse {
  api_key: string
  created_at: string
  updated_at: string
}

export interface UserDataResponse {
  id: string
  email: string
  status: string
  anon_telemetry: boolean
  created_at: string
  updated_at: string
}
