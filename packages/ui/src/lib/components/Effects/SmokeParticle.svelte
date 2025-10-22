<script lang="ts" context="module">
  import SmokeParticle from './SmokeParticle.svelte'

  interface Point {
    x: number
    y: number
  }
  function poissonDiskSampling(rect: DOMRect, n: number, minDistance: number): Point[] {
    const width = rect.width
    const height = rect.height
    const cellSize = minDistance / Math.sqrt(2)
    const gridWidth = Math.ceil(width / cellSize)
    const gridHeight = Math.ceil(height / cellSize)

    const grid: (Point | null)[][] = new Array(gridWidth)
      .fill(null)
      .map(() => new Array(gridHeight).fill(null))
    const points: Point[] = []
    const activeList: Point[] = []

    // Helper function to get neighboring cells
    function getNeighbors(point: Point): Point[] {
      const neighbors: Point[] = []
      const cellX = Math.floor(point.x / cellSize)
      const cellY = Math.floor(point.y / cellSize)

      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          const newCellX = cellX + i
          const newCellY = cellY + j
          if (newCellX >= 0 && newCellX < gridWidth && newCellY >= 0 && newCellY < gridHeight) {
            const neighbor = grid[newCellX][newCellY]
            if (neighbor) neighbors.push(neighbor)
          }
        }
      }

      return neighbors
    }

    // Helper function to check if a point is valid
    function isValidPoint(point: Point): boolean {
      if (point.x < 0 || point.x >= width || point.y < 0 || point.y >= height) return false

      const cellX = Math.floor(point.x / cellSize)
      const cellY = Math.floor(point.y / cellSize)
      const neighbors = getNeighbors(point)

      for (const neighbor of neighbors) {
        const dx = neighbor.x - point.x
        const dy = neighbor.y - point.y
        if (dx * dx + dy * dy < minDistance * minDistance) return false
      }

      return true
    }

    // Add first point
    const firstPoint: Point = {
      x: Math.random() * width,
      y: Math.random() * height
    }
    points.push(firstPoint)
    activeList.push(firstPoint)
    grid[Math.floor(firstPoint.x / cellSize)][Math.floor(firstPoint.y / cellSize)] = firstPoint

    // Main loop
    while (activeList.length > 0 && points.length < n) {
      const randomIndex = Math.floor(Math.random() * activeList.length)
      const point = activeList[randomIndex]
      let found = false

      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * 2 * Math.PI
        const radius = minDistance + Math.random() * minDistance
        const newPoint: Point = {
          x: point.x + radius * Math.cos(angle),
          y: point.y + radius * Math.sin(angle)
        }

        if (isValidPoint(newPoint)) {
          points.push(newPoint)
          activeList.push(newPoint)
          grid[Math.floor(newPoint.x / cellSize)][Math.floor(newPoint.y / cellSize)] = newPoint
          found = true
          break
        }
      }

      if (!found) {
        activeList.splice(randomIndex, 1)
      }
    }

    // Adjust points to be relative to the DOMRect
    return points.map((point) => ({
      x: point.x + rect.x,
      y: point.y + rect.y
    }))
  }

  interface SpawnProps {
    densityN?: number
    size?: number
    velocityScale?: number
    cloudPointN?: number
    duration?: number
  }
  export function spawnRadialSmoke(pos: { x: number; y: number }, props: SpawnProps = {}) {
    const randomPoints = []
    const SPREAD = 20
    for (let i = 0; i <= props.densityN ?? 20; i++) {
      randomPoints.push({
        x: pos.x + (Math.random() - 0.5) * SPREAD,
        y: pos.y + (Math.random() - 0.5) * SPREAD
      })
    }

    for (const point of randomPoints) {
      const velocity = {
        x: point.x - pos.x,
        y: point.y - pos.y
      }
      const vMag = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y)
      velocity.x = (velocity.x / vMag) * (props.velocityScale ?? 1)
      velocity.y = (velocity.y / vMag) * (props.velocityScale ?? 1)

      let pop = mount(SmokeParticle, {
        target: document.body,
        props: {
          xOrigin: point.x,
          yOrigin: point.y,
          width: props.size ?? 15,
          height: props.size ?? 15,
          velocity,
          cloudPointN: props.cloudPointN ?? 5,
          duration: 1000
        },
        events: { destroy: () => unmount(pop) }
      })
    }
  }
  export function spawnBoxSmoke(box: DOMRect, props: SpawnProps = {}) {
    const boxCenterP = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2
    }

    const randomPoints = poissonDiskSampling(box, props.densityN ?? 20, 20)
    /*const randomPoints = []
    for (let i = 0; i <= (props.densityN ?? 20); i++) {
      randomPoints.push({
        x: box.x + Math.random() * box.width,
        y: box.y + Math.random() * box.height
      })
    }*/

    for (const point of randomPoints) {
      // calc velocity from point to center of box
      const velocity = {
        x: point.x - boxCenterP.x,
        y: point.y - boxCenterP.y
      }
      const vMag = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y)
      velocity.x = (velocity.x / vMag) * (props.velocityScale ?? 1)
      velocity.y = (velocity.y / vMag) * (props.velocityScale ?? 1)

      let particle = mount(SmokeParticle, {
        target: document.body,
        props: {
          xOrigin: point.x,
          yOrigin: point.y,
          width: props.size ?? 15,
          height: props.size ?? 15,
          velocity,
          cloudPointN: props.cloudPointN ?? 5,
          duration: props.duration ?? 800
        },
        events: { destroy: () => unmount(particle) }
      })
    }
  }
