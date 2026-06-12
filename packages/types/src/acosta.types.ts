/**
 * Shared types for Acosta Browse — the Acosta AI desktop browser.
 *
 * These types are used across the main process, preload scripts and renderer
 * windows. Keep them dependency-free.
 */

/** NSW Stage 4/5 key learning areas. */
export const NSW_SUBJECTS = [
  'English',
  'Maths',
  'Science',
  'HSIE',
  'PDHPE',
  'Creative Arts',
  'Languages',
  'TAS'
] as const

export type NSWSubject = (typeof NSW_SUBJECTS)[number]

/** A study subject — either a built-in NSW subject or a custom one added by the student. */
export type StudySubject = {
  id: string
  name: string
  builtIn: boolean
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export type AcostaUser = {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
}

export type AcostaAuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AcostaUser }

export type AuthCredentials = {
  email: string
  password: string
}

export type AuthResult = { ok: true; user: AcostaUser } | { ok: false; error: string }

/* ------------------------------------------------------------------ */
/* Content filtering                                                   */
/* ------------------------------------------------------------------ */

/** Core categories cannot be disabled by the student. */
export const CORE_FILTER_CATEGORIES = ['adult', 'gambling', 'drugs', 'violence'] as const
/** Optional categories the student may toggle in settings. */
export const OPTIONAL_FILTER_CATEGORIES = ['social', 'gaming'] as const

export type CoreFilterCategory = (typeof CORE_FILTER_CATEGORIES)[number]
export type OptionalFilterCategory = (typeof OPTIONAL_FILTER_CATEGORIES)[number]
export type FilterCategory = CoreFilterCategory | OptionalFilterCategory

export const FILTER_CATEGORY_LABELS: Record<FilterCategory, string> = {
  adult: 'Adult content',
  gambling: 'Gambling',
  drugs: 'Drugs',
  violence: 'Violence',
  social: 'Social media',
  gaming: 'Gaming'
}

export type ContentFilterSettings = {
  /** Optional categories the student has switched on. Core categories are always on. */
  enabled_optional_categories: OptionalFilterCategory[]
  /** Hostnames the student/teacher explicitly blocked. */
  custom_blocklist: string[]
  /** Hostnames explicitly allowed (overrides category blocklists, not core AI verdicts). */
  custom_allowlist: string[]
  /** Whether to consult the api.acosta.ai/content-check endpoint for unknown URLs. */
  ai_screening_enabled: boolean
}

export type BlockVerdict = {
  blocked: boolean
  /** Which category or mechanism produced the block. */
  source?: 'blocklist' | 'custom' | 'ai' | 'focus-mode'
  category?: FilterCategory
  reason?: string
}

export type ContentCheckResponse = {
  safe: boolean
  reason: string
}

/** Payload for the surf-internal blocked page, passed as query params. */
export type BlockPageInfo = {
  url: string
  reason: string
  source: NonNullable<BlockVerdict['source']>
  category?: FilterCategory
}

/* ------------------------------------------------------------------ */
/* Focus mode                                                          */
/* ------------------------------------------------------------------ */

export type FocusSessionConfig = {
  subject: string
  task: string
  /** Focus block length in minutes (Pomodoro work interval). */
  focusMinutes: number
  /** Break length in minutes. */
  breakMinutes: number
  /** Hostnames the student may visit during the session. */
  allowlist: string[]
}

export type FocusPhase = 'focus' | 'break'

export type FocusSessionState = {
  active: boolean
  config: FocusSessionConfig | null
  phase: FocusPhase
  /** Unix ms timestamp when the current phase ends. */
  phaseEndsAt: number | null
  /** Unix ms timestamp when the session started. */
  startedAt: number | null
  pagesVisited: number
  blockedAttempts: number
  notesTaken: number
}

export type FocusSessionSummary = {
  subject: string
  task: string
  startedAt: number
  endedAt: number
  focusedSeconds: number
  pagesVisited: number
  blockedAttempts: number
  notesTaken: number
}

/* ------------------------------------------------------------------ */
/* AI selection actions (page context menu)                            */
/* ------------------------------------------------------------------ */

export const ACOSTA_SELECTION_ACTIONS = [
  'explain',
  'quiz',
  'add-to-notes',
  'summarise',
  'find-in-syllabus'
] as const

export type AcostaSelectionAction = (typeof ACOSTA_SELECTION_ACTIONS)[number]

export const ACOSTA_SELECTION_ACTION_LABELS: Record<AcostaSelectionAction, string> = {
  explain: 'Explain this',
  quiz: 'Quiz me on this',
  'add-to-notes': 'Add to Study Notes',
  summarise: 'Summarise',
  'find-in-syllabus': 'Find in NSW Syllabus'
}

export type AcostaSelectionActionPayload = {
  action: AcostaSelectionAction
  selectionText: string
  pageURL: string
  pageTitle: string
}

/* ------------------------------------------------------------------ */
/* Acosta settings stored in UserConfig                                */
/* ------------------------------------------------------------------ */

export type AcostaSettings = {
  /** Per-user preferred chat model id (one of the ACOSTA_MODEL ids). */
  default_model: string
  sidebar_position: 'left' | 'right'
  auto_summarise_on_load: boolean
  content_filter: ContentFilterSettings
  focus_defaults: {
    focusMinutes: number
    breakMinutes: number
    allowlist: string[]
  }
  subjects: StudySubject[]
  /** Subject the student wants to focus on today (shown on the new tab page). */
  todays_focus_subject: string | null
  /** Teacher or parent contact for "Request Access" on the block page. */
  guardian_email: string | null
}

export const DEFAULT_ACOSTA_SETTINGS: AcostaSettings = {
  default_model: 'acosta-claude',
  sidebar_position: 'right',
  auto_summarise_on_load: false,
  content_filter: {
    enabled_optional_categories: [],
    custom_blocklist: [],
    custom_allowlist: [],
    ai_screening_enabled: true
  },
  focus_defaults: {
    focusMinutes: 25,
    breakMinutes: 5,
    allowlist: []
  },
  subjects: NSW_SUBJECTS.map((name) => ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    builtIn: true
  })),
  todays_focus_subject: null,
  guardian_email: null
}

/* ------------------------------------------------------------------ */
/* Acosta API                                                          */
/* ------------------------------------------------------------------ */

export const ACOSTA_API_BASE_URL = 'https://api.acosta.ai'
export const ACOSTA_PLATFORM_URL = 'https://platform.acosta-ai.com'
export const ACOSTA_UPDATES_URL = 'https://updates.acosta-ai.com'

/** Quick links shown on the new tab page. */
export const ACOSTA_QUICK_LINKS = [
  { label: 'Study Plan', url: `${ACOSTA_PLATFORM_URL}/study-plan`, icon: 'calendar' },
  { label: 'Exam Simulator', url: `${ACOSTA_PLATFORM_URL}/exam-simulator`, icon: 'file-text' }
] as const
