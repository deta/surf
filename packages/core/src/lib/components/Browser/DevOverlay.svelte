<script lang="ts">
  import { onMount } from 'svelte'

  let fps = 0
  let memory = 0
  let cpuUsage = 0
  let networkLatency = 0
  let loadTime = 0
  let domNodes = 0
  let gitBranch = 'unknown'
  let gpuInfo = 'Checking...'
  let powerConsumption = 'Checking...'
  let audioContexts = 0
  let timerPrecision = 0
  let renderingPipeline = 'N/A'
  let inputLag = 0
  let v8Metrics = 'Checking...'

  async function getGPUInfo() {
    if ('gpu' in navigator) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter()
        const info = await adapter.requestAdapterInfo()
        gpuInfo = `${info.vendor} - ${info.architecture}`
      } catch (error) {
        gpuInfo = 'Not available'
      }
    } else {
      gpuInfo = 'WebGPU not supported'
    }
  }

  function estimatePowerConsumption() {
    // this is very rough estimation lol
    const estimatedPower = cpuUsage * 0.1 + memory * 0.05
    powerConsumption = `~${estimatedPower.toFixed(2)} W`
  }

  function getV8Metrics() {
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory
      v8Metrics = `JS Heap: ${(memoryInfo.usedJSHeapSize / (1024 * 1024)).toFixed(2)} MB / ${(memoryInfo.jsHeapSizeLimit / (1024 * 1024)).toFixed(2)} MB`
    } else {
      v8Metrics = 'Not available'
    }
  }

  onMount(() => {
    return new Promise(async (resolve) => {
      await getGPUInfo()

      const startTime = performance.now()
      let frameCount = 0
      let lastTime = performance.now()

      //input lag measurement
      let lastInputTime = 0
      document.addEventListener('input', () => {
        lastInputTime = performance.now()
      })

      function updateMetrics() {
        const now = performance.now()
        frameCount++

        if (now - lastTime > 1000) {
          fps = Math.round((frameCount * 1000) / (now - lastTime))
          frameCount = 0
          lastTime = now

          if (window.performance && (performance as any).memory) {
            memory = Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024))
          }

          const cpuTimes = performance.now()
          setTimeout(() => {
            const cpuTimeDiff = performance.now() - cpuTimes
            cpuUsage = Math.round((cpuTimeDiff / 1000) * 100)
          }, 0)

          const start = Date.now()
          fetch('/ping').then(() => {
            networkLatency = Date.now() - start
          })

          domNodes = document.getElementsByTagName('*').length

          estimatePowerConsumption()

          // Audio Contexts
          audioContexts = (window as any).audioContexts?.length || 0

          // hiresolution timer
          const timerStart = performance.now()
          setTimeout(() => {
            timerPrecision = performance.now() - timerStart
          }, 0)

          // rendering pipeline
          renderingPipeline = `Frames: ${fps}, Nodes: ${domNodes}`

          // input Lag
          if (lastInputTime) {
            inputLag = performance.now() - lastInputTime
            lastInputTime = 0
          }

          getV8Metrics()
        }

        requestAnimationFrame(updateMetrics)
      }

      updateMetrics()

      window.addEventListener('load', () => {
        loadTime = Math.round(performance.now() - startTime)
      })

      resolve(() => {})
    })
  })
</script>

<div
  class="absolute bottom-0 right-0 w-fit p-1 bg-neutral-900 bg-opacity-50 text-neutral-100 font-mono text-xs pointer-events-none"
  style="z-index: 999999999999;"
>
  <div class="flex justify-between items-center flex-col">
    <div class="flex flex-row items-center divide-x-1 space-x-2">
      <p>
        [DEV]: Surf | <span class="text-green-500">Branch: {gitBranch}</span> |
      </p>
      <p>
        <span
          class:text-red-500={fps < 50}
          class:text-yellow-500={fps < 100 && fps >= 50}
          class:text-green-500={fps >= 100}>FPS: {fps}</span
        >
        | CPU: {cpuUsage}%
      </p>
      <p>
        GPU: {gpuInfo} | Power: {powerConsumption}
      </p>
      <p>
        Network: {networkLatency}ms | Load: {loadTime}ms
      </p>
      <p>
        DOM: {domNodes} | Audio: {audioContexts}
      </p>
      <p>
        Timer: {timerPrecision.toFixed(2)}ms | Input Lag: {inputLag.toFixed(2)}ms
      </p>
      <p>
        Render: {renderingPipeline} | V8: {v8Metrics}
      </p>
    </div>
  </div>
</div>
