export type DomainStatus = 'active' | 'verified' | 'error' | 'pending'
export type DomainDNSRecord = {
  name: string
  type: 'A' | 'TXT'
  value: string
}

export interface Domain {
  id: string
  domain: string
  ip: string
  dns_records: DomainDNSRecord[]
  active: boolean
  status: DomainStatus
  reason: string | null
  legacy: boolean
}

export type LegacyDomain = {
  id: string
  micro: string
  project: string
  domain: string
}
