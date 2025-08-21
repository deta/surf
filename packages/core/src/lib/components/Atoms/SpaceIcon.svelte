<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { useLogScope } from '@deta/utils/io'
  import { Icon, DynamicIcon } from '@deta/icons'
  import IconSelector from '../Oasis/IconSelector.svelte'
  import { OasisSpace, pickRandomColorPair } from '../../service/oasis'

  const dispatch = createEventDispatcher<{ change: [string, string] }>()
  const log = useLogScope('SpaceIcon')

  export let folder: OasisSpace | undefined = undefined
  export let interactive = true
  export let round = false
  export let size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'md'
  export let isCreating = false
  export let disablePopoverTransition: boolean | undefined = undefined

  $: spaceData = folder?.data
  $: parsedColors = getColors($spaceData?.colors ?? ['#76E0FF', '#4EC9FB'])

  $: colorIconSize =
    size === 'sm'
      ? '1.1em'
      : size === 'lg'
        ? '1.3em'
        : size === 'xl'
          ? '2.25rem'
          : size === '2xl'
            ? '6rem'
            : '1.2em'

  let pickedEmoji: string | null = null

  const updateColor = (userAction = true) => {
    const newColors = pickRandomColorPair()

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

{#if folder && $spaceData && interactive}
  <IconSelector
    space={folder}
    disabled={!interactive}
    disableTransition={disablePopoverTransition}
    {isCreating}
    on:update
  >
    <div class="list space-icon">
      {#if pickedEmoji || ($spaceData && $spaceData.emoji)}
        <span class="emoji" data-size={size}>{pickedEmoji || $spaceData.emoji}</span>
      {:else if $spaceData && $spaceData.icon}
        <Icon name={$spaceData.icon} {size} />
      {:else if $spaceData && $spaceData.imageIcon}
        <img src={$spaceData.imageIcon} alt="Space icon" class="image" class:round />
      {:else}
        <DynamicIcon
          name="colors;;{parsedColors}"
          style="pointer-events: none;"
          size={colorIconSize}
        />
      {/if}
    </div>
  </IconSelector>
{:else}
  <div class="list space-icon">
    {#if pickedEmoji || ($spaceData && $spaceData.emoji)}
      <span class="emoji" data-size={size}>{pickedEmoji || $spaceData?.emoji}</span>
    {:else if $spaceData && $spaceData.icon}
      <Icon name={$spaceData.icon} {size} />
    {:else if $spaceData && $spaceData.imageIcon}
      <img src={$spaceData.imageIcon} alt="Space icon" class="image" class:round />
    {:else}
      <DynamicIcon
        name="colors;;{parsedColors}"
        style="pointer-events: none;"
        size={colorIconSize}
      />
    {/if}
  </div>
{/if}

<style lang="scss">
  .list {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    aspect-ratio: 1 / 1;
  }

  .emoji {
    font-size: 1.25rem /* 20px */;
    line-height: 1;

    &[data-size='sm'] {
      font-size: 1.1rem /* 18px */;
    }

    &[data-size='lg'] {
      font-size: 1.5rem /* 24px */;
    }

    &[data-size='xl'] {
      font-size: 2.25rem /* 40px */;
    }

    &[data-size='2xl'] {
      font-size: 6rem /* 64px */;
    }
  }

  .image {
    width: 100%;
    height: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 5px;
    object-fit: cover;
  }

  .round {
    border-radius: 50%;
  }
</style>
