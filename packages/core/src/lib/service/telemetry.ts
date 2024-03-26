import isEqual from 'lodash/isequal'
import * as amplitude from '@amplitude/analytics-browser'
import { type UserConfig, TelemetryEventTypes, type ElectronAppInfo } from '@horizon/types'

import { HorizonDatabase } from './storage'
import type { Card, CardCreationMetadata } from '../types/index'
import { useLogScope } from '../utils/log'

export type TelemetryConfig = {
  apiKey: string
  active: boolean
  trackHostnames: boolean
}

export enum HorizonActivationSource {
  Overview = 'overview',
  Oasis = 'oasis'
}

// TODO: how much does telemetry hurt performance?
export class Telemetry {
  apiKey: string
  active: boolean
  trackHostnames: boolean
  userConfig: UserConfig | null
  appInfo: ElectronAppInfo | null

  log: ReturnType<typeof useLogScope>

  constructor(config: TelemetryConfig) {
    this.apiKey = config.apiKey
    this.active = config.active
    this.trackHostnames = config.trackHostnames

    this.userConfig = null
    this.appInfo = null

    this.log = useLogScope('telemetry')
  }
  async init() {
    // @ts-expect-error
    this.userConfig = (await window.api.getUserConfig()) as UserConfig
    const userID = this.userConfig.user_id
    if (!userID) {
      console.warn('No user ID found, disabling telemetry')
      this.active = false
      return
    }

    // @ts-expect-error
    this.appInfo = (await window.api.getAppInfo()) as ElectronAppInfo

    amplitude.init(this.apiKey, userID, {
      defaultTracking: {
        attribution: false,
        pageViews: false,
        sessions: true,
        formInteractions: false,
        fileDownloads: false
      },
      appVersion: this.appInfo.version
    })
    amplitude.setOptOut(!this.active)

    // @ts-expect-error
    window.api.onTrackEvent((eventName: TelemetryEventTypes, properties: Record<string, any>) => {
      this.log.debug('Received track event from main process', eventName, properties)
      this.trackEvent(eventName, properties)
    })
  }

  setActive(active: boolean) {
    this.active = active
    amplitude.setOptOut(!active)
  }

  isActive() {
    return this.apiKey && this.active
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
    } as any
    switch (card.type) {
      case 'browser':
        if (!this.trackHostnames) {
          break
        }
        let location = card?.data?.initialLocation
        if (card?.data?.currentHistoryIndex && card?.data?.currentHistoryIndex > 0) {
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
          hostname: this.getHostnameFromURL((card?.data as any)?.url)
        }
        break
      case 'file':
        eventProperties = {
          ...eventProperties,
          mimeType: (card?.data as any)?.mimeType
        }
        break
    }
    return eventProperties
  }

  async trackEvent(
    eventName: TelemetryEventTypes,
    eventProperties: Record<string, any> | undefined
  ) {
    if (!this.isActive()) {
      this.log.debug('Telemetry is not active, not tracking event', eventName, eventProperties)
      return
    }

    await amplitude.track({
      event_type: eventName,
      event_properties: eventProperties,
      platform: this.appInfo?.platform,
      app_version: this.appInfo?.version,
      user_properties: {
        email: this.userConfig?.email
      }
    })
  }

  // currently the updatedCard is always sent as the full card, not just the updated fields
  async trackUpdateCardEvent(existingCard: Card, updatedCard: Partial<Card>) {
    if (!existingCard.id || !updatedCard.id || !this.isActive()) {
      return
    }
    // the following fields are not relevant for tracking, so we remove them before comparing as they might cause false negatives
    delete existingCard.createdAt
    delete existingCard.updatedAt
    delete existingCard.hoisted
    delete updatedCard.hoisted
    delete updatedCard.createdAt
    delete updatedCard.updatedAt
    if (isEqual(existingCard, updatedCard)) {
      return
    }
    await this.trackEvent(
      TelemetryEventTypes.UpdateCard,
      this.extractEventPropertiesFromCard(updatedCard)
    )
  }

  // this is a separate function as market needs cards metadata when tracking this event
  async trackActivateHorizonEvent(
    horizonID: string,
    cards: Array<Card>,
    source?: HorizonActivationSource
  ) {
    const cardProperties = cards.map((card) => this.extractEventPropertiesFromCard(card))
    await this.trackEvent(TelemetryEventTypes.ActivateHorizon, {
      id: horizonID,
      cards: cardProperties,
      source: source
    })
  }

  async trackCreateCardEvent(card: Card, metadata?: CardCreationMetadata) {
    const duplicated = metadata?.trigger === 'duplicate'

    await this.trackEvent(TelemetryEventTypes.AddCard, {
      ...this.extractEventPropertiesFromCard(card, duplicated),
      source: metadata?.trigger
    })
  }
}
