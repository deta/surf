export interface Key {
  name: string
  created_at: string
}

export interface CreatedKey extends Key {
  value: string
}
