export interface ResourceDataLink {
  source_id?: string // unique identifier for the link within the platform
  title: string
  description: string | null
  icon: string
  image: string | null
  keywords: string[]
  type: string | null
  language: string | null
  url: string
  provider: string | null
  author: string | null
  date_published: string | null
  date_modified: string | null
  content_plain: string | null
  content_html: string | null
}
