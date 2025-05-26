/**
 * Favicon utility functions for selecting and optimizing website favicons
 */

type FaviconCacheEntry = {
  url: string
  timestamp: number
  size?: number
  format?: number
}

const faviconCache = new Map<
  string,
  {
    light?: FaviconCacheEntry
    dark?: FaviconCacheEntry
    neutral?: FaviconCacheEntry
  }
>()

const CACHE_EXPIRATION = 24 * 60 * 60 * 1000

/**
 * Extract size from URLs with dimensions pattern (e.g., icon-192x192.png)
 *
 * Looks for patterns like:
 * - icon-192x192.png (with hyphen or underscore before dimensions)
 * - icon192x192.png (without separator)
 *
 * Supports both lowercase and uppercase 'x' as dimension separator.
 * Returns the product of width and height (e.g., 192*192 = 36864).
 *
 * @param url - The URL string to extract dimensions from
 * @returns The calculated size (width * height) or 0 if no dimensions found
 */
export const getExplicitSize = (url: string): number => {
  const dims = url.match(/[_-](\d+)[xX](\d+)/) || url.match(/(\d+)[xX](\d+)/)
  return dims ? parseInt(dims[1]) * parseInt(dims[2]) : 0
}

/**
 * Extract size from URLs with single dimension (e.g., favicon-32.png)
 *
 * Looks for patterns like:
 * - favicon-32.png (single dimension after non-letter character)
 * - icon32.ico (single dimension)
 *
 * Extracts dimensions between 2-4 digits and calculates the square of the dimension
 * (assuming width = height for square icons).
 *
 * @param url - The URL string to extract the dimension from
 * @returns The calculated size (dimension²) or 0 if no dimension found
 */
export const getSingleDimSize = (url: string): number => {
  const dim = url.match(/[^a-z]([0-9]{2,4})\D/i)?.at(1)
  return dim ? Math.pow(parseInt(dim), 2) : 0
}

export const getIconSize = (url: string): number => {
  const explicitSize = getExplicitSize(url)
  if (explicitSize > 0) return explicitSize

  const singleDimSize = getSingleDimSize(url)
  if (singleDimSize > 0) return singleDimSize

  // Default sizes based on common patterns
  if (url.includes('apple-touch-icon') || url.includes('apple-icon')) return 180 * 180
  if (url.includes('android-icon') || url.includes('android-chrome')) return 192 * 192
  if (url.includes('ms-icon')) return 144 * 144
  if (url.includes('large')) return 128 * 128
  if (url.includes('medium')) return 64 * 64
  if (url.includes('small')) return 32 * 32
  if (url.endsWith('.ico')) return 16 * 16

  return 0
}

export const getFormatPriority = (url: string): number => {
  // Vector formats are best for scaling
  if (url.endsWith('.svg')) return 5

  // High quality raster formats
  if (url.endsWith('.png')) return 4
  if (url.includes('data:image/png')) return 4

  // Medium quality formats
  if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 3
  if (url.includes('data:image/jpeg')) return 3
  if (url.includes('data:image/webp')) return 3

  // Lower quality or older formats
  if (url.endsWith('.gif')) return 2
  if (url.includes('data:image/gif')) return 2
  if (url.endsWith('.ico')) return 1
  if (url.includes('data:image/x-icon')) return 1

  // Other data URLs or unknown formats
  if (url.startsWith('data:image/')) return 0

  return 0
}

export const isDarkModeIcon = (url: string): boolean => {
  return (
    url.includes('dark') ||
    url.includes('night') ||
    url.includes('-dm.') ||
    url.includes('_dark.') ||
    url.includes('-dark.') ||
    url.includes('black') ||
    /dark[-_]?mode/i.test(url)
  )
}

export const isLightModeIcon = (url: string): boolean => {
  return (
    url.includes('light') ||
    url.includes('day') ||
    url.includes('-lm.') ||
    url.includes('_light.') ||
    url.includes('-light.') ||
    url.includes('white') ||
    /light[-_]?mode/i.test(url)
  )
}

/**
 * Get theme bonus for icon selection based on current theme
 */
export const getThemeBonus = (url: string, isDarkMode: boolean): number => {
  // Strong indicators for specific modes
  if (isDarkMode && isDarkModeIcon(url)) return 20
  if (!isDarkMode && isLightModeIcon(url)) return 20

  // Penalize mismatched icons
  if (isDarkMode && isLightModeIcon(url)) return -10
  if (!isDarkMode && isDarkModeIcon(url)) return -10

  // Slightly prefer neutral icons that don't specify a mode
  if (!isDarkModeIcon(url) && !isLightModeIcon(url)) return 5

  return 0
}

