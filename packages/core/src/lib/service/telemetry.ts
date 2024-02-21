import type { Card } from '../types'
import { HorizonDatabase } from './storage'
import * as amplitude from '@amplitude/analytics-browser'

export const EventTypes = {
  CreateHorizon: 'Create Horizon',
  DeleteHorizon: 'Delete Horizon',
  ActivateHorizon: 'Activate Horizon',
  AddCard: 'Add Card',
  DeleteCard: 'Delete Card',
  DuplicateCard: 'Duplicate Card',
  UpdateCard: 'Update Card'
}

export type TelemetryConfig = {
  apiKey: string
  active: boolean
  trackHostnames: boolean
}

// TODO: how much does telemetry hurt performance?
export class Telemetry {
  storage: HorizonDatabase
  apiKey: string
  active: boolean
  trackHostnames: boolean
  constructor(storage: HorizonDatabase, config: TelemetryConfig) {
    this.storage = storage
    this.apiKey = config.apiKey
    this.active = config.active
    this.trackHostnames = config.trackHostnames
  }
  async init() {
    let userID = await this.storage.getUserID()
    if (!userID) {
      const userData = await this.storage.createUserData()
      userID = userData.user_id
    }
    amplitude.init(this.apiKey, userID, {
      defaultTracking: {
        attribution: false,
        pageViews: false,
        sessions: true,
        formInteractions: false,
        fileDownloads: false
      }
    })
    amplitude.setOptOut(!this.active)
  }

  setActive(active: boolean) {
    this.active = active
    amplitude.setOptOut(!active)
  }

  setTrackHostnames(trackHostnames: boolean) {
    this.trackHostnames = trackHostnames
  }

  getHostnameFromURL(url: string) {
    try {
      return new URL(url).hostname
    } catch (e) {
      return ''
    }
  }

  extractEventPropertiesFromCard(card: Partial<Card>, duplicated: boolean = false) {
    let eventProperties = {
      id: card.id,
      type: card.type,
      positionX: card.x,
      positionY: card.y,
      width: card.width,
      height: card.height,
      // we don't want to store false values in amplitude
      duplicated: duplicated ? true : undefined
    }
    switch (card.type) {
      case 'browser':
        if (!this.trackHostnames) {
          break
        }
        let location = card.data.initialLocation
        if (card.data.currentHistoryIndex > 0) {
          // TODO: history: REQUIRES FIX
          location = this.getHostnameFromURL(
            card.data.historyStackIds[card.data.currentHistoryIndex]
          )
        }
        eventProperties = {
          ...eventProperties,
          location: location
        }
        break
      case 'link':
        if (!this.trackHostnames) {
          break
        }
        eventProperties = {
          ...eventProperties,
          hostname: this.getHostnameFromURL(card.data.url)
        }
        break
      case 'file':
        eventProperties = {
          ...eventProperties,
          mimeType: card.data.mimeType
        }
        break
    }
    return eventProperties
  }

  async trackEvent(eventName: string, eventProperties: Record<string, any> | undefined) {
    if (!this.apiKey || !this.storage || !this.active) {
      return
    }
    // TODO: figure out why this is happening
    if (eventName === EventTypes.UpdateCard && !eventProperties.id) {
      return
    }
    await amplitude.track(eventName, eventProperties)
  }

  // this is a separate function as market needs cards metadata when tracking this event
  async trackActivateHorizonEvent(horizonID: string, cards: Array<Card>) {
    if (!this.apiKey || !this.storage || !this.active) {
      return
    }
    const cardProperties = cards.map((card) => this.extractEventPropertiesFromCard(card))
    await this.trackEvent(EventTypes.ActivateHorizon, { id: horizonID, cards: cardProperties })
  }
}
