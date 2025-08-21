<script lang="ts" context="module">
  export type SpaceIconChange = {
    colors?: [string, string]
    emoji?: string
    imageIcon?: string
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { writable } from 'svelte/store'

  import { useLogScope } from '@deta/utils/io'
  import { colorPairs, type OasisSpace } from '@horizon/core/src/lib/service/oasis'

  import CustomPopover from '../Atoms/CustomPopover.svelte'
  import { blobToSmallImageUrl } from '../../utils/screenshot'
  import { useToasts, EmojiPicker } from '@deta/ui'
  import type { SpaceData } from '@horizon/core/src/lib/types'

  export let space: OasisSpace
  export let open = writable(false)
  export let disabled = false
  export let isCreating = false
  export let disableTransition: boolean | undefined = undefined

  const log = useLogScope('IconSelector')
  const toasts = useToasts()
  const dispatch = createEventDispatcher<{ update: SpaceIconChange }>()

  let dataChanges: Partial<SpaceData> = {}

  const selectedTab = writable<'color' | 'emoji' | 'image'>('emoji')

  const pickRandomColorPair = (colorPairs: [string, string][]): [string, string] => {
    if (space.id === 'all') {
      return colorPairs[0]
    }

    return colorPairs[Math.floor(Math.random() * colorPairs.length)]
  }

  const updateData = async (updates: Partial<SpaceData>, persist = false) => {
    log.debug('Updating space data', updates)
    dataChanges = { ...dataChanges, ...updates }

    dispatch('update', updates)

    if (persist) {
      await space.updateData(updates)
    } else {
      log.debug('Skipping space data persisting')
      space.data.update((data) => {
        Object.assign(data, updates)
        return data
      })
    }
  }

  const updateColor = () => {
    const colors = pickRandomColorPair(colorPairs)

    log.debug('Updating colors', colors)
    updateData({ colors, emoji: undefined, imageIcon: undefined }, !open)

    return colors
  }

  const handleSelectEmoji = async (e: CustomEvent<string>) => {
    const emoji = e.detail

    log.debug('Updating emoji', emoji)
    await updateData({ emoji, imageIcon: undefined }, !open)
  }

  const handleFileUpload = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]

    if (!file) {
      return
    }

    const blob = new Blob([file], { type: file.type })
    const dataUrl = await blobToSmallImageUrl(blob, 128)
    if (!dataUrl) {
      log.error('Failed to convert image to data URL')
      return
    }

    log.debug('Updating image icon', dataUrl)
    await updateData({ emoji: undefined, imageIcon: dataUrl }, true) // for now, always persist image changes

    open.set(false)

    toasts.success('Context icon updated!')
  }

  onMount(() => {
    let initial = true
    return open.subscribe((isOpen) => {
      log.debug('Popover opened', isOpen, initial)
      if (!isOpen && !initial) {
        updateData(dataChanges, true)
      }

      if (isOpen && initial) {
        initial = false
      }
    })
  })
</script>

<CustomPopover
  position="top"
  openDelay={200}
  sideOffset={10}
  popoverOpened={open}
  {disableTransition}
  forceOpen={true}
  portal="body"
  triggerClassName="w-full h-full"
  disableHover
  {disabled}
>
  <div slot="trigger" class="w-full h-full">
    <slot></slot>
  </div>

  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div slot="content" class="content-wrapper no-drag data-vaul-no-drag" data-ignore-click-outside>
    <div class="header">
      <div class="tabs">
        <div class="tab" class:active={$selectedTab === 'emoji'}>
          <button on:click={() => selectedTab.set('emoji')}> Emoji </button>
        </div>

        <div class="tab" class:active={$selectedTab === 'image'}>
          <button on:click={() => selectedTab.set('image')}> Image </button>
        </div>
      </div>

      <button class="color-picker-action" on:click={() => updateColor()}>Random Color</button>
    </div>

    <div class="content">
      {#if $selectedTab === 'emoji'}
        <div class="emoji-wrapper">
          <!-- <button use:emojiPicker={handleSelectEmoji}>Pick Emoji</button> -->
          <EmojiPicker on:select={handleSelectEmoji} />
        </div>
      {:else if $selectedTab === 'image'}
        <div class="image-picker">
          <input
            id="image-space-icon-picker"
            type="file"
            accept="image/*"
            on:change={handleFileUpload}
          />

          <button on:click={() => document.getElementById('image-space-icon-picker')?.click()}
            >Upload Image</button
          >
          <p class="info-text">
            {#if isCreating}
              After the space is created right click any image saved and select "Use as Context
              Icon" to change it
            {:else}
              Tip: you can also right click any image saved in the space and select "Use as Context
              Icon"
            {/if}
          </p>
        </div>
      {/if}
    </div>
  </div>
</CustomPopover>

<style lang="scss">
  .content-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background-color: white;
    position: relative;
    width: 320px;

    padding: 0.5rem 0;
    z-index: 10;
    pointer-events: auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgb(229, 231, 235);
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0rem 0.75rem;
  }

  .tab {
    border-bottom: 2px solid transparent;
    padding-bottom: 0.25rem;

    button {
      padding: 0.25rem 0.5rem;
      font-size: 1rem;
      opacity: 0.65;

      border-radius: 8px;
      transition:
        opacity 0.2s,
        background 0.2s;

      &:hover {
        opacity: 1;
        background: rgb(235, 236, 238);
      }
    }

    &.active {
      border-bottom-color: rgb(71, 130, 212);

      button {
        opacity: 1;
      }
    }
  }

  .color-picker-action {
    padding: 0.25rem 0.5rem;
    margin: 0.75rem;
    margin-right: 0.75rem;

    border-radius: 8px;
    opacity: 0.65;
    transition:
      opacity 0.2s,
      background 0.2s;

    &:hover {
      opacity: 1;
      background: rgb(235, 236, 238);
    }
  }

  .content {
    padding: 0rem 0.75rem;
  }

  .emoji-wrapper {
    margin-top: -0.5rem;
  }

  .image-picker {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1rem 0.25rem;

    input {
      display: none;
    }

    button {
      padding: 0.5rem 1rem;
      background-color: rgb(59 130 246);
      color: white;
      border-radius: 8px;
    }

    p {
      opacity: 0.65;
    }
  }

  .info-text {
    font-size: 0.85rem;
    text-align: center;
  }

  :global(body.dark) {
    .content-wrapper {
      background-color: rgb(26, 32, 44);
    }

    .header {
      border-bottom-color: rgb(26, 32, 44);
    }

    .tab {
      button {
        background: rgb(26, 32, 44);
      }

      &.active {
        border-bottom-color: rgb(71, 130, 212);
      }
    }

    .color-picker-action {
      background: rgb(26, 32, 44);
    }

    .content {
      background-color: rgb(26, 32, 44);
    }

    .emoji-wrapper {
      background-color: rgb(26, 32, 44);
    }

    .image-picker {
      background-color: rgb(26, 32, 44);
    }
  }
</style>
