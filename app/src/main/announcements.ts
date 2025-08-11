import { getAnnouncementsState, setAnnouncementsState } from './config'
import type { Announcement } from '@deta/types'

interface SeenAnnouncement {
  id: string
  lastSeenAt: number
  viewCount: number
  lastSeenUpdateTime: number
}

const BACKOFF_BASE = 2 // days
const MAX_BACKOFF = 30 // days

export class AnnouncementsManager {
  private static instance: AnnouncementsManager | null = null
  private announcements: Announcement[] = []

  private constructor() {}

  public static getInstance(): AnnouncementsManager {
    if (!AnnouncementsManager.instance) {
      AnnouncementsManager.instance = new AnnouncementsManager()
    }
    return AnnouncementsManager.instance
  }

  private getSeenAnnouncements(): Record<string, SeenAnnouncement> {
    return getAnnouncementsState()
  }

  private setSeenAnnouncements(seenAnnouncements: Record<string, SeenAnnouncement>) {
    setAnnouncementsState(seenAnnouncements)
  }

  private cleanupStorage(currentAnnouncements: Announcement[]) {
    const seenAnnouncements = this.getSeenAnnouncements()
    const currentIds = new Set(currentAnnouncements.map((a) => a.id))
    let hasChanges = false

    Object.keys(seenAnnouncements).forEach((id) => {
      if (!currentIds.has(id)) {
        delete seenAnnouncements[id]
        hasChanges = true
      }
    })

    if (hasChanges) {
      this.setSeenAnnouncements(seenAnnouncements)
    }

    return seenAnnouncements
  }

  private markAnnouncementSeen(announcement: Announcement) {
    const seenAnnouncements = this.getSeenAnnouncements()
    const now = Date.now()
    const currentSeenInfo = seenAnnouncements[announcement.id]

    seenAnnouncements[announcement.id] = {
      id: announcement.id,
      lastSeenAt: now,
      viewCount: (currentSeenInfo?.viewCount || 0) + 1,
      lastSeenUpdateTime: new Date(announcement.updatedAt).getTime()
    }

    this.setSeenAnnouncements(seenAnnouncements)
  }

  private hasNewUpdate(announcement: Announcement, seenInfo: SeenAnnouncement): boolean {
    const updateTime = new Date(announcement.updatedAt).getTime()
    return updateTime > seenInfo.lastSeenUpdateTime
  }

  private shouldShowAnnouncement(announcement: Announcement, seenInfo?: SeenAnnouncement): boolean {
    if (!seenInfo) return true
    if (this.hasNewUpdate(announcement, seenInfo)) return true

    const now = Date.now()
    const daysSinceLastSeen = (now - seenInfo.lastSeenAt) / (1000 * 60 * 60 * 24)

    if (announcement.type === 'security' || announcement.type === 'update') {
      const backoffDays = Math.min(Math.pow(BACKOFF_BASE, seenInfo.viewCount - 1), MAX_BACKOFF)
      return daysSinceLastSeen >= backoffDays
    }

    return false
  }

  public setAnnouncements(announcements: Announcement[]) {
    this.announcements = announcements
  }

  public getVisibleAnnouncements(markAsSeen: boolean = false): Announcement[] {
    const seenAnnouncements = this.cleanupStorage(this.announcements)

    const visibleAnnouncements = this.announcements.filter((announcement) =>
      this.shouldShowAnnouncement(announcement, seenAnnouncements[announcement.id])
    )

    if (markAsSeen) {
      visibleAnnouncements.forEach((announcement) => this.markAnnouncementSeen(announcement))
    }

    return visibleAnnouncements
  }

  public static destroy(): void {
    AnnouncementsManager.instance = null
  }
}
