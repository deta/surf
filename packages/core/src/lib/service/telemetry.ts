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
  SelectTabEventAction,
  DeleteResourceEventTrigger,
  MultiSelectResourceEventAction,
  PageChatUpdateContextEventTrigger,
  OpenHomescreenEventTrigger,
  OpenInMiniBrowserEventFrom,
  ChangeContextEventTrigger,
  BrowserContextScope,
  RemoveHomescreenItemEventTrigger,
  AddHomescreenItemEventTrigger,
  AddHomescreenItemEventSource,
  UpdateHomescreenEventAction,
  PageChatUpdateContextItemType,
  PageChatMessageSentEventTrigger,
  PromptType,
  GeneratePromptsEventTrigger,
  MentionEventType,
  SummarizeEventContentSource,
  NoteCreateCitationEventTrigger,
  type PageChatMessageSentData
} from '@horizon/types'

import { useLogScope } from '@horizon/utils'
import type { Tab } from '../types/browser.types'
import { getPrimaryResourceType } from './resources'
import { getContext, setContext } from 'svelte'
import type { ConfigService } from './config'
import { UserStatsService } from './userStats'
import type { MentionAction } from '@horizon/editor/src/lib/extensions/Mention'
import { DragTypeNames } from '../types'

export type TelemetryConfig = {
  apiKey: string
  active: boolean
  trackHostnames: boolean
  proxyUrl?: string
}

export enum HorizonActivationSource {
  Overview = 'overview',
  Oasis = 'oasis'
}

interface UserProperties {
  anon_telemetry: boolean
  personas: string[]
  email?: string
  app_style?: string
  tabs_orientation?: string
  default_browser?: boolean
  extensions_enabled?: boolean
}

// TODO: how much does telemetry hurt performance?
export class Telemetry {
  apiKey: string
  active: boolean
  trackHostnames: boolean
  proxyUrl?: string
  userConfig: UserConfig | null
  configService: ConfigService | null
  appInfo: ElectronAppInfo | null
  personas: string[]

  log: ReturnType<typeof useLogScope>

  constructor(config: TelemetryConfig) {
    this.apiKey = config.apiKey
    this.active = config.active
    this.trackHostnames = config.trackHostnames
    this.proxyUrl = config.proxyUrl

    this.userConfig = null
    this.configService = null
    this.appInfo = null
    this.personas = []
    this.log = useLogScope('telemetry')
  }