export const selectBestFavicon = (favicons: string[], isDarkMode = false): string => {
  if (!favicons.length) return ''

  return favicons.sort((a, b) => {
    // First, compare by format quality
    const formatDiff = getFormatPriority(b) - getFormatPriority(a)
    if (formatDiff !== 0) return formatDiff

    // Then, consider theme appropriateness
    const themeDiff = getThemeBonus(b, isDarkMode) - getThemeBonus(a, isDarkMode)
    if (themeDiff !== 0) return themeDiff

    // Finally, compare by size
    return getIconSize(b) - getIconSize(a)
  })[0]
}

export const getCachedFavicon = (url: string, domain: string, isDarkMode = false): string => {
  if (!url || !domain) return url

  let themeType: 'light' | 'dark' | 'neutral' = 'neutral'
  if (isDarkModeIcon(url)) {
    themeType = 'dark'
  } else if (isLightModeIcon(url)) {
    themeType = 'light'
  }

  // Create or update the cache entry for this domain
  const domainCache = faviconCache.get(domain) || {}

  // Store the favicon with metadata
  domainCache[themeType] = {
    url,
    timestamp: Date.now(),
    size: getIconSize(url),
    format: getFormatPriority(url)
  }

  faviconCache.set(domain, domainCache)

  return url
}

export const getFallbackFavicon = (
  domain: string,
  size: 16 | 32 | 64 | 128 = 32,
  isDarkMode = false
): string => {
  if (!domain) return ''

  const domainCache = faviconCache.get(domain)
  if (domainCache) {
    const now = Date.now()

    const preferredTheme = isDarkMode ? 'dark' : 'light'
    if (
      domainCache[preferredTheme] &&
      now - domainCache[preferredTheme].timestamp < CACHE_EXPIRATION
    ) {
      return domainCache[preferredTheme].url
    }

    if (domainCache.neutral && now - domainCache.neutral.timestamp < CACHE_EXPIRATION) {
      return domainCache.neutral.url
    }

    const fallbackTheme = isDarkMode ? 'light' : 'dark'
    if (
      domainCache[fallbackTheme] &&
      now - domainCache[fallbackTheme].timestamp < CACHE_EXPIRATION
    ) {
      return domainCache[fallbackTheme].url
    }
  }

  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
}

export const cleanFaviconCache = (): void => {
  const now = Date.now()

  for (const [domain, cacheEntry] of faviconCache.entries()) {
    let hasValidEntries = false

    for (const themeType of ['light', 'dark', 'neutral'] as const) {
      if (cacheEntry[themeType] && now - cacheEntry[themeType].timestamp >= CACHE_EXPIRATION) {
        delete cacheEntry[themeType]
      } else if (cacheEntry[themeType]) {
        hasValidEntries = true
      }
    }

    if (!hasValidEntries) {
      faviconCache.delete(domain)
    }
  }
}

export const processFavicons = (favicons: string[], domain: string, isDarkMode = false): string => {
  if (!Array.isArray(favicons) || favicons.length === 0) {
    return getFallbackFavicon(domain, 32, isDarkMode)
  }

  if (Math.random() < 0.01) {
    cleanFaviconCache()
  }

  const domainCache = faviconCache.get(domain)
  if (domainCache) {
    const preferredTheme = isDarkMode ? 'dark' : 'light'
    const cacheEntry = domainCache[preferredTheme]
    const now = Date.now()

    if (
      cacheEntry &&
      typeof cacheEntry.url === 'string' &&
      now - cacheEntry.timestamp < CACHE_EXPIRATION &&
      (cacheEntry.format ?? 0) >= 4
    ) {
      return cacheEntry.url
    }
  }

  const darkModeIcons = favicons.filter((url) => isDarkModeIcon(url))
  const lightModeIcons = favicons.filter((url) => isLightModeIcon(url))
  const neutralIcons = favicons.filter((url) => !isDarkModeIcon(url) && !isLightModeIcon(url))
  let iconsToUse = favicons
  if (isDarkMode && darkModeIcons.length > 0) {
    iconsToUse = darkModeIcons
  } else if (!isDarkMode && lightModeIcons.length > 0) {
    iconsToUse = lightModeIcons
  } else if (neutralIcons.length > 0) {
    iconsToUse = neutralIcons
  }

  const bestFavicon = selectBestFavicon(iconsToUse, isDarkMode)
  return getCachedFavicon(bestFavicon, domain, isDarkMode)
}
