import { RendererType } from '@deta/types'

export const isMac = () => {
  return import.meta.env.PLATFORM === 'darwin'
}

export const isWindows = () => {
  return import.meta.env.PLATFORM === 'win32'
}

export const isLinux = () => {
  return import.meta.env.PLATFORM === 'linux'
}

export const isDev = import.meta.env.DEV

export const isOffline = () => {
  return !navigator.onLine
}

export const isMainRenderer = () => window.RENDERER_TYPE === RendererType.Main
