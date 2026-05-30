import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { useLogScope } from '@deta/utils'

const log = useLogScope('i18n')

export type SupportedLocale = 'en-US' | 'zh-CN'

export const DEFAULT_LOCALE: SupportedLocale = 'en-US'

const SUPPORTED_LOCALES: SupportedLocale[] = ['en-US', 'zh-CN']

let translations: Record<string, any> = {}
let currentLocale: SupportedLocale = DEFAULT_LOCALE

export function setLocale(locale: SupportedLocale): void {
  if (SUPPORTED_LOCALES.includes(locale)) {
    currentLocale = locale
    loadTranslations(locale)
    log.info(`Locale set to: ${locale}`)
  } else {
    log.warn(`Unsupported locale: ${locale}, falling back to ${DEFAULT_LOCALE}`)
    currentLocale = DEFAULT_LOCALE
    loadTranslations(DEFAULT_LOCALE)
  }
}

export function getLocale(): SupportedLocale {
  return currentLocale
}

export function t(key: string): string {
  const keys = key.split('.')
  let value: any = translations

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      log.warn(`Translation key not found: ${key}`)
      return key
    }
  }

  return typeof value === 'string' ? value : key
}

function loadTranslations(locale: SupportedLocale): void {
  try {
    const translationsPath = path.join(__dirname, 'i18n')
    const translationFile = path.join(translationsPath, `${locale}.json`)

    if (fs.existsSync(translationFile)) {
      const raw = fs.readFileSync(translationFile, 'utf8')
      translations = JSON.parse(raw)
      log.info(`Loaded translations for: ${locale}`)
    } else {
      log.warn(`Translation file not found: ${translationFile}`)
      translations = {}
    }
  } catch (error) {
    log.error('Error loading translations:', error)
    translations = {}
  }
}

export function initI18n(locale?: SupportedLocale): void {
  const targetLocale = locale || detectSystemLocale()
  setLocale(targetLocale)
}

function detectSystemLocale(): SupportedLocale {
  const appLocale = app.getLocale()
  
  if (appLocale.startsWith('zh')) {
    return 'zh-CN'
  }
  
  return DEFAULT_LOCALE
}

export function getAvailableLocales(): { code: SupportedLocale; name: string }[] {
  return [
    { code: 'en-US', name: 'English' },
    { code: 'zh-CN', name: '中文 (Chinese)' }
  ]
}
