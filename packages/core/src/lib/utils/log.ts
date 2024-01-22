/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
const isDev = import.meta.env.DEV

export const log = (...data: any[]) => {
  console.log(...data)
}

export const info = (...data: any[]) => {
  if (isDev) {
    console.log(...data)
  }
}

export const debug = (...data: any[]) => {
  if (isDev) {
    console.log(...data)
  }
}

export const error = (...data: any[]) => {
  if (isDev) {
    console.error(...data)
  }
}

export const warn = (...data: any[]) => {
  if (isDev) {
    console.log(...data)
  }
}

export const json = (data: any) => {
  if (isDev) {
    console.log(JSON.stringify(data))
  }
}

export const useLogScope = (scope: string) => {
  return {
    log: (...data: any[]) => log(`[${scope}]`, ...data),
    info: (...data: any[]) => info(`[${scope}]`, ...data),
    debug: (...data: any[]) => debug(`[${scope}]`, ...data),
    error: (...data: any[]) => error(`[${scope}]`, ...data),
    warn: (...data: any[]) => warn(`[${scope}]`, ...data),
    json: (data: any) => json(data)
  }
}

export type ScopedLogger = ReturnType<typeof useLogScope>

export default {
  log,
  info,
  debug,
  error,
  warn,
  json
}
