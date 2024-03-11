<script lang="ts">
  import { derived, get, type Writable } from 'svelte/store'
  import type { Card } from '../../types'
  import { clamp, map } from '@horizon/tela'

  export let cards: Writable<Writable<Card>[]>
  export let viewOffset: Writable<{ x: number; y: number }>
  export let viewPort: Writable<{ w: number; h: number }>

  let wrapperWidth: number

  // PERF: Well. we shouldnt reduce twice :')
  $: maxX = $cards
    ? $cards.length <= 0
      ? $viewPort.w
      : get($cards.reduce((p, c) => (p && get(p).x > get(c).x ? p : c))).x +
        get($cards.reduce((p, c) => (p && get(p).x > get(c).x ? p : c))).width
    : 0

  $: left = `${clamp(map(0, maxX, 0, wrapperWidth, $viewOffset?.x), 0, wrapperWidth - 10)}px`
  $: width = `${($viewPort.w * 100) / maxX}%`
</script>

<div class="minimap" bind:clientWidth={wrapperWidth}>
  <div class="progress" style="--left: {left}; --width: {width};"></div>
</div>

<style lang="scss">
  .minimap {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 50px;
    overflow: hidden;
    height: 8px;
    width: 35ch;
    position: fixed;
    z-index: 9999;
    top: -5px;
    left: 50%;
    transform: translateX(-50%);

    .progress {
      position: absolute;
      background: rgba(0, 0, 0, 0.4);
      left: var(--left);
      width: var(--width);
      height: 100%;
    }
  }
</style>
