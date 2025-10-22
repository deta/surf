import { writable } from 'svelte/store'

export const useFPS = (every = 10) => {
  const fpsAvg = writable(0)
  let fps = 0

  let lastCalledTime = Date.now()

  let steps = 0
  const loop = () => {
    const delta = (Date.now() - lastCalledTime) / 1000
    lastCalledTime = Date.now()
    fps = Math.round(1 / delta)

    if (steps === every) {
      fpsAvg.set(fps)
      steps = 0
    }

    steps++
    requestAnimationFrame(loop)
  }

  loop()

  return fpsAvg
}
