/* eslint-disable @typescript-eslint/no-explicit-any */
import debug from 'debug'
import { isDev } from '../system/system'

const GLOBAL_SCOPE = 'SurfLogger'

/* eslint-disable @typescript-eslint/no-unsafe-argument */
const levelMap = ['verbose', 'debug', 'info', 'warn', 'error']
export type LogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error'

export function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function setLogLevel(level: LogLevel) {
  const scopes = levelMap
    .slice(levelMap.indexOf(level))
    .map((e) => `*:${e}`)
    .join(',')
  setLogScopes(scopes)
}

export function setLogScopes(scopes: string) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
  localStorage.setItem('debug', scopes)
  localStorage.debug = scopes
}

// TODO: (maxu): figure out issue / fix scopes in browser
class Logger {
  scope: string
  logger: any

  constructor(scope?: string) {
    const enabledScopes = import.meta.env.R_VITE_DEBUG
    this.scope = scope || (isBrowser() ? 'Browser' : 'Node')
    // for surf only namespacing
    if (this.scope !== GLOBAL_SCOPE) {
      this.scope = `${GLOBAL_SCOPE}:${this.scope}`
    }
    if (enabledScopes) {
      setLogScopes(enabledScopes)
    } else if (isDev) {
      setLogScopes(`${GLOBAL_SCOPE}:*`)
    } else {
      setLogScopes('*:warn,*:error')
    }

    const scopedLog = debug(this.scope)

    const traceLog = scopedLog.extend('trace')
    const debugLog = scopedLog.extend('debug')
    const infoLog = scopedLog.extend('info')
    const warnLog = scopedLog.extend('warn')
    const errorLog = scopedLog.extend('error')

    scopedLog.log = console.log
    traceLog.log = console.trace
    debugLog.log = console.debug
    infoLog.log = console.info
    warnLog.log = console.warn
    errorLog.log = console.error

    this.logger = {
      trace: traceLog,
      debug: debugLog,
      log: scopedLog,
      info: infoLog,
      warn: warnLog,
      error: errorLog
    }
  }

  //private getLevel() {
  //  if (typeof window === 'undefined') return -1

  //  // @ts-ignore
  //  if (typeof window !== 'undefined' && window.LOG_LEVEL) {
  //    // @ts-ignore
  //    this.level = levelMap.indexOf(window.LOG_LEVEL) || this.level
  //  }

  //  return this.level
  //}
  static get isActive() {
    if (!isBrowser()) return true

    // @ts-ignore
    return window.LOG_DEBUG
  }

  log(...data: any[]) {
    if (!Logger.isActive) return
    this.logger.log(...data)
  }

  debug(...data: any[]) {
    if (!Logger.isActive) return
    this.logger.debug(...data)
  }

  info(...data: any[]) {
    if (!Logger.isActive) return
    this.logger.info(...data)
  }

  warn(...data: any[]) {
    if (!Logger.isActive) return
    this.logger.warn(...data)
  }

  error(...data: any[]) {
    if (!Logger.isActive) return
    this.logger.error(...data)
  }

  json(data: any) {
    if (!Logger.isActive) return
    this.logger.log('%j', data)
  }

  trace(...data: any[]) {
    if (!Logger.isActive) return
    this.logger.trace(...data)
  }

  static useLog(scope: string) {
    return new Logger(scope)
  }
}

export type ScopedLogger = ReturnType<typeof useLogScope>

export const useLogScope = (scope: string) => Logger.useLog(scope)

const defaultLogger = new Logger(undefined)
export const useLog = () => defaultLogger

export default {
  log: defaultLogger.log.bind(defaultLogger),
  debug: defaultLogger.debug.bind(defaultLogger),
  info: defaultLogger.info.bind(defaultLogger),
  warn: defaultLogger.warn.bind(defaultLogger),
  error: defaultLogger.error.bind(defaultLogger),
  json: defaultLogger.json.bind(defaultLogger),
  trace: defaultLogger.trace.bind(defaultLogger)
}
