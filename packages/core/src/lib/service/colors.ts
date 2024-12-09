import ColorThief from '../utils/colors/colorthief.mjs'
import { get, type Readable, type Writable, writable, derived } from 'svelte/store'
import { type LogScope, useLogScope } from '@horizon/utils'
import type { ConfigService } from './config'
import type { UserSettings } from '@horizon/types'
import { getContext, setContext } from 'svelte'

export const LIGHT_BG_COLOR = 'hsla(0, 80%, 98%, 0.5)'
export const DARK_BG_COLOR = 'hsla(0, 0%, 2%, 0.5)'

export type ColorRGB = [number, number, number]
export enum ColorMode {
  HEX = 'hex',
  RGB = 'rgb',
  HSL = 'hsl'
}

export interface CustomColorData {
  color: string
  isLight: boolean
  contrastColor: string
  h: number
  s: number
  l: number
}

export interface SettingsData {
  app_style: 'dark' | 'light'
}

export class ColorService {
  private readonly unsubscribers = new Set<() => void>()

  private log: LogScope
  private readonly userConfig: Readable<UserSettings>
  private readonly colorMode: ColorMode

  private colorThief: ColorThief
  private cache: Map<string, number[]>
  private debugHexColorStore = writable<string | null>(null)

  private _colorScheme: Writable<CustomColorData>
  get colorScheme(): Readable<CustomColorData> {
    return this._colorScheme
  }

  /// Calc config
  thiefQuality = 5

  constructor(config: ConfigService, colorMode: ColorMode) {
    this.userConfig = config.settings
    this.colorMode = colorMode
    this.colorThief = new ColorThief()
    this.cache = new Map()
    this.log = useLogScope('ColorService')

    const isDarkMode = get(this.userConfig).app_style === 'dark'
    this._colorScheme = writable({
      color:
        colorMode === ColorMode.HEX
          ? '#808080'
          : colorMode === ColorMode.HSL
            ? 'hsl(0, 0%, 50%)'
            : 'rgb(128, 128, 128)',
      isLight: !isDarkMode,
      contrastColor: isDarkMode ? 'hsl(212, 92%, 92%)' : 'hsl(212, 92%, 8%)',
      h: 212,
      s: 92,
      l: 50
    })
  }

  destroy() {
    for (const f of this.unsubscribers) f()
  }

  applyColorVariables(scheme: CustomColorData) {
    const root = document.querySelector(':root') as HTMLElement
    if (!root) {
      this.log.error('No :root? This shouldnt happen')
      return
    }
    const defs: Record<string, string | number> = {
      '--base-color': scheme.color,
      '--base-color-hue': scheme.h,
      '--base-color-saturation': scheme.s,
      '--base-color-lightness': scheme.l,
      '--contrast-color': scheme.contrastColor
    }
    Object.entries(defs).forEach((v) => root.style.setProperty(v[0], v[1].toString(), 'important'))
  }

  async calculateImagePalette(imageResourceId: string): Promise<ColorRGB[] | null> {
    try {
      const img = new Image()

      img.src = `surf://resource/${imageResourceId}`
      this.log.debug('Extracting palette from :', img.src)

      await img.decode()

      const colors = this.colorThief.getPalette(img, 5, this.thiefQuality) as ColorRGB[]
      this.log.debug('Palette extracted:', colors)
      return colors
    } catch (e) {
      return null
    }
  }

  useDefaultPalette(darkMode: boolean) {
    this._colorScheme.set({
      color:
        this.colorMode === ColorMode.HEX
          ? '#808080'
          : this.colorMode === ColorMode.HSL
            ? 'hsl(0, 0%, 50%)'
            : 'rgb(128, 128, 128)',
      isLight: !darkMode,
      contrastColor: darkMode ? 'hsl(212, 92%, 92%)' : 'hsl(212, 92%, 8%)',
      h: 212,
      s: 92,
      l: 50
    })
    this.applyColorVariables(get(this._colorScheme))
  }

  usePalette(palette: ColorRGB[], darkMode: boolean) {
    const colors = this.calculateColors(!darkMode ? palette.at(0) : palette.at(-1), darkMode)
    this._colorScheme.set(colors)
    this.applyColorVariables(get(this._colorScheme))
  }