  async init(userConfig: UserConfig | null = null, configService: ConfigService | null = null) {
    if (userConfig) {
      this.userConfig = userConfig
    } else {
      this.userConfig = await window.api.getUserConfig()
    }

    if (configService) {
      this.configService = configService
    }

    if (!this.userConfig) {
      this.log.warn('No user config found, disabling telemetry')
      this.active = false
      return
    }

    this.personas = this.userConfig.settings.personas || []
    this.appInfo = await window.api.getAppInfo()
    const initOptions = {
      // TODO: default tracking will be deprecated by the ampltiude SDK
      defaultTracking: {
        sessions: true,
        attribution: false,
        pageViews: false,
        formInteractions: false,
        fileDownloads: false
      },
      trackingOptions: {
        ipAddress: false,
        platform: true
      },
      appVersion: this.appInfo?.version,
      serverUrl: this.proxyUrl
    }

    // HACK: We always use the anon_id if present, as if that was used at any time,
    // we have to keep it so that we dont loose the Amplitude unique user references…
    // We can never change the user_id after it was in use once!
    let userID = this.userConfig.anon_id ?? this.userConfig.user_id

    if (!userID) {
      this.log.warn('No user/anon ID found, disabling telemetry')
      this.active = false
      return
    }

    if (this.proxyUrl) {
      this.log.debug('Using telemetry proxy', this.proxyUrl)
      if (!this.userConfig.api_key) {
        this.log.warn('No user API key found for telemetry proxy, disabling telemetry')
        this.active = false
        return
      }
      this.apiKey = this.userConfig.api_key
    }
    amplitude.init(this.apiKey, userID, initOptions)
    amplitude.setOptOut(!this.active)

    window.api.onTrackEvent((eventName, properties) => {
      this.log.debug('Received track event from main process', eventName, properties)
      this.trackEvent(eventName, properties)
    })
    window.api.onUserConfigSettingsChange((settings) => {
      if (!this.userConfig) return
      this.userConfig.settings = settings
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

    const userSettings = this.configService?.getSettings()

    let user_properties: UserProperties = {
      anon_telemetry: this.userConfig?.anon_telemetry ?? false,
      personas: this.personas,
      app_style: userSettings?.app_style || this.userConfig?.settings.app_style,
      tabs_orientation:
        userSettings?.tabs_orientation ?? this.userConfig?.settings.tabs_orientation,
      default_browser: this.userConfig?.defaultBrowser,
      extensions_enabled: userSettings?.extensions ?? false
    }

    if (!this.isActive()) {
      this.log.debug(
        'Telemetry is not active, not tracking event',
        eventName,
        eventProperties,
        user_properties
      )
      return
    }

    if (!this.userConfig?.anon_telemetry) {
      user_properties = {
        ...user_properties
        // NOTE: Not doing this any more -> we just notify baclkend of our anon_id / email
        //email: this.userConfig?.email
      }
    }

    this.log.debug('Tracking event', eventName, eventProperties, user_properties)

    amplitude.track({
      event_type: eventName,
      event_properties: eventProperties,
      platform: this.appInfo?.platform,
      app_version: this.appInfo?.version,
      user_properties: user_properties
    })
  }

  async trackCreateTab(
    trigger: CreateTabEventTrigger,
    foreground: boolean,
    type: Tab['type'] = 'page',
    scope: BrowserContextScope = BrowserContextScope.General
  ) {
    await this.trackEvent(TelemetryEventTypes.CreateTab, {
      trigger: trigger,
      foreground: foreground,
      type: type,
      scope: scope
    })
  }

  async trackActivateTab(
    trigger: ActivateTabEventTrigger,
    type: Tab['type'],
    scope: BrowserContextScope = BrowserContextScope.General
  ) {
    await this.trackEvent(TelemetryEventTypes.ActivateTab, {
      trigger: trigger,
      type: type,
      scope: scope
    })
  }

  async trackActivateTabSpace(
    trigger: ActivateTabEventTrigger,
    scope: BrowserContextScope = BrowserContextScope.General
  ) {
    await this.trackEvent(TelemetryEventTypes.ActivateTabSpace, {
      trigger: trigger,
      scope: scope
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

  async trackDeletePageTab(
    trigger: DeleteTabEventTrigger,
    scope: BrowserContextScope = BrowserContextScope.General
  ) {
    await this.trackEvent(TelemetryEventTypes.DeleteTab, {
      trigger: trigger,
      scope: scope
    })
  }

  async trackDeleteSpaceTab(
    trigger: DeleteTabEventTrigger,
    scope: BrowserContextScope = BrowserContextScope.General
  ) {
    await this.trackEvent(TelemetryEventTypes.DeleteTabSpace, {
      trigger: trigger,
      scope: scope
    })
  }

  async trackMoveTab(action: MoveTabEventAction) {
    await this.trackEvent(TelemetryEventTypes.MoveTab, {
      action: action
    })
  }

  async trackContextSwitch(
    trigger: ChangeContextEventTrigger,
    from: BrowserContextScope,
    to: BrowserContextScope
  ) {
    await this.trackEvent(TelemetryEventTypes.SwitchContext, {
      trigger: trigger,
      from: from,
      to: to
    })

    UserStatsService.incStat('global_n_context_switches')
  }

  async trackMoveTabToContext(from: BrowserContextScope, to: BrowserContextScope) {
    await this.trackEvent(TelemetryEventTypes.MoveTabToContext, {
      from: from,
      to: to
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
    } else if (tab === 'annotations') {
      await this.trackOpenAnnotations()
    }
  }

  async trackFileDownload() {
    await this.trackEvent(TelemetryEventTypes.FileDownload, {})
  }

  async trackDeleteResource(
    type: string,
    fromSpace: boolean,
    trigger: DeleteResourceEventTrigger = DeleteResourceEventTrigger.OasisItem
  ) {
    await this.trackEvent(TelemetryEventTypes.DeleteResource, {
      type: type,
      kind: getPrimaryResourceType(type),
      from: fromSpace ? 'space' : 'oasis',
      trigger: trigger
    })
  }

  async trackMultiSelectResourceAction(
    action: MultiSelectResourceEventAction,
    count: number,
    context: 'space' | 'oasis' = 'oasis'
  ) {
    await this.trackEvent(TelemetryEventTypes.MultiSelectResourceAction, {
      action: action,
      count: count,
      context: context
    })
  }

  async trackSearchOasis(trigger: SearchOasisEventTrigger, searchingSpace: boolean) {
    await this.trackEvent(TelemetryEventTypes.SearchOasis, {
      searching: searchingSpace ? 'space' : 'oasis'
    })
  }

  async trackOpenResource(type: string, from: OpenResourceEventFrom = OpenResourceEventFrom.Oasis) {
    UserStatsService.incStat('global_n_open_resource')

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

  async trackOpenInMiniBrowser(type: 'page' | 'resource', from?: OpenInMiniBrowserEventFrom) {
    await this.trackEvent(TelemetryEventTypes.OpenInMiniBrowser, {
      type: type,
      from: from
    })
  }

  async trackSaveToOasis(
    type: string,
    trigger: SaveToOasisEventTrigger,
    saveToSpace: boolean,
    context?: EventContext,
    baseMedia?: 'image' | 'text'
  ) {
    UserStatsService.incStat('global_n_saves_to_oasis')

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
    metadata?: {
      isLiveSpace?: boolean
      createdUsingAI?: boolean
      numberOfPrompts?: number
      numberOfBlacklistedItems?: number
    }
  ) {
    UserStatsService.incStat('global_n_contexts_created')

    await this.trackEvent(TelemetryEventTypes.CreateSpace, {
      from: from,
      isLiveSpace: metadata?.isLiveSpace ?? false,
      createdUsingAI: metadata?.createdUsingAI ?? false,
      numberOfPrompts: metadata?.numberOfPrompts,
      numberOfBlacklistedItems: metadata?.numberOfBlacklistedItems
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

  async trackChatWithSpace(
    trigger?: PageChatMessageSentEventTrigger,
    error?: PageChatMessageSentEventError
  ) {
    UserStatsService.incStat('global_n_chatted_with_space')
    await this.trackEvent(TelemetryEventTypes.ChatWithSpace, {
      error,
      trigger
    })
  }

  async trackOpenResourceInChat() {
    await this.trackEvent(TelemetryEventTypes.OpenResourceInChat, {})
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
    UserStatsService.incStat('global_n_create_annotation')

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

  async trackPageChatMessageSent(stats: PageChatMessageSentData) {
    UserStatsService.incStat('global_n_chat_message_sent')

    await this.trackEvent(TelemetryEventTypes.PageChatMessageSent, {
      context_size: stats.contextSize,
      num_spaces: stats.numSpaces,
      num_tabs: stats.numTabs,
      num_resources: stats.numResources,
      num_screenshots: stats.numScreenshots,
      num_messages: stats.numPreviousMessages,
      took_page_screen: stats.tookPageScreenshot,
      embedding_model: stats.embeddingModel,
      chat_model_provider: stats.chatModelProvider,
      chat_model_name: stats.chatModelName,
      error: stats.error,
      trigger: stats.trigger,
      onboarding: stats.onboarding,
      generated_artifact: stats.generatedArtifact
    })
  }

  async trackSimilaritySearch(stats: PageChatMessageSentData) {
    await this.trackEvent(TelemetryEventTypes.SimilaritySearch, {
      context_size: stats.contextSize,
      num_spaces: stats.numSpaces,
      num_tabs: stats.numTabs,
      num_resources: stats.numResources,
      num_screenshots: stats.numScreenshots,
      num_messages: stats.numPreviousMessages,
      took_page_screen: stats.tookPageScreenshot,
      embedding_model: stats.embeddingModel,
      chat_model_provider: stats.chatModelProvider,
      chat_model_name: stats.chatModelName,
      error: stats.error,
      trigger: stats.trigger,
      onboarding: stats.onboarding,
      generated_artifact: stats.generatedArtifact
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
    numChanged: number = 1,
    type?: PageChatUpdateContextItemType,
    trigger: PageChatUpdateContextEventTrigger = PageChatUpdateContextEventTrigger.TabSelection
  ) {
    await this.trackEvent(TelemetryEventTypes.PageChatContextUpdate, {
      action: action,
      item_type: type,
      context_size: numResources,
      changed: numChanged,
      trigger: trigger
    })
  }

  async trackOpenPageChat() {
    await this.trackEvent(TelemetryEventTypes.OpenPageChatSidebar, {})
  }

  async trackSummarizeText(contentSource: SummarizeEventContentSource, context: EventContext) {
    await this.trackEvent(TelemetryEventTypes.SummarizeText, {
      content_source: contentSource,
      context: context
    })
  }

  async trackGeneratePrompts(
    context: EventContext,
    trigger: GeneratePromptsEventTrigger,
    onboarding = false
  ) {
    await this.trackEvent(TelemetryEventTypes.GeneratePrompts, {
      trigger,
      context: context,
      onboarding
    })
  }

  async trackUsePrompt(type: PromptType, context: EventContext, name?: string, onboarding = false) {
    await this.trackEvent(TelemetryEventTypes.UsePrompt, {
      type: type,
      context: context,
      name,
      onboarding
    })
  }

  async trackUpdatePrompt(type: PromptType, name?: string) {
    await this.trackEvent(TelemetryEventTypes.UpdatePrompt, {
      name: name,
      type: type
    })
  }

  async trackResetPrompt(type: PromptType, name?: string) {
    await this.trackEvent(TelemetryEventTypes.ResetPrompt, {
      name: name,
      type: type
    })
  }

  async trackCreatePrompt(type: PromptType, name?: string) {
    await this.trackEvent(TelemetryEventTypes.CreatePrompt, {
      name: name,
      type: type
    })
  }

  async trackDeletePrompt(type: PromptType, name?: string) {
    await this.trackEvent(TelemetryEventTypes.DeletePrompt, {
      name: name,
      type: type
    })
  }

  async trackAskInlineAI(data: { isFollowUp: boolean; baseMedia: AIMessageBaseMedia }) {
    UserStatsService.incStat('global_n_use_inline_tools')

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

  async trackOpenHomescreen(trigger: OpenHomescreenEventTrigger) {
    UserStatsService.incStat('global_n_open_homescreen')

    await this.trackEvent(TelemetryEventTypes.OpenHomescreen, {
      trigger
    })
  }

  async trackAddHomescreenItem(
    trigger: AddHomescreenItemEventTrigger,
    type: 'resource' | 'space',
    source?: AddHomescreenItemEventSource
  ) {
    await this.trackEvent(TelemetryEventTypes.AddHomescreenItem, {
      trigger,
      type,
      source
    })
  }

  async trackRemoveHomescreenItem(trigger: RemoveHomescreenItemEventTrigger) {
    await this.trackEvent(TelemetryEventTypes.RemoveHomescreenItem, {
      trigger
    })
  }

  async trackUpdateHomescreen(action: UpdateHomescreenEventAction) {
    UserStatsService.incStat('global_n_update_homescreen')

    await this.trackEvent(TelemetryEventTypes.UpdateHomescreen, {
      action
    })
  }

  async trackChangeTelemetryAnonymization(anonymize: boolean) {
    await this.trackEvent(TelemetryEventTypes.ChangeTelemetryAnonymization, {
      anonymize
    })
  }

  async trackCreateNote(context: EventContext) {
    await this.trackEvent(TelemetryEventTypes.CreateNote, {
      context
    })
  }

  async trackUpdateNote(context: EventContext = EventContext.Note) {
    await this.trackEvent(TelemetryEventTypes.UpdateNote, {
      context
    })
  }

  async trackNoteCreateMention(type: MentionEventType, onboarding = false) {
    await this.trackEvent(TelemetryEventTypes.NoteCreateMention, {
      type,
      onboarding
    })
  }

  async trackNoteOpenMention(type: MentionEventType, target: MentionAction, onboarding = false) {
    await this.trackEvent(TelemetryEventTypes.NoteOpenMention, {
      type,
      target,
      onboarding
    })
  }

  async trackNoteInsertSimilarSource(
    resourceType: string,
    summarized: boolean,
    onboarding = false
  ) {
    await this.trackEvent(TelemetryEventTypes.NoteInsertSimilarSource, {
      type: resourceType,
      kind: getPrimaryResourceType(resourceType),
      summarized,
      onboarding
    })
  }

  async trackNoteChangeContext(type: MentionEventType, onboarding = false) {
    await this.trackEvent(TelemetryEventTypes.NoteChangeContext, {
      type,
      onboarding
    })
  }

  async trackNoteOnboardingChangeStep(to: number, from: number) {
    await this.trackEvent(TelemetryEventTypes.NoteOnboardingChangeStep, {
      to,
      from
    })
  }

  async trackNoteCreateCitation(
    resourceTypeOrSpace: string,
    trigger: NoteCreateCitationEventTrigger,
    onboarding = false
  ) {
    await this.trackEvent(TelemetryEventTypes.NoteCreateCitation, {
      type: resourceTypeOrSpace,
      kind:
        resourceTypeOrSpace === DragTypeNames.SURF_SPACE
          ? 'space'
          : getPrimaryResourceType(resourceTypeOrSpace),
      trigger,
      onboarding
    })
  }

  async trackOpenResourceInSidebar(resourceType: string) {
    await this.trackEvent(TelemetryEventTypes.OpenResourceInSidebar, {
      type: resourceType
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
