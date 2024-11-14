<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { useLogScope } from '@horizon/utils'
  import ColorIcon from './ColorIcon.svelte'
  import { colorPairs, OasisSpace } from '../../service/oasis'

  const dispatch = createEventDispatcher<{ change: [string, string] }>()
  const log = useLogScope('SpaceIcon')

  export let folder: OasisSpace
  export let interactive = true

  $: spaceData = folder.data
  $: parsedColors = getColors($spaceData?.colors ?? ['#76E0FF', '#4EC9FB'])

  const pickRandomColorPair = (colorPairs: [string, string][]): [string, string] => {
    if (folder.id === 'all') {
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

    parsedColors = newColors

    return newColors
  }

  const getColors = (colors: [string, string] | undefined): [string, string] => {
    if (!colors || colors.filter((c) => c).length < 2) {
      return updateColor(false)
    }

    return colors
  }

  onMount(() => {
    const filtered = $spaceData?.colors?.filter((c) => c)
    if (!filtered) {
      log.debug('No colors provided, picking random color pair')
      updateColor(false)
    }
  })
</script>

<ColorIcon
  colors={parsedColors}
  on:click={() => interactive && updateColor()}
  style={!interactive ? 'pointer-events: none;' : ''}
/>
