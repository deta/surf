<script lang="ts">
  import { writable } from "svelte/store";
  import DebugPanel from "./DebugPanel.svelte";
  import { onDestroy, onMount } from "svelte";
  import { fps, memory } from "./debugUtils.js";

  let vFPS = writable({ value: 0, maxValue: 0 });
  let vMS = writable({ value: 0, maxValue: 0 });
  let vMB = writable({ value: 0, maxValue: 0 });

  let beginTime: number;
  let prevTime: number;
  let frames = 0;

  const _fps = fps();
  const { supported, result: _mem } = memory()

  function begin() {
    beginTime = (performance || Date).now();
  }
  function end(): number {
    frames++;
    const time = (performance || Date).now();

    vMS.update((v) => {
      v.value = time - beginTime;
      v.maxValue = 200;
      return v;
    });

    if (time >= prevTime + 1000) {
      vFPS.update((v) => {
        v.value = (frames * 1000) / (time - prevTime);
        v.maxValue = 100;
        return v;
      });

      prevTime = time;
      frames = 0;

      let memory = performance.memory;
      vFPS.update((v) => {
        v.value = memory.usedJSHeapSize / 1048576;
        v.maxValue = memory.jsHeapSizeLimit / 1048576;
        return v;
      });
    }

    return time;
  }
  function update() {
    frames++;
    beginTime = end();
  }

  function f() {
    // begin();
    // end();
    // end()

    requestAnimationFrame(f);
  }

  onMount(() => {
    beginTime = (performance || Date).now();
    prevTime = beginTime;
    // f();
  });
  onDestroy(
    _fps.subscribe((val) => {
      vFPS.update((v) => {
        v.value = val;
        v.maxValue = 125;
        return v;
      });
    })
  );
  onDestroy(
    _mem.subscribe((val) => {
      vMB.update((v) => {
        v.value = val?.usedJSHeapSize / 1048576;
        v.maxValue = 100//val?.jsHeapSizeLimit / 1048576;
        return v;
      });
    })
  );
</script>

<li style="display: flex; justify-content: end;">
  <DebugPanel name="FPS" fg="#0ff" bg="#002" value={vFPS} />
  <!-- <DebugPanel name="MS" fg="#0f0" bg="#020" value={vMS} /> -->
  <DebugPanel name="MB" fg="#f08" bg="#201" value={vMB} />
</li>
<!-- <li style="display: flex; justify-content: end;">
  <DebugPanel name="MB" fg="#f08" bg="#201" value={vMB} />
  <!-- <DebugPanel name="MS" fg="#0ff" bg="#002"/>
</li> -->
