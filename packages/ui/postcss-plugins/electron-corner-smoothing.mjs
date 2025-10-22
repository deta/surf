// PostCSS plugin to add `-electron-corner-smoothing` alongside any border radius declarations
// Usage: electronCornerSmoothing({ value: '60%' })

export default function electronCornerSmoothing(options = {}) {
  const value = options.value ?? '60%'

  const isRadiusProp = (prop) => {
    const p = String(prop).toLowerCase()
    if (p === 'border-radius') return true
    // covers: border-top-left-radius, -top-right-, -bottom-right-, -bottom-left-
    return p.startsWith('border-') && p.endsWith('-radius')
  }

  return {
    postcssPlugin: 'electron-corner-smoothing',
    Declaration(decl) {
      if (!isRadiusProp(decl.prop)) return
      const rule = decl.parent
      if (!rule || rule.type !== 'rule') return

      const alreadyHas = rule.nodes?.some(
        (n) => n.type === 'decl' && String(n.prop).toLowerCase() === '-electron-corner-smoothing'
      )

      if (!alreadyHas) {
        rule.append({ prop: '-electron-corner-smoothing', value })
      }
    }
  }
}

// Required for PostCSS to recognize ESM plugin
electronCornerSmoothing.postcss = true
