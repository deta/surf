export interface Collection {
  id: string
  name: string
  created_at: string
  migrated?: boolean
  instance_collection?: boolean
}

export interface Base {
  name: string
}

export interface Drive {
  name: string
}
