<script>
  import { onMount, onDestroy } from 'svelte'

  export let size = 300
  export let particleCount = 100
  export let color = '#3498db'

  let canvas
  let animationFrameId

  onMount(() => {
    const ctx = canvas.getContext('2d', { alpha: true })
    let particles = []

    const createParticle = () => {
      const angle = Math.random() * Math.PI * 2
      const radius = size / 2 + Math.random() * 20
      return {
        x: size / 2 + Math.cos(angle) * radius,
        y: size / 2 + Math.sin(angle) * radius,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.5
      }
    }

    const updateParticle = (particle) => {
      const dx = size / 2 - particle.x
      const dy = size / 2 - particle.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < 5) {
        return createParticle()
      }

      particle.x += (dx / distance) * particle.speed
      particle.y += (dy / distance) * particle.speed

      particle.opacity = Math.max(0, particle.opacity - 0.005)

      return particle
    }

    const drawParticle = (particle) => {
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${particle.opacity})`
      ctx.fill()
    }

    const animate = () => {
      ctx.clearRect(0, 0, size, size)

      particles = particles.map(updateParticle).filter((p) => p.opacity > 0)
      particles.forEach(drawParticle)

      while (particles.length < particleCount) {
        particles.push(createParticle())
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(createParticle())
    }

    animate()
  })

  onDestroy(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }
  })
</script>

<canvas bind:this={canvas} width={size} height={size} class="rounded-full" />

<style>
  canvas {
    display: block;
  }
</style>
