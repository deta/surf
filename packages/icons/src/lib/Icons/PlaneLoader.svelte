<script lang="ts">
  import { onMount, afterUpdate } from 'svelte'
  import planeImage from '../assets/plane.png?url'

  export interface WindConfig {
    animation: {
      speed: number
      angle: number
    }
    windPaths: {
      pathCurvature: number
      pathVariation: number
      showPaths: boolean
    }
    particles: {
      count: number
      minSize: number
      maxSize: number
      color: string
    }
    trails: {
      baseLength: number
      lengthVariation: number
      thickness: number
      opacity: number
    }
    vignette: {
      radius: number
      fadeStart: number
      fadeMid: number
    }
    spawnArea: {
      startX: number
      endX: number
      yRange: number
      density: number
    }
  }

  export let size: number = 32

  const config: WindConfig = {
    animation: {
      speed: 2,
      angle: 25
    },
    windPaths: {
      pathCurvature: 1.2,
      pathVariation: 1.5,
      showPaths: false
    },
    particles: {
      count: 20,
      minSize: 1,
      maxSize: 1,
      color: '#ffffff'
    },
    trails: {
      baseLength: 16,
      lengthVariation: 0.75,
      thickness: 2,
      opacity: 0.9
    },
    vignette: {
      radius: 50,
      fadeStart: 60,
      fadeMid: 90
    },
    spawnArea: {
      startX: 30,
      endX: 30,
      yRange: 40,
      density: 0.04
    }
  }

  let svgElement: SVGSVGElement

  function generateWindParticles() {
    if (!svgElement) return

    const {
      animation: { speed, angle },
      windPaths: { pathCurvature, pathVariation, showPaths },
      particles: { count, minSize, maxSize, color },
      trails: { baseLength, lengthVariation, thickness, opacity },
      vignette: { radius, fadeStart, fadeMid },
      spawnArea: { startX, endX, yRange, density }
    } = config

    // Update vignette gradient
    const vignetteGradient = svgElement.querySelector('#vignette') as SVGRadialGradientElement
    if (vignetteGradient) {
      vignetteGradient.innerHTML = `
          <stop offset="0%" style="stop-color:white;stop-opacity:1" />
          <stop offset="${fadeStart}%" style="stop-color:white;stop-opacity:1" />
          <stop offset="${fadeMid}%" style="stop-color:white;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:white;stop-opacity:0" />
        `
      vignetteGradient.setAttribute('r', `${radius}%`)
    }

    // Update trail gradient
    const trailGradient = svgElement.querySelector('#trailGradient') as SVGLinearGradientElement
    if (trailGradient) {
      trailGradient.innerHTML = `
          <stop offset="0%" style="stop-color:${color};stop-opacity:${opacity}" />
          <stop offset="50%" style="stop-color:${color};stop-opacity:${opacity * 0.6}" />
          <stop offset="100%" style="stop-color:${color};stop-opacity:0" />
        `
    }

    // Generate particles
    const container = svgElement.querySelector('#particleContainer') as SVGGElement
    if (!container) return

    container.innerHTML = ''

    for (let i = 0; i < count; i++) {
      const particleSize = minSize + (maxSize - minSize) * Math.random()

      // Apply density to spawn distribution
      const densityFactor = Math.pow(density, 0.5)
      const effectiveXRange = (endX - startX) / densityFactor
      const effectiveYRange = yRange / densityFactor

      const xOffset = (endX - startX - effectiveXRange) / 2
      const yOffset = (yRange - effectiveYRange) / 2

      const baseStartX = startX + xOffset + Math.random() * effectiveXRange
      const baseStartY = yOffset + Math.random() * effectiveYRange

      // Adjust starting positions based on angle
      const baseAngleRad = (angle * Math.PI) / 180
      const targetVisibleX = 16 // Center of the 32px icon
      const distanceToVisible = baseStartX - targetVisibleX
      const angleYAdjustment = distanceToVisible * Math.tan(baseAngleRad)

      const particleStartX = baseStartX
      const particleStartY = baseStartY - angleYAdjustment

      // Create curved wind path using bezier control points
      const particleEndX = particleStartX - 50 - Math.random() * 10
      const particleEndY = particleStartY + Math.tan(baseAngleRad) * (particleStartX - particleEndX)

      // Generate control points for natural wind curves
      const pathLength = Math.sqrt(
        (particleEndX - particleStartX) ** 2 + (particleEndY - particleStartY) ** 2
      )
      const curveMagnitude = pathCurvature * pathLength * 0.1

      // Control point 1 (30% along path)
      const cp1Progress = 0.3
      const cp1BaseX = particleStartX + (particleEndX - particleStartX) * cp1Progress
      const cp1BaseY = particleStartY + (particleEndY - particleStartY) * cp1Progress
      const cp1OffsetY = (Math.random() - 0.5) * curveMagnitude * pathVariation
      const cp1X = cp1BaseX
      const cp1Y = cp1BaseY + cp1OffsetY

      // Control point 2 (70% along path)
      const cp2Progress = 0.7
      const cp2BaseX = particleStartX + (particleEndX - particleStartX) * cp2Progress
      const cp2BaseY = particleStartY + (particleEndY - particleStartY) * cp2Progress
      const cp2OffsetY = (Math.random() - 0.5) * curveMagnitude * pathVariation * 0.8
      const cp2X = cp2BaseX
      const cp2Y = cp2BaseY + cp2OffsetY

      // Create SVG path for particle movement
      const pathId = `path-${i}-${Date.now()}`
      const movementPath = `M${particleStartX},${particleStartY} C${cp1X},${cp1Y} ${cp2X},${cp2Y} ${particleEndX},${particleEndY}`

      const duration = (1.2 + Math.random() * 1.0) / speed

      // Apply trail length variation
      const baseTrailLen = baseLength * (0.5 + (particleSize / maxSize) * 0.5)
      const variationFactor = 1 + (Math.random() - 0.5) * 2 * lengthVariation
      const finalTrailLen = baseTrailLen * variationFactor

      const trailThickness = thickness * (0.5 + (particleSize / maxSize) * 0.5)

      // Create multiple trail segments that follow the path with delays
      const numTrailSegments = Math.max(3, Math.floor(finalTrailLen * 2))
      let trailSegments = ''

      for (let seg = 0; seg < numTrailSegments; seg++) {
        const segmentDelay = (seg * duration) / (numTrailSegments * 4)
        const segmentOpacity = (1 - seg / numTrailSegments) * opacity
        const segmentThickness = trailThickness * (1 - (seg / numTrailSegments) * 0.7)

        trailSegments += `
            <circle r="${segmentThickness / 2}" fill="${color}" opacity="${segmentOpacity}">
              <animateMotion dur="${duration}s" repeatCount="indefinite" begin="${segmentDelay}s">
                <mpath href="#${pathId}" />
              </animateMotion>
            </circle>
          `
      }

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')

      // Debug path visualization
      let debugPath = ''
      if (showPaths) {
        debugPath = `<path d="${movementPath}" stroke="rgba(255,255,255,0.4)" stroke-width="0.5" fill="none" stroke-dasharray="2,2" />
                       <circle cx="${particleStartX}" cy="${particleStartY}" r="1" fill="rgba(0,255,0,0.6)" />
                       <circle cx="${cp1X}" cy="${cp1Y}" r="0.8" fill="rgba(255,255,0,0.6)" />
                       <circle cx="${cp2X}" cy="${cp2Y}" r="0.8" fill="rgba(255,255,0,0.6)" />
                       <circle cx="${particleEndX}" cy="${particleEndY}" r="1" fill="rgba(255,0,0,0.6)" />`
      }

      g.innerHTML = `
          ${debugPath}
          <path id="${pathId}" d="${movementPath}" fill="none" opacity="0" />
          
          <!-- Trail segments following the path -->
          ${trailSegments}
          
          <!-- Main particle -->
          <circle fill="${color}" r="${particleSize}" opacity="0.9">
            <animateMotion dur="${duration}s" repeatCount="indefinite">
              <mpath href="#${pathId}" />
            </animateMotion>
          </circle>
        `

      container.appendChild(g)
    }
  }

  onMount(() => {
    generateWindParticles()
  })

  afterUpdate(() => {
    generateWindParticles()
  })
