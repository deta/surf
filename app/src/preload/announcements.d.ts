import type { Announcement } from '@deta/types'

export interface AnnouncementsAPI {
  getAnnouncements: () => Announcement[]
}

declare global {
  interface Window {
    announcementsAPI: AnnouncementsAPI
    electron: {
      openUrl: (url: string) => void
    }
  }
}
