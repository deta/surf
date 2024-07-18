<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import type { Space } from '../../types'
  import { useLogScope } from '../../utils/log'

  const dispatch = createEventDispatcher<{ change: [string, string] }>()
  const log = useLogScope('SpaceIcon')

  const colorPairs: [string, string][] = [
    ['#76E0FF', '#4EC9FB'],
    ['#76FFB4', '#4FFBA0'],
    ['#7FFF76', '#4FFA4C'],
    ['#D8FF76', '#BAFB4E'],
    ['#FFF776', '#FBE24E'],
    ['#FFE076', '#FBC94E'],
    ['#FFBA76', '#FB8E4E'],
    ['#FF7676', '#FB4E4E'],
    ['#FF76BA', '#FB4EC9'],
    ['#D876FF', '#BA4EFB'],
    ['#7676FF', '#4E4EFB'],
    ['#76B4FF', '#4EA0FB'],
    ['#76FFE0', '#4EFBC9'],
    ['#76FFD8', '#4EFBBF'],
    ['#76FFF7', '#4EFBE2'],
    ['#76FFB4', '#4FFBA0'],
    ['#76FF76', '#4FFB4E'],
    ['#A4FF76', '#8EFB4E'],
    ['#FFF776', '#FBE24E'],
    ['#FFE076', '#FBC94E']
  ]

  export let folder: Space

  $: parsedColors = getColors(folder.name.colors)

  const pickRandomColorPair = (colorPairs: [string, string][]): [string, string] => {
    if (folder?.id === 'all') {
      return colorPairs[0]
    }
    return colorPairs[Math.floor(Math.random() * colorPairs.length)]
  }

  const updateColor = (userAction = true) => {
    const newColors = pickRandomColorPair(colorPairs)

    // if the action was not triggered by the user, wait 500ms before dispatching the change to make sure the event listeners are ready
    if (userAction) {
      dispatch('change', newColors)
    } else {
      setTimeout(() => {
        dispatch('change', newColors)
      }, 500)
    }

    return newColors
  }

  const getColors = (colors: [string, string] | undefined): [string, string] => {
    if (!colors || colors.filter((c) => c).length < 2) {
      return updateColor(false)
    }

    return colors
  }

  onMount(() => {
    const filtered = folder.name.colors?.filter((c) => c)
    if (!filtered) {
      log.debug('No colors provided, picking random color pair')
      updateColor(false)
    }
  })
</script>

<div
  class="folder-icon"
  on:click={() => updateColor()}
  style="--color1: {parsedColors ? parsedColors[0] : 'red'}; --color2: {parsedColors
    ? parsedColors[1]
    : 'blue'}"
  aria-hidden="true"
></div>

<style lang="scss">
  .folder-icon {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: radial-gradient(
        95% 95% at 50% 10%,
        rgba(255, 255, 255, 0.5) 0%,
        rgba(0, 0, 0, 0.5) 100%
      ),
      linear-gradient(180deg, var(--color1) 0%, var(--color2) 100%);
    background: radial-gradient(
        97.6% 97.6% at 50% 10.9%,
        color(display-p3 1 1 1 / 0.5) 0%,
        color(display-p3 0 0 0 / 0.5) 100%
      ),
      linear-gradient(180deg, var(--color1) 0%, var(--color2) 100%);
    background-blend-mode: soft-light, normal;
    box-shadow:
      0px -0.3px 0.6px 0px rgba(0, 0, 0, 0.15),
      0px -1.25px 1.8px 0px rgba(0, 0, 0, 0.05) inset,
      0px 0.9px 0.6px 0px rgba(255, 255, 255, 0.3) inset,
      0px -1.5px 2px 0px rgba(255, 255, 255, 0.09) inset,
      0px -1.5px 4px 0px rgba(0, 0, 0, 0.15) inset;
    box-shadow:
      0px -0.3px 0.6px 0px color(display-p3 0 0 0 / 0.15),
      0px -1.25px 1.8px 0px color(display-p3 0 0 0 / 0.05) inset,
      0px 0.9px 0.6px 0px color(display-p3 1 1 1 / 0.3) inset,
      0px -1.5px 2px 0px color(display-p3 0 0 0/ 0.09) inset,
      0px -1.5px 4px 0px color(display-p3 0 0 0 / 0.15) inset;
  }
</style>