</script>

<script lang="ts">
  import { createEventDispatcher, mount, unmount } from 'svelte'

  export let xOrigin: number
  export let yOrigin: number
  export let width: number
  export let height: number
  export let velocity: { x: number; y: number }
  export let cloudPointN: number
  export let duration: number

  const finalXOffset = velocity.x * 10
  const finalYOffset = velocity.y * 10

  const dispatch = createEventDispatcher<{
    destroy: void
  }>()

  function generateCirclePoints(
    N: number,
    D: number,
    origin: { x: number; y: number },
    angleOffset: number = 0
  ) {
    const points = []
    const angleStep = (2 * Math.PI) / N
    for (let i = 0; i < N; i++) {
      const angle = i * angleStep
      const x = origin.x + D * Math.cos(angle + angleOffset)
      const y = origin.y + D * Math.sin(angle + angleOffset)
      points.push({ x, y })
    }
    return points
  }

  function generatePath(points: { x: number; y: number }[]) {
    if (points.length < 2) return ''

    let path = `M ${points[0].x} ${points[0].y}`

    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      const nextPoint = points[(i + 1) % points.length]
      const dx = nextPoint.x - point.x
      const dy = nextPoint.y - point.y
      const radius = Math.sqrt(dx * dx + dy * dy) / 2

      path += ` A ${radius} ${radius} 0 0 1 ${nextPoint.x} ${nextPoint.y}`
    }

    return path
  }

  const points = generateCirclePoints(
    cloudPointN,
    27,
    { x: 50, y: 50 },
    Math.PI * Math.random() * 1.2
  ).map((p) => ({
    x: p.x + (Math.random() - 0.5) * 12,
    y: p.y + (Math.random() - 0.5) * 12
  }))
  const combinedPath = generatePath(points)

  function onAnimationEnded(e: AnimationEvent) {
    if (e.animationName === 'smokeVelocity') {
      dispatch('destroy')
    }
  }
</script>

<svg
  on:animationend={onAnimationEnded}
  class="pointer-events-none"
  style="width: {width}px; height: {height}px; top: {yOrigin - height / 2}px; left: {xOrigin -
    width /
      2}px; --finalXOffset: {finalXOffset}px; --finalYOffset: {finalYOffset}px; animation: smokeVelocity {duration}ms cubic-bezier(0.19, 1, 0.22, 1);"
  viewBox="0 0 100 100"
>
  <path
    d={combinedPath}
    fill="light-dark(white, rgba(255, 255, 255, 0.85))"
    stroke="light-dark(black, rgba(15, 23, 42, 0.6))"
    stroke-width="5"
  />
</svg>

<style>
  svg {
    pointer-events: none;
    position: fixed;
    transform: translateZ(0);
    will-change: transform, opacity;
  }

  @keyframes -global-smokeVelocity {
    0% {
      transform: translate3D(0, 0, 0);
      opacity: 1;
    }
    100% {
      transform: translate3D(var(--finalXOffset), var(--finalYOffset), 0);
      opacity: 0;
    }
  }
</style>
