import { register } from '@tokens-studio/sd-transforms'
import StyleDictionary from 'style-dictionary'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

register(StyleDictionary)

// Custom name transform to ensure valid CSS custom property names
// - Removes leading '@'
// - Replaces invalid characters with '-'
// - Prefixes names starting with a digit with 't-'
const sanitize = (parts) => {
  const clean = parts
    .map((p) =>
      String(p)
        .replace(/^@+/, '') // drop leading @
        .replace(/[^a-zA-Z0-9_-]+/g, '-') // only keep valid ident chars
    )
    .join('-')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
  return /^\d/.test(clean) ? `t-${clean}` : clean
}

StyleDictionary.registerFormat({
  name: 'deta/css-variables',
  format: ({ dictionary }) => {
    const lines = []
    const classRules = []

    const toPx = (v) => {
      if (v == null) return v
      const s = String(v).trim()
      if (s === '') return s
      if (/^\d+(?:\.\d+)?$/.test(s)) return `${s}px`
      return s
    }

    const toFontWeight = (v) => {
      const m = String(v).toLowerCase()
      if (m === 'regular' || m === 'normal') return '400'
      if (m === 'medium') return '500'
      if (m === 'semibold' || m === 'semi-bold') return '600'
      if (m === 'bold') return '700'
      return String(v)
    }

    const quoteIfNeeded = (v) => {
      const s = String(v)
      // quote if contains whitespace or commas or starts with a digit
      return /[\s,]/.test(s) || /^\d/.test(s) ? `'${s.replace(/'/g, "\\'")}'` : s
    }

    const toFontShorthand = ({ weight, size, lineHeight, family }) => {
      const parts = []
      // omit style/variant for now; only weight
      if (weight) parts.push(String(weight))
      if (size) {
        if (lineHeight) parts.push(`${size}/${lineHeight}`)
        else parts.push(String(size))
      }
      if (family) parts.push(quoteIfNeeded(family))
      return parts.join(' ')
    }

    const normalize = (k, v) => {
      if (v == null) return v
      // Don't normalize CSS variables (they start with var(--))
      if (typeof v === 'string' && v.startsWith('var(--')) return v
      if (typeof v === 'string' && v.toLowerCase() === 'auto') return 'normal'
      if (/fontsize|font-size/i.test(k)) return toPx(v)
      if (/fontweight|font-weight/i.test(k)) return toFontWeight(v)
      return v
    }

    const getVal = (t) => t?.value ?? t?.$value ?? t?.original?.value ?? t?.original?.$value

    const refToCssVar = (s) => {
      if (typeof s !== 'string') return s
      const m = s.trim().match(/^\{(.+)\}$/)
      if (!m) return s
      const path = m[1].split('.')
      return `var(--${sanitize(path)})`
    }

    const looksLikeFontShorthand = (s) => {
      if (typeof s !== 'string') return false
      // very loose check: weight + size and optionally line-height + family
      return /(\b\d{3}\b|\bnormal\b|\bbold\b|\bmedium\b)/i.test(s) && /\d+(px|rem|em)/i.test(s)
    }

    for (const t of dictionary.allTokens) {
      const base = sanitize(t.path)
      const val = getVal(t)
      const tType = t.$type || t.type
      

      // Handle typography tokens: export helper class and vars
      if (tType === 'typography') {
        // Check if we have original object format with letterSpacing
        const originalVal = t.original?.$value || t.original?.value
        const useOriginal = originalVal && typeof originalVal === 'object' && originalVal.letterSpacing
        
        // Use original object format if it has letterSpacing, otherwise use resolved value
        if (useOriginal || (val && typeof val === 'object' && !Array.isArray(val))) {
          const sourceVal = useOriginal ? originalVal : val
          // Keep dynamic by mapping brace refs to CSS vars
          const fmRaw = sourceVal.fontFamily
          const fwRaw = sourceVal.fontWeight
          const fsRaw = sourceVal.fontSize
          const lhRaw = sourceVal.lineHeight
          const lsRaw = sourceVal.letterSpacing
          
          const fm = typeof fmRaw === 'string' ? refToCssVar(fmRaw) : normalize('fontFamily', fmRaw)
          const fw = typeof fwRaw === 'string' ? refToCssVar(fwRaw) : normalize('fontWeight', fwRaw)
          const fs = typeof fsRaw === 'string' ? refToCssVar(fsRaw) : normalize('fontSize', fsRaw)
          const lh = typeof lhRaw === 'string' ? refToCssVar(lhRaw) : normalize('lineHeight', lhRaw) || 'normal'
          const ls = typeof lsRaw === 'string' ? refToCssVar(lsRaw) : normalize('letterSpacing', lsRaw) || 'normal'

          lines.push(`  --${base}-fontFamily: ${fm};`)
          lines.push(`  --${base}-fontWeight: ${fw};`)
          lines.push(`  --${base}-fontSize: ${fs};`)
          lines.push(`  --${base}-lineHeight: ${lh};`)
          lines.push(`  --${base}-letterSpacing: ${ls};`)

          const shorthand = toFontShorthand({ weight: fw, size: fs, lineHeight: lh, family: fm })
          lines.push(`  --${base}-font: ${shorthand};`)

          // Generate class with all individual properties
          classRules.push(`.typo-${base}{` +
            `font-family:var(--${base}-fontFamily);` +
            `font-weight:var(--${base}-fontWeight);` +
            `font-size:var(--${base}-fontSize);` +
            `line-height:var(--${base}-lineHeight);` +
            `letter-spacing:var(--${base}-letterSpacing);` +
            `}`)
          continue
        }
        if (val && typeof val === 'string') {
          // Parse the shorthand to extract individual values
          const parts = val.split(' ')
          let fontWeight = '400'
          let fontSize = '16px'
          let lineHeight = 'normal'
          let fontFamily = 'Inter'
          
          // Parse shorthand: "500 13px/normal Inter"
          let i = 0
          // Check for font-weight (numeric or keyword)
          if (parts[i] && /^\d{3}$|^(normal|bold|medium|semibold)$/i.test(parts[i])) {
            fontWeight = toFontWeight(parts[i])
            i++
          }
          // Check for font-size/line-height
          if (parts[i] && /\d+px/.test(parts[i])) {
            const sizeAndHeight = parts[i].split('/')
            fontSize = sizeAndHeight[0]
            if (sizeAndHeight[1]) lineHeight = sizeAndHeight[1]
            i++
          }
          // Rest is font-family
          if (parts[i]) {
            fontFamily = parts.slice(i).join(' ')
          }
          
          lines.push(`  --${base}-fontFamily: ${fontFamily};`)
          lines.push(`  --${base}-fontWeight: ${fontWeight};`)
          lines.push(`  --${base}-fontSize: ${fontSize};`)
          lines.push(`  --${base}-lineHeight: ${lineHeight};`)
          lines.push(`  --${base}-letterSpacing: normal;`)
          lines.push(`  --${base}-font: ${val};`)
          
          classRules.push(`.typo-${base}{` +
            `font-family:var(--${base}-fontFamily);` +
            `font-weight:var(--${base}-fontWeight);` +
            `font-size:var(--${base}-fontSize);` +
            `line-height:var(--${base}-lineHeight);` +
            `letter-spacing:var(--${base}-letterSpacing);` +
            `}`)
          continue
        }
      }

      // Non-typography token but value looks like a font shorthand: still emit helper
      if (typeof val === 'string' && looksLikeFontShorthand(val)) {
        lines.push(`  --${base}-font: ${val};`)
        lines.push(`  --${base}-letterSpacing: normal;`)
        classRules.push(`.typo-${base}{font:var(--${base}-font);letter-spacing:var(--${base}-letterSpacing);}`)
        continue
      }

      // Fallback: simple token value
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const [k, v] of Object.entries(val)) {
          lines.push(`  --${base}-${sanitize([k])}: ${normalize(k, v)};`)
        }
      } else {
        // Normalize based on token type when possible
        let outVal = val
        if (tType === 'fontSizes') outVal = toPx(val)
        else if (tType === 'fontWeights') outVal = toFontWeight(val)
        else outVal = normalize(base, val)
        lines.push(`  --${base}: ${outVal};`)
      }
    }

    const rootBlock = `:root{\n${lines.join('\n')}\n}`
    const helpers = classRules.length ? `\n\n/* Typography classes */\n${classRules.join('\n')}\n` : '\n'
    return rootBlock + helpers
  },
})

const OUT_DIR = 'src/lib/styles'

const sd = new StyleDictionary({
  source: ['tokens/**/*.json'],
  preprocessors: [
    {
      name: 'tokens-studio',
      options: {
        excludeParentKeys: true,
        alwaysAddFontStyle: false,
      }
    }
  ],
  log: {
    warnings: 'disabled',
    verbosity: 'default'
  },
  platforms: {
    css: {
      transformGroup: 'tokens-studio',
      buildPath: `${OUT_DIR}/`,
      files: [
        {
          destination: 'tokens.css',
          format: 'deta/css-variables',
        },
      ],
    },
  },
})

await mkdir(dirname(`${OUT_DIR}/tokens.css`), { recursive: true })
await sd.cleanAllPlatforms()
await sd.buildAllPlatforms()