  calculateColors(fromColor: ColorRGB, isDarkMode: boolean): CustomColorData {
    try {
      const dominantColor = fromColor
      this.log.debug(
        'Dominant color selected:',
        dominantColor,
        'lightness: ',
        isDarkMode ? 'dark' : 'light'
      )

      const hslValues = ColorService.rgbToHslValues(dominantColor)
      let colorString = `hsl(${hslValues.h}, ${hslValues.s}%, ${hslValues.l}%)`

      // Calculate relative luminance for contrast ratio
      const [r, g, b] = dominantColor.map((c) => {
        const sRGB = c / 255
        return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
      })
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b

      const contrastColor = this.createContrastColor(
        dominantColor,
        hslValues,
        isDarkMode,
        luminance
      )
      const isLight = this.isLightBackground(dominantColor, isDarkMode)

      switch (this.colorMode) {
        case ColorMode.HEX:
          colorString = ColorService.rgbToHex(dominantColor)
          break
        case ColorMode.RGB:
          colorString = `rgb(${dominantColor.join(', ')})`
          break
        case ColorMode.HSL:
        default:
          break
      }

      return {
        color: colorString,
        isLight,
        contrastColor,
        h: hslValues.h,
        s: hslValues.s,
        l: hslValues.l
      }
    } catch (error) {
      this.log.error('Error extracting colors:', error)
      return {
        color:
          this.colorMode === ColorMode.HEX
            ? '#808080'
            : this.colorMode === ColorMode.HSL
              ? 'hsl(0, 0%, 50%)'
              : 'rgb(128, 128, 128)',
        isLight: !isDarkMode,
        contrastColor: isDarkMode ? 'hsl(212, 92%, 92%)' : 'hsl(212, 92%, 8%)',
        h: 212,
        s: 92,
        l: 50
      }
    }
  }

  clearCache() {
    this.cache.clear()
    this.debugHexColorStore.set(null)
  }

  static hexToRgb(hex: string): ColorRGB {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) {
      throw new Error('Invalid hex color format')
    }
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
  }

  private isLightBackground(rgb: ColorRGB, isDarkMode: boolean): boolean {
    const [r, g, b] = rgb.map((x) => x / 255)
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const darkModeThreshold = 0.65
    const lightModeThreshold = 0.45
    return luminance > (isDarkMode ? darkModeThreshold : lightModeThreshold)
  }

  private createContrastColor(
    dominantColor: number[],
    hslValues: { h: number; s: number; l: number },
    isDarkMode: boolean,
    luminance: number
  ): string {
    const darkModeThreshold = 0.65
    const lightModeThreshold = 0.45
    const threshold = isDarkMode ? darkModeThreshold : lightModeThreshold

    const needsLightContrast = luminance < threshold

    if (needsLightContrast) {
      // For dark backgrounds
      const lightnessBase = isDarkMode ? 92 : 98
      const adjustedLightness = Math.max(lightnessBase - (threshold - luminance) * 15, 85)
      return `hsl(${hslValues.h}, 92%, ${adjustedLightness}%)`
    } else {
      // For light backgrounds
      const darknessBase = isDarkMode ? 8 : 12
      const adjustedDarkness = Math.min(darknessBase + (luminance - threshold) * 12, 20)
      return `hsl(${hslValues.h}, 92%, ${adjustedDarkness}%)`
    }
  }

  static rgbToHex(rgb: ColorRGB): string {
    return `#${rgb.map((x) => x.toString(16).padStart(2, '0')).join('')}`
  }

  static rgbToHsl(rgb: ColorRGB): string {
    const hslValues = ColorService.rgbToHslValues(rgb)
    return `hsl(${hslValues.h}, ${hslValues.s}%, ${hslValues.l}%)`
  }

  static rgbToHslValues(rgb: ColorRGB): { h: number; s: number; l: number } {
    const [r, g, b] = rgb.map((x) => x / 255)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0,
      s = 0,
      l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        case b:
          h = (r - g) / d + 4
          break
      }
      h /= 6
    }

    return {
      h: parseFloat((h * 360).toFixed(1)),
      s: parseFloat((s * 100).toFixed(1)),
      l: parseFloat((l * 100).toFixed(1))
    }
  }

  static rgbToPerceivedBrightness([r, g, b]: ColorRGB): number {
    return 0.299 * r + 0.587 * g + 0.114 * b
  }

  static provide(config: ConfigService, colorMode: ColorMode) {
    const service = new ColorService(config, colorMode)

    setContext('colorService', service)

    return service
  }

  static use() {
    return getContext<ColorService>('colorService')
  }
}

export const useColorService = ColorService.use
export const provideColorService = ColorService.provide
