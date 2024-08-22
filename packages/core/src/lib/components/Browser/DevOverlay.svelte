<script lang="ts">
  import { onMount } from 'svelte'

  let fps = 0
  let domNodes = 0
  let renderingPipeline = 'N/A'
  let v8Metrics = 'Checking...'

  function getV8Metrics() {
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory
      v8Metrics = `${(memoryInfo.usedJSHeapSize / (1024 * 1024)).toFixed(2)} MB / ${(memoryInfo.jsHeapSizeLimit / (1024 * 1024)).toFixed(2)} MB`
    } else {
      v8Metrics = 'Not available'
    }
  }

  onMount(() => {
    return new Promise(async (resolve) => {
      let frameCount = 0
      let lastTime = performance.now()

      function updateMetrics() {
        const now = performance.now()
        frameCount++

        if (now - lastTime > 1000) {
          fps = Math.round((frameCount * 1000) / (now - lastTime))
          frameCount = 0
          lastTime = now

          domNodes = document.getElementsByTagName('*').length

          getV8Metrics()
        }

        requestAnimationFrame(updateMetrics)
      }

      updateMetrics()

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
      <p>[DEV]: Surf |</p>
      <p>
        <span
          class:text-red-500={fps < 50}
          class:text-yellow-500={fps < 100 && fps >= 50}
          class:text-green-500={fps >= 100}>FPS: {fps}</span
        >
        |
      </p>
      <p>
        DOM Nodes: {domNodes} | V8 JS Heap: {v8Metrics}
      </p>
    </div>
  </div>
</div>