</script>

<svg
  bind:this={svgElement}
  width={size}
  height={size}
  viewBox="0 0 32 32"
  class="plane-loader"
  xmlns="http://www.w3.org/2000/svg"
>
  <defs>
    <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
      <stop offset="0%" style="stop-color:white;stop-opacity:1" />
      <stop offset="60%" style="stop-color:white;stop-opacity:1" />
      <stop offset="85%" style="stop-color:white;stop-opacity:0.3" />
      <stop offset="100%" style="stop-color:white;stop-opacity:0" />
    </radialGradient>

    <linearGradient id="trailGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#4A90E2;stop-opacity:0.9" />
      <stop offset="50%" style="stop-color:#4A90E2;stop-opacity:0.6" />
      <stop offset="100%" style="stop-color:#4A90E2;stop-opacity:0" />
    </linearGradient>

    <mask id="vignetteMask">
      <rect width="32" height="32" fill="url(#vignette)" />
    </mask>
  </defs>

  <g id="particleContainer" mask="url(#vignetteMask)">
    <!-- Particles will be generated here -->
  </g>

  <!-- Plane image in the center -->
  <image href={planeImage} x="2" y="2" width="28" height="28">
    <animateTransform
      attributeName="transform"
      type="translate"
      values="0,0; 0.6,0.3; 0.1,-0.6; -0.7,0.2; 0.3,0.4; 0,0"
      dur="4s"
      repeatCount="indefinite"
      calcMode="spline"
      keyTimes="0; 0.2; 0.4; 0.6; 0.8; 1"
      keySplines="0.4,0,0.6,1; 0.4,0,0.6,1; 0.4,0,0.6,1; 0.4,0,0.6,1; 0.4,0,0.6,1"
    />
  </image>
