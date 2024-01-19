<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { Writable } from "svelte/store";

  export let name: string;
  export let fg: string;
  export let bg: string;
  export let value: Writable<{ value: number; maxValue: number }>;

  let canvasEl: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;

  let min = Infinity,
    max = 0,
    round = Math.round;
  let PR: number;

  let WIDTH: number;
  let HEIGHT: number;
  let TEXT_X: number;
  let TEXT_Y: number;
  let GRAPH_X: number;
  let GRAPH_Y: number;
  let GRAPH_WIDTH: number;
  let GRAPH_HEIGHT: number;

  function update(value: number, maxValue: number) {
    min = Math.min(min, value);
    max = Math.max(max, value);

    context.fillStyle = bg;
    context.globalAlpha = 1;
    context.fillRect(0, 0, WIDTH, GRAPH_Y);
    context.fillStyle = fg;
    context.fillText(
      round(value) + " " + name + " (" + round(min) + "-" + round(max) + ")",
      TEXT_X,
      TEXT_Y
    );

    context.drawImage(
      canvasEl,
      GRAPH_X + PR,
      GRAPH_Y,
      GRAPH_WIDTH - PR,
      GRAPH_HEIGHT,
      GRAPH_X,
      GRAPH_Y,
      GRAPH_WIDTH - PR,
      GRAPH_HEIGHT
    );

    context.fillRect(GRAPH_X + GRAPH_WIDTH - PR, GRAPH_Y, PR, GRAPH_HEIGHT);

    context.fillStyle = bg;
    context.globalAlpha = 0.9;
    context.fillRect(
      GRAPH_X + GRAPH_WIDTH - PR,
      GRAPH_Y,
      PR,
      round((1 - value / maxValue) * GRAPH_HEIGHT)
    );
  }
  onDestroy(value.subscribe((v) => {
    if (canvasEl) update(v.value, v.maxValue)
  }));

  onMount(() => {
    PR = round(window.devicePixelRatio || 1);
    WIDTH = 80 * PR;
    HEIGHT = 48 * PR;
    TEXT_X = 3 * PR;
    TEXT_Y = 2 * PR;
    GRAPH_X = 3 * PR;
    GRAPH_Y = 15 * PR;
    GRAPH_WIDTH = 74 * PR;
    GRAPH_HEIGHT = 30 * PR;

    canvasEl.width = WIDTH;
    canvasEl.height = HEIGHT;
    canvasEl.style.cssText = "width:80px;height:48px";
    context = canvasEl.getContext("2d")!;
    context.font = "bold " + 9 * PR + "px Helvetica,Arial,sans-serif";
    context.textBaseline = "top";

    context.fillStyle = bg;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.fillStyle = fg;
    context.fillText(name, TEXT_X, TEXT_Y);
    context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);

    context.fillStyle = bg;
    context.globalAlpha = 0.9;
    context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);

    // setInterval(() => {
    //   update(Math.random(), 1);
    // }, 100)
  });
</script>

<canvas bind:this={canvasEl}/>
