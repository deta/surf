import DOMPurify from 'dompurify'
import { minify } from 'html-minifier-terser/dist/htmlminifier.esm.bundle'

export const generateNameFromURL = (url: string) => {
  try {
    const urlObj = new URL(url)

    // use the hostname as the name and clean it up (remove www, replace dots with spaces, capitalize and get rid of the TLD)
    return urlObj.hostname
      .split('.')
      .slice(-2)
      .join('.')
      .replace(/\./g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .split(' ')[0]
  } catch (e) {
    return null
  }
}

export const sanitizeHTML = (html: string) => {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

export const minifyHTML = (html: string, opts?: any) => {
  return minify(html, {
    collapseBooleanAttributes: true,
    collapseWhitespace: true,
    collapseInlineTagWhitespace: true,
    continueOnParseError: true,
    removeComments: true,
    removeEmptyAttributes: true,
    removeEmptyElements: true,
    removeOptionalTags: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    ...opts
  })
}