</svg>

<style lang="scss">
  .plane-loader {
    border-radius: 9px;
    background: radial-gradient(
      453.65% 343.29% at 50.04% 0%,
      #6cd2ff 0%,
      #0096f3 69.23%,
      #0063ff 93.37%
    );
    background: radial-gradient(
      453.65% 343.29% at 50.04% 0%,
      color(display-p3 0.5263 0.8157 0.9904) 0%,
      color(display-p3 0 0.5764 0.9232) 69.23%,
      color(display-p3 0.0275 0.3804 1) 93.37%
    );

    //inner shadow top shine
    box-shadow:
      0 -0.5px 1px 0 rgba(119, 189, 255, 0.15) inset,
      0 1px 1px 0 #fff inset,
      0 12px 5px 0 #3e4750,
      0 7px 4px 0 rgba(62, 71, 80, 0.01),
      0 3px 3px 0 rgba(62, 71, 80, 0.01),
      0 1px 2px 0 rgba(62, 71, 80, 0.01),
      0 1px 1px 0 #000,
      0 1px 1px 0 rgba(0, 0, 0, 0.01),
      0 1px 1px 0 rgba(0, 0, 0, 0.02),
      0 0 1px 0 rgba(0, 0, 0, 0.04);
    box-shadow:
      0 -0.5px 1px 0 color(display-p3 0.5294 0.7333 0.9961 / 0.15) inset,
      0 1px 1px 0 color(display-p3 1 1 1) inset,
      0 12px 5px 0 color(display-p3 0.251 0.2784 0.3098 / 0),
      0 7px 4px 0 color(display-p3 0.251 0.2784 0.3098 / 0.01),
      0 3px 3px 0 color(display-p3 0.251 0.2784 0.3098 / 0.01),
      0 1px 2px 0 color(display-p3 0.251 0.2784 0.3098 / 0.01),
      0 1px 1px 0 color(display-p3 0 0 0 / 0),
      0 1px 1px 0 color(display-p3 0 0 0 / 0.01),
      0 1px 1px 0 color(display-p3 0 0 0 / 0.02),
      0 0 1px 0 color(display-p3 0 0 0 / 0.04);
  }
</style>
