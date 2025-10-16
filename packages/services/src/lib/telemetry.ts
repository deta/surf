import * as amplitude from '@amplitude/analytics-browser'
import {
  type UserConfig,
  TelemetryEventTypes,
  type ElectronAppInfo,
  TelemetryCreateTabSource,
  TelemetryViewType
} from '@deta/types'

import { useLogScope } from '@deta/utils/io'
import { isMainRenderer } from '@deta/utils/system'
import { getContext, setContext } from 'svelte'
import type { ConfigService } from './config'
import { type MessagePortClient } from './messagePort'

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
    if (isMainRenderer()) return this.apiKey && this.active
    else return this.messagePort !== undefined
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
