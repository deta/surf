/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
const isDev = import.meta.env.DEV

const levelMap = ['verbose', 'debug', 'info', 'warn', 'error']
export type LogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error'

class Logger {
  scope: string
  level: number

  constructor(scope: string) {
    const level = import.meta.env.R_VITE_LOG_LEVEL

    this.scope = scope

    if (level) {
      this.level = levelMap.indexOf(level) || levelMap.indexOf('info')
    } else if (isDev) {
      this.level = levelMap.indexOf('debug')
    } else {
      this.level = levelMap.indexOf('info')
    }

    // @ts-ignore
    if (typeof window !== 'undefined' && !window.LOG_LEVEL) {
      // @ts-ignore
      window.LOG_LEVEL = level
    }
  }

  private getScope() {
    return this.scope ? `[${this.scope}]` : ''
  }

  private getLevel() {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.LOG_LEVEL) {
      // @ts-ignore
      this.level = levelMap.indexOf(window.LOG_LEVEL) || this.level
    }

    return this.level
  }

  log(...data: any[]) {
    const level = this.getLevel()
    if (level <= levelMap.indexOf('verbose')) {
      console.log(this.getScope(), ...data)
    }
  }

  debug(...data: any[]) {
    const level = this.getLevel()
    if (level <= levelMap.indexOf('debug')) {
      console.log(this.getScope(), ...data)
    }
  }

  info(...data: any[]) {
    const level = this.getLevel()
    if (level <= levelMap.indexOf('info')) {
      console.log(this.getScope(), ...data)
    }
  }

  warn(...data: any[]) {
    if (this.level <= levelMap.indexOf('warn')) {
      console.warn(this.getScope(), ...data)
    }
  }

  error(...data: any[]) {
    const level = this.getLevel()
    if (level <= levelMap.indexOf('error')) {
      console.error(this.getScope(), ...data)
    }
  }

  json(data: any) {
    const level = this.getLevel()
    if (level <= levelMap.indexOf('debug')) {
      console.log(JSON.stringify(data, null, 2))
    }
  }

  static useLog(scope: string) {
    return new Logger(scope)
  }
}

export type ScopedLogger = ReturnType<typeof useLogScope>

export const useLogScope = (scope: string) => Logger.useLog(scope)

const defaultLogger = new Logger('')
export const useLog = () => defaultLogger

export default {
  log: defaultLogger.log.bind(defaultLogger),
  debug: defaultLogger.debug.bind(defaultLogger),
  info: defaultLogger.info.bind(defaultLogger),
  warn: defaultLogger.warn.bind(defaultLogger),
  error: defaultLogger.error.bind(defaultLogger),
  json: defaultLogger.json.bind(defaultLogger)
}
