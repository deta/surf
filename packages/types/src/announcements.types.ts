export type AnnouncementType = 'info' | 'security' | 'update'

export type Announcement = {
  id: string
  type: AnnouncementType
  content: string
  createdAt: string
  updatedAt: string
}
