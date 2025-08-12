class SquircleClass {
  static get contextOptions() {
    return { alpha: true }
  }

  static get inputProperties() {
    return [
      '--squircle-radius',
      '--squircle-radius-top-left',
      '--squircle-radius-top-right',
      '--squircle-radius-bottom-right',
      '--squircle-radius-bottom-left',
      '--squircle-smooth',
      '--squircle-outline-width',
      '--squircle-outline-color',
      '--squircle-fill',
      '--squircle-shadow',
      '--squircle-inner-shadow'
    ]
  }

  calculateShadowBounds(shadows) {
    return shadows.reduce(
      (bounds, shadow) => {
        const { offsetX, offsetY, blur, spread } = shadow
        return {
          left: Math.max(bounds.left, Math.abs(Math.min(0, offsetX - blur / 2 - spread))),
          right: Math.max(bounds.right, Math.max(0, offsetX + blur / 2 + spread)),
          top: Math.max(bounds.top, Math.abs(Math.min(0, offsetY - blur / 2 - spread))),
          bottom: Math.max(bounds.bottom, Math.max(0, offsetY + blur / 2 + spread))
        }
      },
      { left: 0, right: 0, top: 0, bottom: 0 }
    )
  }

  parseColor(color) {
    // Handle rgba/rgb format with flexible spacing
    const rgbaMatch = color.match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)/
    )
    if (rgbaMatch) {
      return {
        r: Math.min(255, Math.max(0, parseInt(rgbaMatch[1]))),
        g: Math.min(255, Math.max(0, parseInt(rgbaMatch[2]))),
        b: Math.min(255, Math.max(0, parseInt(rgbaMatch[3]))),
        a: rgbaMatch[4] ? Math.min(1, Math.max(0, parseFloat(rgbaMatch[4]))) : 1
      }
    }

    // Handle hex colors
    const hexMatch = color.match(/#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/)
    if (hexMatch) {
      const hex = hexMatch[1]
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: 1
        }
      }
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: 1
      }
    }

    // If the color is in rgba format but wasn't caught by the first regex
    if (color.includes('rgba')) {
      const parts = color.match(/[\d.]+/g) || []
      if (parts.length >= 4) {
        return {
          r: Math.min(255, Math.max(0, parseInt(parts[0]))),
          g: Math.min(255, Math.max(0, parseInt(parts[1]))),
          b: Math.min(255, Math.max(0, parseInt(parts[2]))),
          a: Math.min(1, Math.max(0, parseFloat(parts[3])))
        }
      }
    }

    // Default to black with specified opacity
    return { r: 0, g: 0, b: 0, a: 0.8 }
  }

  parseShadowConfig(shadowStr) {
    if (!shadowStr) return []

    // Split by comma but preserve rgba() contents
    const shadows = shadowStr.split(/,(?![^(]*\))/).map((s) => s.trim())

    return shadows.map((shadow) => {
      // Remove any quotes
      const cleanStr = shadow.replace(/['"]/g, '')
      const isInset = cleanStr.includes('inset')
      const withoutInset = cleanStr.replace('inset', '').trim()

      // Match pattern: <offset-x> <offset-y> <blur-radius> <spread-radius> <color>
      const shadowParts = withoutInset.match(/^([^rgb].*?)(?=(rgba?|$))/)
      const measuresPart = shadowParts ? shadowParts[1].trim() : ''

      // Get the color part - everything after the measurements
      const colorPart = withoutInset.slice(measuresPart.length).trim()

      // Split measurements into parts
      const measures = measuresPart.split(/\s+/)

      // Improved parsing to handle explicit zero values
      const offsetX = measures[0] !== undefined ? parseFloat(measures[0]) : 0
      const offsetY = measures[1] !== undefined ? parseFloat(measures[1]) : 0
      const blur = measures[2] !== undefined ? parseFloat(measures[2]) : 0
      const spread = measures[3] !== undefined ? parseFloat(measures[3]) : 0

      return {
        offsetX,
        offsetY,
        blur,
        spread,
        color: colorPart || 'rgba(0,0,0,0.8)',
        isInset
      }
    })
  }

  paint(ctx, geom, properties) {
    const shadowStr = properties.get('--squircle-shadow').toString()
    const insetShadowStr = properties.get('--squircle-inner-shadow').toString()

    const shadows = this.parseShadowConfig(shadowStr).filter((s) => !s.isInset)
    const insetShadows = this.parseShadowConfig(insetShadowStr).filter((s) => s.isInset)

    const squircleRadii = this.parseRadii(properties)
    const smooth = this.parseSmooth(properties)
    const fill = properties.get('--squircle-fill').toString() || '#ffffff'
    const outlineWidth = parseFloat(properties.get('--squircle-outline-width')) || 0
    const outlineColor = properties.get('--squircle-outline-color').toString() || '#000000'

    const bounds = this.calculateShadowBounds(shadows)

    // Adjust inner geometry calculations
    const innerGeom = {
      width: geom.width - (bounds.left + bounds.right) * 0.8 - outlineWidth,
      height: geom.height - (bounds.top + bounds.bottom) * 0.8 - outlineWidth
    }

    const xOffset = (geom.width - innerGeom.width) / 2
    const yOffset = (geom.height - innerGeom.height) / 2

    // Draw regular shadows
    if (shadows.length > 0) {
      ctx.save()
      this.drawShadowLayers(ctx, innerGeom, squircleRadii, smooth, shadows, {
        left: xOffset,
        top: yOffset,
        right: bounds.right,
        bottom: bounds.bottom
      })
      ctx.restore()

      // Clear shadow underneath
      ctx.save()
      ctx.translate(xOffset, yOffset)
      ctx.globalCompositeOperation = 'destination-out'
      this.drawSquirclePath(ctx, innerGeom, squircleRadii, smooth)
      ctx.fill()
      ctx.restore()
    }

    // Draw base shape
    ctx.save()
    ctx.translate(xOffset, yOffset)
    this.drawSquircle(ctx, innerGeom, squircleRadii, smooth, 0, fill)

    // Draw inset shadows
    if (insetShadows.length > 0) {
      this.drawInsetShadowLayers(ctx, innerGeom, squircleRadii, smooth, insetShadows)
    }

    // Draw outline last
    if (outlineWidth > 0) {
      ctx.strokeStyle = outlineColor
      ctx.lineWidth = outlineWidth
      ctx.stroke()
    }

    ctx.restore()
  }

  drawInsetShadowLayers(ctx, geom, radii, smooth, shadows) {
    shadows.forEach((shadowConfig) => {
      const color = this.parseColor(shadowConfig.color)

      // Create clipping path to contain the shadow
      ctx.save()
      this.drawSquirclePath(ctx, geom, radii, smooth)
      ctx.clip()

      if (shadowConfig.blur === 0) {
        // For solid shadows, just draw a thin inner line
        const shrunkGeom = {
          width: geom.width - shadowConfig.spread * 2,
          height: geom.height - shadowConfig.spread * 2
        }
        const shrunkRadii = radii.map((r) => Math.max(0, r - shadowConfig.spread))

        ctx.save()
        ctx.translate(
          shadowConfig.offsetX + shadowConfig.spread,
          shadowConfig.offsetY + shadowConfig.spread
        )

        // Draw the inner shadow edge
        this.drawSquirclePath(ctx, shrunkGeom, shrunkRadii, smooth)
        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
        ctx.lineWidth = shadowConfig.spread * 2
        ctx.stroke()
        ctx.restore()
      } else {
        // For blurred shadows, create a gradual inner shadow
        const maxLayers = Math.max(8, Math.ceil(shadowConfig.blur))
        const baseAlpha = Math.min(1, Math.max(0, color.a))

        for (let i = 0; i < maxLayers; i++) {
          const progress = i / maxLayers
          const spread = shadowConfig.spread * progress
          const blur = shadowConfig.blur * Math.pow(progress, 1.5)

          // Decrease alpha as we move inward
          const layerAlpha = baseAlpha * Math.pow(progress, 0.5) * 0.2

          const shrunkGeom = {
            width: geom.width - spread * 2 - blur,
            height: geom.height - spread * 2 - blur
          }

          const shrunkRadii = radii.map((r) => Math.max(0, r - spread - blur / 2))

          ctx.save()
          ctx.translate(
            shadowConfig.offsetX * progress + spread + blur / 2,
            shadowConfig.offsetY * progress + spread + blur / 2
          )

          // Draw each layer of the shadow
          this.drawSquirclePath(ctx, shrunkGeom, shrunkRadii, smooth)
          ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${layerAlpha})`
          ctx.lineWidth = blur
          ctx.stroke()
          ctx.restore()
        }
      }

      ctx.restore()
    })
  }

  drawShadowLayers(ctx, geom, radii, smooth, shadows, bounds) {
    shadows.forEach((shadowConfig) => {
      if (shadowConfig.blur === 0) {
        // Handle solid shadows differently - draw just one layer with full opacity
        const color = this.parseColor(shadowConfig.color)
        const expandedGeom = {
          width: geom.width + shadowConfig.spread * 2,
          height: geom.height + shadowConfig.spread * 2
        }

        const expandedRadii = radii.map((r) => r + shadowConfig.spread)

        ctx.save()
        ctx.translate(
          bounds.left + shadowConfig.offsetX - shadowConfig.spread,
          bounds.top + shadowConfig.offsetY - shadowConfig.spread
        )

        this.drawSquirclePath(ctx, expandedGeom, expandedRadii, smooth)
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
        ctx.fill()
        ctx.restore()
      } else {
        // Original blurred shadow logic
        const maxLayers = Math.max(8, Math.ceil(shadowConfig.blur))
        const color = this.parseColor(shadowConfig.color)
        const baseAlpha = Math.min(1, Math.max(0, color.a))

        for (let i = 0; i < maxLayers; i++) {
          const progress = i / maxLayers
          const spread = shadowConfig.spread * progress
          const blur = shadowConfig.blur * Math.pow(progress, 1.5)
          const layerAlpha = baseAlpha * (1 - Math.pow(progress, 2)) * 0.7

          const expandedGeom = {
            width: geom.width + spread * 2 + blur,
            height: geom.height + spread * 2 + blur
          }

          const expandedRadii = radii.map((r) => r + spread + blur / 2)

          ctx.save()
          ctx.translate(
            bounds.left + shadowConfig.offsetX * progress - (spread + blur / 2),
            bounds.top + shadowConfig.offsetY * progress - (spread + blur / 2)
          )

          this.drawSquirclePath(ctx, expandedGeom, expandedRadii, smooth)
          const rgba = `rgba(${color.r}, ${color.g}, ${color.b}, ${layerAlpha})`
          ctx.fillStyle = rgba
          ctx.fill()
          ctx.restore()
        }
      }
    })
  }

  drawSquircle(ctx, geom, radii, smooth, lineWidth, fillColor, strokeColor) {
    this.drawSquirclePath(ctx, geom, radii, smooth)

    // First fill the shape
    if (fillColor) {
      ctx.fillStyle = fillColor
      ctx.fill()
    }

    // Then draw the outline if specified
    if (lineWidth > 0) {
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = lineWidth
      ctx.stroke()
    }
  }

  drawSquirclePath(ctx, geom, radii, smooth) {
    // Add a tiny offset to ensure full coverage
    const offset = 0

    ctx.beginPath()

    const drawCorner = (startX, startY, cpX1, cpY1, cpX2, cpY2, endX, endY) => {
      ctx.lineTo(startX, startY)
      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, endX, endY)
    }

    // Extend the path slightly beyond the bounds
    drawCorner(
      radii[0],
      -offset, // Start slightly above
      radii[0] / smooth,
      -offset,
      -offset,
      radii[0] / smooth,
      -offset,
      radii[0] // Extend slightly left
    )

    drawCorner(
      -offset,
      geom.height - radii[3], // Extend slightly left
      -offset,
      geom.height - radii[3] / smooth,
      radii[3] / smooth,
      geom.height + offset, // Extend slightly below
      radii[3],
      geom.height + offset
    )

    drawCorner(
      geom.width - radii[2],
      geom.height + offset, // Extend slightly below
      geom.width - radii[2] / smooth,
      geom.height + offset,
      geom.width + offset,
      geom.height - radii[2] / smooth,
      geom.width + offset,
      geom.height - radii[2] // Extend slightly right
    )

    drawCorner(
      geom.width + offset,
      radii[1], // Extend slightly right
      geom.width + offset,
      radii[1] / smooth,
      geom.width - radii[1] / smooth,
      -offset, // Start slightly above
      geom.width - radii[1],
      -offset
    )

    ctx.closePath()
  }

  parseRadii(properties) {
    const individualRadiiProps = [
      '--squircle-radius-top-left',
      '--squircle-radius-top-right',
      '--squircle-radius-bottom-right',
      '--squircle-radius-bottom-left'
    ]

    let radii = individualRadiiProps.map((prop) => {
      const value = properties.get(prop)
      return value ? parseFloat(value) : NaN
    })

    if (radii.some(isNaN)) {
      const radiusStr = properties.get('--squircle-radius').toString()
      const matches = radiusStr.match(/([0-9]+[a-z%]*)/g)

      if (matches) {
        const shorthand = matches.map((val) => parseFloat(val))
        while (shorthand.length < 4) {
          if (shorthand.length === 1) {
            shorthand.push(shorthand[0])
          } else if (shorthand.length === 2) {
            shorthand.push(...shorthand)
          } else if (shorthand.length === 3) {
            shorthand.push(shorthand[1])
          }
        }
        radii = shorthand
      } else {
        radii = Array(4).fill(8)
      }
    }

    return radii
  }

  parseSmooth(properties) {
    const smooth = parseFloat(properties.get('--squircle-smooth')) || 0
    return smooth === 0 ? 1 : smooth * 10
  }
}

if (typeof registerPaint !== 'undefined') {
  registerPaint('squircle', SquircleClass)
}

/// ===============================================================================================

/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class MasonryClass {
  static get inputProperties() {
    return ['--padding-inline', '--padding-block', '--columns', '--gap']
  }

  async intrinsicSizes() {
    /* TODO implement :) */
  }

  async layout(children, edges, constraints, styleMap) {
    const inlineSize = constraints.fixedInlineSize

    const paddingInline = parseInt(styleMap.get('--padding-inline').toString())
    const paddingBlock = parseInt(styleMap.get('--padding-block').toString())
    const gap = parseInt(styleMap.get('--gap').toString())
    const columnValue = styleMap.get('--columns').toString()

    // We also accept 'auto', which will select the BEST number of columns.
    let columns = parseInt(columnValue)
    if (columnValue == 'auto' || !columns) {
      columns = Math.ceil(inlineSize / 350) // MAGIC NUMBER \o/.
    }

    // Layout all children with simply their column size.
    const childInlineSize = (inlineSize - 2 * paddingInline - (columns - 1) * gap) / columns
    const childFragments = await Promise.all(
      children.map((child) => {
        return child.layoutNextFragment({ fixedInlineSize: childInlineSize })
      })
    )

    let autoBlockSize = 0
    const columnOffsets = Array(columns).fill(paddingBlock) // Initialize with top padding
    for (let childFragment of childFragments) {
      // Select the column with the least amount of stuff in it.
      const min = columnOffsets.reduce(
        (acc, val, idx) => {
          if (!acc || val < acc.val) {
            return { idx, val }
          }
          return acc
        },
        { val: +Infinity, idx: -1 }
      )

      childFragment.inlineOffset = paddingInline + (childInlineSize + gap) * min.idx
      childFragment.blockOffset = min.val

      columnOffsets[min.idx] = min.val + childFragment.blockSize + gap
      autoBlockSize = Math.max(autoBlockSize, columnOffsets[min.idx])
    }

    return { autoBlockSize: autoBlockSize + paddingBlock - gap, childFragments }
  }
}

if (typeof registerLayout !== 'undefined') {
  registerLayout('masonry', MasonryClass)
}
