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
  type PageChatMessageSentData,
  DragTypeNames,
  type MentionAction,
  TelemetryCreateTabSource,
  TelemetryViewType,
  TelemetryEventTriggerSurface
} from '@deta/types'

import { useLogScope } from '@deta/utils/io'
import { isMainRenderer } from '@deta/utils/system'
import { getPrimaryResourceType } from './resources/resources'
import { getContext, setContext } from 'svelte'
import type { ConfigService } from './config'
import { UserStatsService } from './userStats'
import { useMessagePortClient } from './messagePort'

export type TelemetryConfig = {
  apiKey: string
  active: boolean
  proxyUrl?: string
}

interface UserProperties {
  anon_telemetry: boolean
  email?: string

  personas: string[]
  default_browser?: boolean
}

export class Telemetry {
  apiKey: string
  active: boolean
  proxyUrl?: string
  userConfig: UserConfig | null
  configService: ConfigService | null
  appInfo: ElectronAppInfo | null
  personas: string[]
  messagePort: MessagePortClient

  log: ReturnType<typeof useLogScope>

  constructor(config: TelemetryConfig) {
    this.apiKey = config.apiKey
    this.active = config.active
    this.proxyUrl = config.proxyUrl

    this.userConfig = null
    this.configService = null
    this.appInfo = null
    this.personas = []
    this.log = useLogScope('telemetry')
  }

  async init({ configService, messagePort }: { configService?: ConfigService; messagePort?: any }) {
    if (isMainRenderer() && !configService)
      throw new Error('Attempted to init telemetry in main renderer without ConfigService!')

    if (isMainRenderer()) return this.#init(configService as ConfigService)
    else if (!messagePort)
      throw new Error('Attempted to init telemetry outside main renderer without MessagePort!')

    this.messagePort = messagePort
  }

  /** Called in main renderer only! */
  async #init(configService: ConfigService) {
    // @ts-ignore
    this.userConfig = await configService.getConfig()

    if (!this.userConfig) {
      this.log.warn('No user config found, disabling telemetry')
      this.active = false
      return
    }

    this.personas = this.userConfig.settings.personas || []
    // @ts-ignore
    this.appInfo = await window.api.getAppInfo()
    this.active = true
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

