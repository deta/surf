import isEqual from 'lodash'
import * as amplitude from '@amplitude/analytics-browser'
import {
  type UserConfig,
  TelemetryEventTypes,
  type ElectronAppInfo,
  CreateTabEventTrigger,
  ActivateTabEventTrigger,
  DeleteTabEventTrigger,
  MoveTabEventAction,
  OpenResourceEventFrom,
  SaveToOasisEventTrigger,
  CreateSpaceEventFrom,
  RefreshSpaceEventTrigger,
  type UpdateSpaceSettingsEventChange,
  UpdateSpaceSettingsEventTrigger,
  OpenSpaceEventTrigger,
  AddResourceToSpaceEventTrigger,
  DeleteSpaceEventTrigger,
  type InlineAIEventPromptType,
  type CreateAnnotationEventType,
  CreateAnnotationEventTrigger,
  type OpenRightSidebarEventTab,
  PageChatUpdateContextEventAction
} from '@horizon/types'

import { HorizonDatabase } from './storage'
import type { Card, CardCreationMetadata } from '../types/index'
import { useLogScope } from '../utils/log'
import type { Tab } from '../components/Browser/types'
import { getPrimaryResourceType } from './resources'
import { getContext, setContext } from 'svelte'

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
      this.log.warn('No user ID found, disabling telemetry')
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

  async trackEvent(
    eventName: TelemetryEventTypes,
    eventProperties: Record<string, any> | undefined
  ) {
    if (!eventName) {
      this.log.warn('No event name provided, not tracking event', eventProperties)
      return
    }

    if (!this.isActive()) {
      this.log.debug('Telemetry is not active, not tracking event', eventName, eventProperties)
      return
    }

    this.log.debug('Tracking event', eventName, eventProperties)

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

  async trackCreatePageTab(trigger: CreateTabEventTrigger, foreground: boolean) {
    await this.trackEvent(TelemetryEventTypes.CreateTab, {
      trigger: trigger,
      foreground: foreground
    })
  }

  async trackActivateTab(trigger: ActivateTabEventTrigger, type: Tab['type']) {
    await this.trackEvent(TelemetryEventTypes.ActivateTab, {
      trigger: trigger,
      type: type
    })
  }

  async trackDeletePageTab(trigger: DeleteTabEventTrigger) {
    await this.trackEvent(TelemetryEventTypes.DeleteTab, {
      trigger: trigger
    })
  }

  async trackMoveTab(action: MoveTabEventAction) {
    await this.trackEvent(TelemetryEventTypes.MoveTab, {
      action: action
    })
  }

  async trackToggleSidebar(open: boolean) {
    await this.trackEvent(TelemetryEventTypes.ToggleSidebar, {
      state: open ? 'open' : 'closed'
    })
  }

  async trackToggleTabsOrientation(state: 'horizontal' | 'vertical') {
    await this.trackEvent(TelemetryEventTypes.ToggleTabsOrientation, {
      state: state
    })
  }

  async trackOpenRightSidebar(tab: OpenRightSidebarEventTab) {
    await this.trackEvent(TelemetryEventTypes.OpenRightSidebar, {
      tab: tab
    })
  }

  async trackFileDownload() {
    await this.trackEvent(TelemetryEventTypes.FileDownload, {})
  }

  async trackDeleteResource(type: string, fromSpace: boolean) {
    await this.trackEvent(TelemetryEventTypes.DeleteResource, {
      type: type,
      kind: getPrimaryResourceType(type),
      from: fromSpace ? 'space' : 'oasis'
    })
  }

  async trackSearchOasis(searchingSpace: boolean) {
    await this.trackEvent(TelemetryEventTypes.SearchOasis, {
      searching: searchingSpace ? 'space' : 'oasis'
    })
  }

  async trackOpenResource(type: string, from: OpenResourceEventFrom = OpenResourceEventFrom.Oasis) {
    await this.trackEvent(TelemetryEventTypes.OpenResource, {
      type: type,
      kind: getPrimaryResourceType(type),
      from: from
    })
  }

  async trackSaveToOasis(type: string, trigger: SaveToOasisEventTrigger, saveToSpace: boolean) {
    await this.trackEvent(TelemetryEventTypes.SaveToOasis, {
      type: type,
      kind: getPrimaryResourceType(type),
      trigger: trigger,
      saveTo: saveToSpace ? 'space' : 'oasis'
    })
  }

  async trackOpenOasis() {
    await this.trackEvent(TelemetryEventTypes.OpenOasis, {})
  }

  async trackCreateSpace(
    from: CreateSpaceEventFrom,
    metadata?: { isLiveSpace?: boolean; createdUsingAI?: boolean }
  ) {
    await this.trackEvent(TelemetryEventTypes.CreateSpace, {
      from: from,
      isLiveSpace: metadata?.isLiveSpace ?? false,
      createdUsingAI: metadata?.createdUsingAI ?? false
    })
  }

  async trackRefreshSpaceContent(
    trigger: RefreshSpaceEventTrigger,
    metadata?: { fetchedSources?: boolean; usedSmartQuery?: boolean; addedResources?: boolean }
  ) {
    await this.trackEvent(TelemetryEventTypes.RefreshSpaceContent, {
      trigger: trigger,
      fetchedSources: metadata?.fetchedSources ?? false,
      usedSmartQuery: metadata?.usedSmartQuery ?? false,
      addedResources: metadata?.addedResources ?? false
    })
  }

  async trackUpdateSpaceSettings(
    change: UpdateSpaceSettingsEventChange,
    trigger: UpdateSpaceSettingsEventTrigger = UpdateSpaceSettingsEventTrigger.SettingsMenu
  ) {
    await this.trackEvent(TelemetryEventTypes.UpdateSpaceSettings, {
      trigger,
      ...change
    })
  }

  async trackChatWithSpace() {
    await this.trackEvent(TelemetryEventTypes.ChatWithSpace, {})
  }

  async trackOpenSpace(trigger: OpenSpaceEventTrigger) {
    await this.trackEvent(TelemetryEventTypes.OpenSpace, {
      trigger: trigger
    })
  }

  async trackDeleteSpace(trigger: DeleteSpaceEventTrigger) {
    await this.trackEvent(TelemetryEventTypes.DeleteSpace, {
      trigger: trigger
    })
  }

  async trackAddResourceToSpace(
    type: string,
    trigger: AddResourceToSpaceEventTrigger,
    moved = false
  ) {
    await this.trackEvent(TelemetryEventTypes.AddResourceToSpace, {
      type: type,
      kind: getPrimaryResourceType(type),
      moved: moved,
      trigger: trigger
    })
  }

  async trackUseInlineAI(prompt: InlineAIEventPromptType, includePageContext: boolean) {
    await this.trackEvent(TelemetryEventTypes.UseInlineAI, {
      prompt: prompt,
      includePageContext: includePageContext
    })
  }

  async trackCreateAnnotation(
    type: CreateAnnotationEventType,
    trigger: CreateAnnotationEventTrigger
  ) {
    await this.trackEvent(TelemetryEventTypes.CreateAnnotation, {
      type: type,
      trigger: trigger
    })
  }

  async trackPageChatMessageSent(numResourcesInContext: number, numPreviousMessages: number) {
    await this.trackEvent(TelemetryEventTypes.PageChatMessageSent, {
      context_size: numResourcesInContext,
      num_messages: numPreviousMessages
    })
  }

  async trackPageChatCitationClick(type: 'timestamp' | 'text') {
    await this.trackEvent(TelemetryEventTypes.PageChatCitationClick, {
      type: type
    })
  }

  async trackPageChatClear(numMessages: number) {
    await this.trackEvent(TelemetryEventTypes.PageChatClear, {
      num_messages: numMessages
    })
  }

  async trackPageChatContextUpdate(action: PageChatUpdateContextEventAction, numResources: number) {
    await this.trackEvent(TelemetryEventTypes.PageChatContextUpdate, {
      action: action,
      context_size: numResources
    })
  }

  async trackGoWildModifyPage() {
    await this.trackEvent(TelemetryEventTypes.GoWildModifyPage, {})
  }

  async trackGoWildCreateApp() {
    await this.trackEvent(TelemetryEventTypes.GoWildCreateApp, {})
  }

  async trackGoWildRerun() {
    await this.trackEvent(TelemetryEventTypes.GoWildRerun, {})
  }

  async trackGoWildClear() {
    await this.trackEvent(TelemetryEventTypes.GoWildClear, {})
  }

  async trackUpdatePrompt(type: string) {
    await this.trackEvent(TelemetryEventTypes.UpdatePrompt, {
      type: type
    })
  }

  async trackResetPrompt(type: string) {
    await this.trackEvent(TelemetryEventTypes.ResetPrompt, {
      type: type
    })
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

  static provideTelemetry(config: TelemetryConfig) {
    const telemetry = new Telemetry(config)
    setContext('telemetry', telemetry)
    return telemetry
  }

  static useTelemetry() {
    return getContext<Telemetry>('telemetry')
  }
}

export const useTelemetry = Telemetry.useTelemetry
export const createTelemetry = Telemetry.provideTelemetry
