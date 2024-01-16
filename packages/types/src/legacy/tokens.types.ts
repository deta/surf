export interface Token {
  id: string
  created_at: string
  expires_at: string
}

export interface CreatedToken extends Token {
  token: string
}