    // @ts-ignore
    window.api.onTrackEvent((eventName, properties) => {
      this.log.debug('Received track event from main process', eventName, properties)
      this.trackEvent(eventName, properties)
    })
    // @ts-ignore
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
    return (this.apiKey || this.messagePort) && this.active
  }

  trackEvent(eventName: TelemetryEventTypes, eventProperties?: Record<string, any>) {
    if (isMainRenderer()) return this.#trackEvent(eventName, eventProperties)

    this.log.debug('Telemetry forwarding event', eventName, eventProperties)

    this.messagePort.trackEvent.send({ eventName, eventProperties })
  }

  /** Main renderer implementation actually tracking the event */
  #trackEvent(eventName: TelemetryEventTypes, eventProperties?: Record<string, any>) {
    if (!isMainRenderer())
      throw new Error('Attempted to call #trackEvent from outside main renderer!')

    if (!eventName) {
      this.log.warn('No event name provided, not tracking event', eventProperties)
      return
    }

    const userSettings = this.configService?.getSettings()

    let user_properties: UserProperties = {
      anon_telemetry: this.userConfig?.anon_telemetry ?? false,
      personas: this.personas,
      default_browser: this.userConfig?.defaultBrowser
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

    return amplitude.track({
      event_type: eventName,
      event_properties: eventProperties,
      platform: this.appInfo?.platform,
      app_version: this.appInfo?.version,
      user_properties: user_properties
    })
  }

  // General
  trackCreateTab(source: TelemetryCreateTabSource) {
    return this.trackEvent(TelemetryEventTypes.CreateTab, {
      source
    })
  }
  trackActivateTab(viewType: TelemetryViewType, resource_type?: string) {
    if (viewType !== TelemetryViewType.Resource && resource_type !== undefined)
      throw new Error('[Telemetry] Tracking non-resource tab activation with resource_type')
    return this.trackEvent(TelemetryEventTypes.ActivateTab, {
      tab_type: viewType,
      resource_type
    })
  }
  trackDeleteTab() {
    return this.trackEvent(TelemetryEventTypes.DeleteTab, {})
  }
  trackOpenSidebar(viewType: TelemetryViewType, resource_type?: string) {
    if (viewType !== TelemetryViewType.Resource && resource_type !== undefined)
      throw new Error('[Telemetry] Tracking non-resource tab activation with resource_type')
    return this.trackEvent(TelemetryEventTypes.OpenSidebar, {
      tab_type: viewType,
      resource_type
    })
  }

  // Resources
  trackNotebookAddResource(resource_type: string) {
    return this.trackEvent(TelemetryEventTypes.NotebookAddResource, {
      resource_type
    })
  }
  trackNotebookRemoveResource() {
    return this.trackEvent(TelemetryEventTypes.NotebookRemoveResource, {})
  }
  trackSurfAddResource(resource_type: string) {
    return this.trackEvent(TelemetryEventTypes.SurfAddResource, {
      resource_type
    })
  }
  trackSurfRemoveResource() {
    return this.trackEvent(TelemetryEventTypes.SurfRemoveResource, {})
  }

  // Notebook
  trackNotebookCreate() {
    return this.trackEvent(TelemetryEventTypes.NotebookCreate, {})
  }
  trackNotebookDelete() {
    return this.trackEvent(TelemetryEventTypes.NotebookDelete, {})
  }
  trackNotebookOpen() {
    return this.trackEvent(TelemetryEventTypes.NotebookOpen, {})
  }

  // Notes
  trackNoteCreate() {
    return this.trackEvent(TelemetryEventTypes.NoteCreate, {})
  }
  trackNoteDelete() {
    return this.trackEvent(TelemetryEventTypes.NoteDelete, {})
  }
  trackNoteOpen(/* trigger_surface: TelemetryEventTriggerSurface */) {
    return this.trackEvent(TelemetryEventTypes.NoteOpen, {
      //trigger_surface
    })
  }
  trackNoteUpdate(/* trigger_surface: TelemetryEventTriggerSurface */) {
    return this.trackEvent(TelemetryEventTypes.NoteUpdate, {
      //trigger_surface
    })
  }
  trackNoteGenerateCompletion({ failed }: { failed?: boolean }) {
    return this.trackEvent(TelemetryEventTypes.NoteGenerateCompletion, {
      failed
      //trigger_surface
    })
  }

  // === OLD SURF-alpha events =============================
  // Deprecated but kept definitions in case of existing imports and old sht

  //async trackCreateTab(
  //  trigger: CreateTabEventTrigger,
  //  foreground: boolean,
  //  type = 'page',
  //  scope: BrowserContextScope = BrowserContextScope.General
  //) {
  //  await this.trackEvent(TelemetryEventTypes.CreateTab, {
  //    trigger: trigger,
  //    foreground: foreground,
  //    type: type,
  //    scope: scope
  //  })
  //}

  //async trackActivateTab(
  //  trigger: ActivateTabEventTrigger,
  //  type: string,
  //  scope: BrowserContextScope = BrowserContextScope.General
  //) {
  //  await this.trackEvent(TelemetryEventTypes.ActivateTab, {
  //    trigger: trigger,
  //    type: type,
  //    scope: scope
  //  })
  //}

  /** @deprecated */
  async trackActivateTabSpace(
    trigger: ActivateTabEventTrigger,
    scope: BrowserContextScope = BrowserContextScope.General
  ) {
    //await this.trackEvent(TelemetryEventTypes.ActivateTabSpace, {
    //  trigger: trigger,
    //  scope: scope
    //})
  }

  /** @deprecated */
  async trackSelectTab(
    action: SelectTabEventAction,
    numTabsInSelection: number,
    numChanged: number = 1
  ) {
    //await this.trackEvent(TelemetryEventTypes.SelectTab, {
    //  action: action,
    //  selection_size: numTabsInSelection,
    //  changed: numChanged
    //})
  }

  /** @deprecated */
  async trackDeletePageTab(
    trigger: DeleteTabEventTrigger,
    scope: BrowserContextScope = BrowserContextScope.General
  ) {
    //await this.trackEvent(TelemetryEventTypes.DeleteTab, {
    //  trigger: trigger,
    //  scope: scope
    //})
  }

  /** @deprecated */
  async trackDeleteSpaceTab(
    trigger: DeleteTabEventTrigger,
    scope: BrowserContextScope = BrowserContextScope.General
  ) {
    //await this.trackEvent(TelemetryEventTypes.DeleteTabSpace, {
    //  trigger: trigger,
    //  scope: scope
    //})
  }

  /** @deprecated */
  async trackMoveTab(action: MoveTabEventAction) {
    //await this.trackEvent(TelemetryEventTypes.MoveTab, {
    //  action: action
    //})
  }

  /** @deprecated */
  async trackContextSwitch(
    trigger: ChangeContextEventTrigger,
    from: BrowserContextScope,
    to: BrowserContextScope
  ) {
    //await this.trackEvent(TelemetryEventTypes.SwitchContext, {
    //  trigger: trigger,
    //  from: from,
    //  to: to
    //})
    //UserStatsService.incStat('global_n_context_switches')
  }

  /** @deprecated */
  async trackMoveTabToContext(from: BrowserContextScope, to: BrowserContextScope) {
    //await this.trackEvent(TelemetryEventTypes.MoveTabToContext, {
    //  from: from,
    //  to: to
    //})
  }

  /** @deprecated */
  async trackToggleSidebar(open: boolean) {
    //await this.trackEvent(TelemetryEventTypes.ToggleSidebar, {
    //  state: open ? 'open' : 'closed'
    //})
  }

  /** @deprecated */
  async trackToggleTabsOrientation(state: 'horizontal' | 'vertical') {
    //await this.trackEvent(TelemetryEventTypes.ToggleTabsOrientation, {
    //  state: state
    //})
  }

  /** @deprecated */
  async trackOpenRightSidebar(tab: OpenRightSidebarEventTab) {
    //await this.trackEvent(TelemetryEventTypes.OpenRightSidebar, {
    //  tab: tab
    //})
    //if (tab === 'chat') {
    //  await this.trackOpenPageChat()
    //} else if (tab === 'annotations') {
    //  await this.trackOpenAnnotations()
    //}
  }

  /** @deprecated */
  async trackFileDownload() {
    //await this.trackEvent(TelemetryEventTypes.FileDownload, {})
  }

  /** @deprecated */
  async trackDeleteResource(
    type: string,
    fromSpace: boolean,
    trigger: DeleteResourceEventTrigger = DeleteResourceEventTrigger.OasisItem
  ) {
    //await this.trackEvent(TelemetryEventTypes.DeleteResource, {
    //  type: type,
    //  kind: getPrimaryResourceType(type),
    //  from: fromSpace ? 'space' : 'oasis',
    //  trigger: trigger
    //})
  }

  /** @deprecated */
  async trackMultiSelectResourceAction(
    action: MultiSelectResourceEventAction,
    count: number,
    context: 'space' | 'oasis' = 'oasis'
  ) {
    //await this.trackEvent(TelemetryEventTypes.MultiSelectResourceAction, {
    //  action: action,
    //  count: count,
    //  context: context
    //})
  }

  /** @deprecated */
  async trackSearchOasis(trigger: SearchOasisEventTrigger, searchingSpace: boolean) {
    //await this.trackEvent(TelemetryEventTypes.SearchOasis, {
    //  searching: searchingSpace ? 'space' : 'oasis'
    //})
  }

  /** @deprecated */
  async trackOpenResource(type: string, from: OpenResourceEventFrom = OpenResourceEventFrom.Oasis) {
    //UserStatsService.incStat('global_n_open_resource')
    //await this.trackEvent(TelemetryEventTypes.OpenResource, {
    //  type: type,
    //  kind: getPrimaryResourceType(type),
    //  from: from
    //})
    //if (type === ResourceTypes.ANNOTATION) {
    //  await this.trackEvent(TelemetryEventTypes.OpenAnnotationResource, {
    //    from: from
    //  })
    //}
  }

  /** @deprecated */
  async trackOpenInMiniBrowser(type: 'page' | 'resource', from?: OpenInMiniBrowserEventFrom) {
    //await this.trackEvent(TelemetryEventTypes.OpenInMiniBrowser, {
    //  type: type,
    //  from: from
    //})
  }

  /** @deprecated */
  async trackSaveToOasis(
    type: string,
    trigger: SaveToOasisEventTrigger,
    saveToSpace: boolean,
    context?: EventContext,
    baseMedia?: 'image' | 'text'
  ) {
    //UserStatsService.incStat('global_n_saves_to_oasis')
    //await this.trackEvent(TelemetryEventTypes.SaveToOasis, {
    //  type,
    //  kind: getPrimaryResourceType(type),
    //  trigger: trigger,
    //  saveTo: saveToSpace ? 'space' : 'oasis',
    //  context,
    //  base_media: baseMedia
    //})
  }

  /** @deprecated */
  async trackOpenOasis() {
    //await this.trackEvent(TelemetryEventTypes.OpenOasis, {})
  }

  /** @deprecated */
  async trackCreateSpace(
    from: CreateSpaceEventFrom,
    metadata?: {
      isLiveSpace?: boolean
      createdUsingAI?: boolean
      numberOfPrompts?: number
      numberOfBlacklistedItems?: number
    }
  ) {
    //UserStatsService.incStat('global_n_contexts_created')
    //await this.trackEvent(TelemetryEventTypes.CreateSpace, {
    //  from: from,
    //  isLiveSpace: metadata?.isLiveSpace ?? false,
    //  createdUsingAI: metadata?.createdUsingAI ?? false,
    //  numberOfPrompts: metadata?.numberOfPrompts,
    //  numberOfBlacklistedItems: metadata?.numberOfBlacklistedItems
    //})
  }

  /** @deprecated */
  async trackLinkSpace() {
    //await this.trackEvent(TelemetryEventTypes.LinkSpace, {})
  }

  /** @deprecated */
  async trackRefreshSpaceContent(
    trigger: RefreshSpaceEventTrigger,
    metadata?: {
      fetchedSources?: boolean
      usedSmartQuery?: boolean
      addedResources?: boolean
    }
  ) {
    //await this.trackEvent(TelemetryEventTypes.RefreshSpaceContent, {
    //  trigger: trigger,
    //  fetchedSources: metadata?.fetchedSources ?? false,
    //  usedSmartQuery: metadata?.usedSmartQuery ?? false,
    //  addedResources: metadata?.addedResources ?? false
    //})
  }

  /** @deprecated */
  async trackUpdateSpaceSettings(
    change: UpdateSpaceSettingsEventChange,
    trigger: UpdateSpaceSettingsEventTrigger = UpdateSpaceSettingsEventTrigger.SettingsMenu
  ) {
    //await this.trackEvent(TelemetryEventTypes.UpdateSpaceSettings, {
    //  trigger,
    //  ...change
    //})
  }

  /** @deprecated */
  async trackChatWithSpace(
    trigger?: PageChatMessageSentEventTrigger,
    error?: PageChatMessageSentEventError
  ) {
    //UserStatsService.incStat('global_n_chatted_with_space')
    //await this.trackEvent(TelemetryEventTypes.ChatWithSpace, {
    //  error,
    //  trigger
    //})
  }

  /** @deprecated */
  async trackOpenResourceInChat() {
    //await this.trackEvent(TelemetryEventTypes.OpenResourceInChat, {})
  }

  /** @deprecated */
  async trackOpenSpace(
    trigger: OpenSpaceEventTrigger,
    metadata?: {
      isLiveSpace?: boolean
      hasSources?: boolean
      hasSmartQuery?: boolean
    }
  ) {
    //await this.trackEvent(TelemetryEventTypes.OpenSpace, {
    //  trigger: trigger,
    //  isLiveSpace: metadata?.isLiveSpace ?? false,
    //  hasSources: metadata?.hasSources ?? false,
    //  hasSmartQuery: metadata?.hasSmartQuery ?? false
    //})
  }

  /** @deprecated */
  async trackDeleteSpace(trigger: DeleteSpaceEventTrigger) {
    //await this.trackEvent(TelemetryEventTypes.DeleteSpace, {
    //  trigger: trigger
    //})
  }

  /** @deprecated */
  async trackAddResourceToSpace(
    type: string,
    trigger: AddResourceToSpaceEventTrigger,
    moved = false
  ) {
    //await this.trackEvent(TelemetryEventTypes.AddResourceToSpace, {
    //  type: type,
    //  kind: getPrimaryResourceType(type),
    //  moved: moved,
    //  trigger: trigger
    //})
  }

  /** @deprecated */
  async trackUseInlineAI(prompt: InlineAIEventPromptType, includePageContext: boolean) {
    //await this.trackEvent(TelemetryEventTypes.UseInlineAI, {
    //  prompt: prompt,
    //  includePageContext: includePageContext
    //})
  }

  /** @deprecated */
  async trackCreateAnnotation(
    type: CreateAnnotationEventType,
    trigger: CreateAnnotationEventTrigger
  ) {
    //UserStatsService.incStat('global_n_create_annotation')
    //await this.trackEvent(TelemetryEventTypes.CreateAnnotation, {
    //  type: type,
    //  trigger: trigger
    //})
  }

  /** @deprecated */
  async trackDeleteAnnotation(
    type: DeleteAnnotationEventType,
    trigger: DeleteAnnotationEventTrigger
  ) {
    //await this.trackEvent(TelemetryEventTypes.DeleteAnnotation, {
    //  type: type,
    //  trigger: trigger
    //})
  }

  /** @deprecated */
  async trackOpenAnnotations() {
    //await this.trackEvent(TelemetryEventTypes.OpenAnnotationSidebar, {})
  }

  /** @deprecated */
  async trackPageChatMessageSent(stats: PageChatMessageSentData) {
    //UserStatsService.incStat('global_n_chat_message_sent')
    //await this.trackEvent(TelemetryEventTypes.PageChatMessageSent, {
    //  context_size: stats.contextSize,
    //  num_spaces: stats.numSpaces,
    //  num_tabs: stats.numTabs,
    //  num_resources: stats.numResources,
    //  num_screenshots: stats.numScreenshots,
    //  num_messages: stats.numPreviousMessages,
    //  took_page_screen: stats.tookPageScreenshot,
    //  embedding_model: stats.embeddingModel,
    //  chat_model_provider: stats.chatModelProvider,
    //  chat_model_name: stats.chatModelName,
    //  error: stats.error,
    //  trigger: stats.trigger,
    //  onboarding: stats.onboarding,
    //  generated_artifact: stats.generatedArtifact
    //})
  }

  /** @deprecated */
  async trackSimilaritySearch(stats: PageChatMessageSentData) {
    //await this.trackEvent(TelemetryEventTypes.SimilaritySearch, {
    //  context_size: stats.contextSize,
    //  num_spaces: stats.numSpaces,
    //  num_tabs: stats.numTabs,
    //  num_resources: stats.numResources,
    //  num_screenshots: stats.numScreenshots,
    //  num_messages: stats.numPreviousMessages,
    //  took_page_screen: stats.tookPageScreenshot,
    //  embedding_model: stats.embeddingModel,
    //  chat_model_provider: stats.chatModelProvider,
    //  chat_model_name: stats.chatModelName,
    //  error: stats.error,
    //  trigger: stats.trigger,
    //  onboarding: stats.onboarding,
    //  generated_artifact: stats.generatedArtifact
    //})
  }

  /** @deprecated */
  async trackPageChatCitationClick(type: 'timestamp' | 'text', sourceTabType: 'page' | 'space') {
    //await this.trackEvent(TelemetryEventTypes.PageChatCitationClick, {
    //  type: type,
    //  sourceTabType: sourceTabType
    //})
  }

  /** @deprecated */
  async trackPageChatCitationClickResourceFromSpace(type: 'timestamp' | 'text') {
    //await this.trackEvent(TelemetryEventTypes.PageChatCitationClickResourceFromSpace, {
    //  type: type
    //})
  }

  /** @deprecated */
  async trackPageChatClear(numMessages: number) {
    //await this.trackEvent(TelemetryEventTypes.PageChatClear, {
    //  num_messages: numMessages
    //})
  }

  /** @deprecated */
  async trackPageChatContextUpdate(
    action: PageChatUpdateContextEventAction,
    numResources: number,
    numChanged: number = 1,
    type?: PageChatUpdateContextItemType,
    trigger: PageChatUpdateContextEventTrigger = PageChatUpdateContextEventTrigger.TabSelection
  ) {
    //await this.trackEvent(TelemetryEventTypes.PageChatContextUpdate, {
    //  action: action,
    //  item_type: type,
    //  context_size: numResources,
    //  changed: numChanged,
    //  trigger: trigger
    //})
  }

  /** @deprecated */
  async trackOpenPageChat() {
    //await this.trackEvent(TelemetryEventTypes.OpenPageChatSidebar, {})
  }

  /** @deprecated */
  async trackSummarizeText(contentSource: SummarizeEventContentSource, context: EventContext) {
    //await this.trackEvent(TelemetryEventTypes.SummarizeText, {
    //  content_source: contentSource,
    //  context: context
    //})
  }

  /** @deprecated */
  async trackGeneratePrompts(
    context: EventContext,
    trigger: GeneratePromptsEventTrigger,
    onboarding = false
  ) {
    //await this.trackEvent(TelemetryEventTypes.GeneratePrompts, {
    //  trigger,
    //  context: context,
    //  onboarding
    //})
  }

  /** @deprecated */
  async trackUsePrompt(type: PromptType, context: EventContext, name?: string, onboarding = false) {
    //await this.trackEvent(TelemetryEventTypes.UsePrompt, {
    //  type: type,
    //  context: context,
    //  name,
    //  onboarding
    //})
  }

  /** @deprecated */
  async trackUpdatePrompt(type: PromptType, name?: string) {
    //await this.trackEvent(TelemetryEventTypes.UpdatePrompt, {
    //  name: name,
    //  type: type
    //})
  }

  /** @deprecated */
  async trackResetPrompt(type: PromptType, name?: string) {
    //await this.trackEvent(TelemetryEventTypes.ResetPrompt, {
    //  name: name,
    //  type: type
    //})
  }

  /** @deprecated */
  async trackCreatePrompt(type: PromptType, name?: string) {
    //await this.trackEvent(TelemetryEventTypes.CreatePrompt, {
    //  name: name,
    //  type: type
    //})
  }

  /** @deprecated */
  async trackDeletePrompt(type: PromptType, name?: string) {
    //await this.trackEvent(TelemetryEventTypes.DeletePrompt, {
    //  name: name,
    //  type: type
    //})
  }

  /** @deprecated */
  async trackAskInlineAI(data: { isFollowUp: boolean; baseMedia: AIMessageBaseMedia }) {
    //UserStatsService.incStat('global_n_use_inline_tools')
    //await this.trackEvent(TelemetryEventTypes.AskInlineAI, {
    //  is_follow_up: data.isFollowUp,
    //  base_media: data.baseMedia
    //})
  }

  /** @deprecated */
  async trackCopyScreenshot() {
    //await this.trackEvent(TelemetryEventTypes.CopyScreenshot, {})
  }

  /** @deprecated */
  async trackSaveAIResponse(data: { context: AIMessageContext; baseMedia: AIMessageBaseMedia }) {
    //await this.trackEvent(TelemetryEventTypes.SaveAIResponse, {
    //  context: data.context,
    //  base_media: data.baseMedia
    //})
  }

  /** @deprecated */
  async trackOpenHomescreen(trigger: OpenHomescreenEventTrigger) {
    //UserStatsService.incStat('global_n_open_homescreen')
    //await this.trackEvent(TelemetryEventTypes.OpenHomescreen, {
    //  trigger
    //})
  }

  /** @deprecated */
  async trackAddHomescreenItem(
    trigger: AddHomescreenItemEventTrigger,
    type: 'resource' | 'space',
    source?: AddHomescreenItemEventSource
  ) {
    //await this.trackEvent(TelemetryEventTypes.AddHomescreenItem, {
    //  trigger,
    //  type,
    //  source
    //})
  }

  /** @deprecated */
  async trackRemoveHomescreenItem(trigger: RemoveHomescreenItemEventTrigger) {
    //await this.trackEvent(TelemetryEventTypes.RemoveHomescreenItem, {
    //  trigger
    //})
  }

  /** @deprecated */
  async trackUpdateHomescreen(action: UpdateHomescreenEventAction) {
    //UserStatsService.incStat('global_n_update_homescreen')
    //await this.trackEvent(TelemetryEventTypes.UpdateHomescreen, {
    //  action
    //})
  }

  /** @deprecated */
  async trackChangeTelemetryAnonymization(anonymize: boolean) {
    //await this.trackEvent(TelemetryEventTypes.ChangeTelemetryAnonymization, {
    //  anonymize
    //})
  }

  /** @deprecated */
  async trackCreateNote(context: EventContext) {
    //await this.trackEvent(TelemetryEventTypes.CreateNote, {
    //  context
    //})
  }

  /** @deprecated */
  async trackUpdateNote(context: EventContext = EventContext.Note) {
    //await this.trackEvent(TelemetryEventTypes.UpdateNote, {
    //  context
    //})
  }

  /** @deprecated */
  async trackNoteCreateMention(type: MentionEventType, onboarding = false) {
    //await this.trackEvent(TelemetryEventTypes.NoteCreateMention, {
    //  type,
    //  onboarding
    //})
  }

  /** @deprecated */
  async trackNoteOpenMention(type: MentionEventType, target: MentionAction, onboarding = false) {
    //await this.trackEvent(TelemetryEventTypes.NoteOpenMention, {
    //  type,
    //  target,
    //  onboarding
    //})
  }

  /** @deprecated */
  async trackNoteInsertSimilarSource(
    resourceType: string,
    summarized: boolean,
    onboarding = false
  ) {
    //await this.trackEvent(TelemetryEventTypes.NoteInsertSimilarSource, {
    //  type: resourceType,
    //  kind: getPrimaryResourceType(resourceType),
    //  summarized,
    //  onboarding
    //})
  }

  /** @deprecated */
  async trackNoteChangeContext(type: MentionEventType, onboarding = false) {
    //await this.trackEvent(TelemetryEventTypes.NoteChangeContext, {
    //  type,
    //  onboarding
    //})
  }

  /** @deprecated */
  async trackNoteOnboardingChangeStep(to: number, from: number) {
    //await this.trackEvent(TelemetryEventTypes.NoteOnboardingChangeStep, {
    //  to,
    //  from
    //})
  }

  /** @deprecated */
  async trackNoteCreateCitation(
    resourceTypeOrSpace: string,
    trigger: NoteCreateCitationEventTrigger,
    onboarding = false
  ) {
    //await this.trackEvent(TelemetryEventTypes.NoteCreateCitation, {
    //  type: resourceTypeOrSpace,
    //  kind:
    //    resourceTypeOrSpace === DragTypeNames.SURF_SPACE
    //      ? 'space'
    //      : getPrimaryResourceType(resourceTypeOrSpace),
    //  trigger,
    //  onboarding
    //})
  }

  /** @deprecated */
  async trackOpenResourceInSidebar(resourceType: string) {
    //await this.trackEvent(TelemetryEventTypes.OpenResourceInSidebar, {
    //  type: resourceType
    //})
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
