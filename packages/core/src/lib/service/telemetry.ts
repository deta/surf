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
  PageChatUpdateContextEventAction,
  type DeleteAnnotationEventType,
  DeleteAnnotationEventTrigger,
  SearchOasisEventTrigger,
  ResourceTypes,
  PageChatMessageSentEventError,
  type AIMessageContext,
  type AIMessageBaseMedia,
  EventContext,
  SelectTabEventAction
} from '@horizon/types'

import { useLogScope } from '@horizon/utils'
import type { Tab } from '../types/browser.types'
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
  async init(userConfig: UserConfig | null = null) {
    if (userConfig) {
      this.userConfig = userConfig
    } else {
      this.userConfig = await window.api.getUserConfig()
    }

    if (!this.userConfig) {
      this.log.warn('No user config found, disabling telemetry')
      this.active = false
      return
    }

    const userID = this.userConfig.user_id
    if (!userID) {
      this.log.warn('No user ID found, disabling telemetry')
      this.active = false
      return
    }

    this.appInfo = await window.api.getAppInfo()

    amplitude.init(this.apiKey, userID, {
      defaultTracking: {
        attribution: false,
        pageViews: false,
        sessions: true,
        formInteractions: false,
        fileDownloads: false
      },
      appVersion: this.appInfo?.version
    })
    amplitude.setOptOut(!this.active)

    window.api.onTrackEvent((eventName, properties) => {
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

  async trackCreateTab(
    trigger: CreateTabEventTrigger,
    foreground: boolean,
    type: Tab['type'] = 'page'
  ) {
    await this.trackEvent(TelemetryEventTypes.CreateTab, {
      trigger: trigger,
      foreground: foreground,
      type: type
    })
  }

  async trackActivateTab(trigger: ActivateTabEventTrigger, type: Tab['type']) {
    await this.trackEvent(TelemetryEventTypes.ActivateTab, {
      trigger: trigger,
      type: type
    })
  }

  async trackActivateTabSpace(trigger: ActivateTabEventTrigger) {
    await this.trackEvent(TelemetryEventTypes.ActivateTabSpace, {
      trigger: trigger
    })
  }

  async trackSelectTab(
    action: SelectTabEventAction,
    numTabsInSelection: number,
    numChanged: number = 1
  ) {
    await this.trackEvent(TelemetryEventTypes.SelectTab, {
      action: action,
      selection_size: numTabsInSelection,
      changed: numChanged
    })
  }

  async trackDeletePageTab(trigger: DeleteTabEventTrigger) {
    await this.trackEvent(TelemetryEventTypes.DeleteTab, {
      trigger: trigger
    })
  }

  async trackDeleteSpaceTab(trigger: DeleteTabEventTrigger) {
    await this.trackEvent(TelemetryEventTypes.DeleteTabSpace, {
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

    if (tab === 'chat') {
      await this.trackOpenPageChat()
    } else if (tab === 'go-wild') {
      await this.trackOpenGoWild()
    } else if (tab === 'annotations') {
      await this.trackOpenAnnotations()
    }
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

  async trackSearchOasis(trigger: SearchOasisEventTrigger, searchingSpace: boolean) {
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

    if (type === ResourceTypes.ANNOTATION) {
      await this.trackEvent(TelemetryEventTypes.OpenAnnotationResource, {
        from: from
      })
    }
  }

  async trackSaveToOasis(
    type: string,
    trigger: SaveToOasisEventTrigger,
    saveToSpace: boolean,
    context?: EventContext,
    baseMedia?: 'image' | 'text'
  ) {
    await this.trackEvent(TelemetryEventTypes.SaveToOasis, {
      type,
      kind: getPrimaryResourceType(type),
      trigger: trigger,
      saveTo: saveToSpace ? 'space' : 'oasis',
      context,
      base_media: baseMedia
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

  async trackOpenSpace(
    trigger: OpenSpaceEventTrigger,
    metadata?: { isLiveSpace?: boolean; hasSources?: boolean; hasSmartQuery?: boolean }
  ) {
    await this.trackEvent(TelemetryEventTypes.OpenSpace, {
      trigger: trigger,
      isLiveSpace: metadata?.isLiveSpace ?? false,
      hasSources: metadata?.hasSources ?? false,
      hasSmartQuery: metadata?.hasSmartQuery ?? false
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

  async trackDeleteAnnotation(
    type: DeleteAnnotationEventType,
    trigger: DeleteAnnotationEventTrigger
  ) {
    await this.trackEvent(TelemetryEventTypes.DeleteAnnotation, {
      type: type,
      trigger: trigger
    })
  }

  async trackOpenAnnotations() {
    await this.trackEvent(TelemetryEventTypes.OpenAnnotationSidebar, {})
  }

  async trackPageChatMessageSent(stats: {
    contextSize: number
    numSpaces: number
    numPages: number
    numPreviousMessages: number
    embeddingModel?: string
    error?: PageChatMessageSentEventError
  }) {
    await this.trackEvent(TelemetryEventTypes.PageChatMessageSent, {
      context_size: stats.contextSize,
      num_spaces: stats.numSpaces,
      num_pages: stats.numPages,
      num_messages: stats.numPreviousMessages,
      embedding_model: stats.embeddingModel,
      error: stats.error
    })
  }

  async trackPageChatCitationClick(type: 'timestamp' | 'text', sourceTabType: 'page' | 'space') {
    await this.trackEvent(TelemetryEventTypes.PageChatCitationClick, {
      type: type,
      sourceTabType: sourceTabType
    })
  }

  async trackPageChatCitationClickResourceFromSpace(type: 'timestamp' | 'text') {
    await this.trackEvent(TelemetryEventTypes.PageChatCitationClickResourceFromSpace, {
      type: type
    })
  }

  async trackPageChatClear(numMessages: number) {
    await this.trackEvent(TelemetryEventTypes.PageChatClear, {
      num_messages: numMessages
    })
  }

  async trackPageChatContextUpdate(
    action: PageChatUpdateContextEventAction,
    numResources: number,
    numChanged: number = 1
  ) {
    await this.trackEvent(TelemetryEventTypes.PageChatContextUpdate, {
      action: action,
      context_size: numResources,
      changed: numChanged
    })
  }

  async trackOpenPageChat() {
    await this.trackEvent(TelemetryEventTypes.OpenPageChatSidebar, {})
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

  async trackOpenGoWild() {
    await this.trackEvent(TelemetryEventTypes.OpenGoWildSidebar, {})
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

  async trackAskInlineAI(data: { isFollowUp: boolean; baseMedia: AIMessageBaseMedia }) {
    await this.trackEvent(TelemetryEventTypes.AskInlineAI, {
      is_follow_up: data.isFollowUp,
      base_media: data.baseMedia
    })
  }

  async trackCopyScreenshot() {
    await this.trackEvent(TelemetryEventTypes.CopyScreenshot, {})
  }

  async trackSaveAIResponse(data: { context: AIMessageContext; baseMedia: AIMessageBaseMedia }) {
    await this.trackEvent(TelemetryEventTypes.SaveAIResponse, {
      context: data.context,
      base_media: data.baseMedia
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
