<script lang="ts">
  import { writable, type Writable } from 'svelte/store'
  import { useAI } from '../../service/ai/ai'
  import CustomPopover from '../Atoms/CustomPopover.svelte'
  import EmojiPicker from '../Atoms/EmojiPicker.svelte'
  import { DynamicIcon, Icon } from '@horizon/icons'
  import { quartOut } from 'svelte/easing'
  import { fly } from 'svelte/transition'
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import type { App } from '@horizon/backend/types'
  import { Editor } from '@horizon/editor'
  import { wait } from '@horizon/utils'

  export let el: HTMLElement | undefined
  export let show = false
  export let app: Writable<App | null>

  const ai = useAI()
  const dispatch = createEventDispatcher<{ added: void }>()

  let nameEl: HTMLElement
  let toolName = $app?.name ?? ''
  let toolPrompt = $app?.content ?? ''

  const toolIcon = writable<string | null>($app?.icon ?? null)
  let saveToolComplete = false

  const iconPickerOpen = writable(false)
  const selectedIconTab = writable('emoji')

  function handleKeydownModal(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      show = false
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      saveToolWithName()
    }
  }

  async function saveToolWithName() {
    if ($app !== null) {
      await ai.deleteCustomAiApp($app.id)
      await ai.storeCustomAiApp({
        name: toolName,
        prompt: toolPrompt,
        icon: $toolIcon ?? undefined
      })
      app.set(null)
    } else {
      await ai.storeCustomAiApp({
        name: toolName,
        prompt: toolPrompt,
        icon: $toolIcon ?? undefined
      })
    }

    saveToolComplete = true
    show = false
    dispatch('added')
  }

  function handleSelectEmoji(e: CustomEvent<string>) {
    const emoji = e.detail
    $toolIcon = `emoji;;${emoji}`
    $iconPickerOpen = false
  }

  function handleFileUpload() {}

  onMount(async () => {
    nameEl?.focus()
    await wait(200)
    nameEl?.focus()
  })
</script>

<div
  bind:this={el}
  class=" p-4 max-w-md w-[45ch] bg-neutral-50 dark:bg-gray-800 border border-blue-300 dark:border-gray-700 rounded-xl shadow-md"
  in:fly={{ y: 10, duration: 123, delay: 0, easing: quartOut }}
  out:fly={{ y: 10, duration: 123, delay: 0, easing: quartOut }}
>
  <div class="flex gap-6 items-start">
    <div class="shrink-1 w-min">
      <CustomPopover
        position="top"
        openDelay={200}
        sideOffset={10}
        popoverOpened={iconPickerOpen}
        disableTransition={false}
        forceOpen={true}
        portal="body"
        triggerClassName="w-full h-full"
        disableHover
        disabled={false}
      >
        <div slot="trigger" class="h-full w-fit shrink-1">
          <div
            class="flex items-center justify-center w-[3em] h-[3em] rounded-full bg-neutral-100 border border-neutral-200"
          >
            {#if $toolIcon}
              <DynamicIcon name={$toolIcon} size="2.05em" />
            {:else}
              <Icon name="face" />
            {/if}
          </div>
        </div>

        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div
          slot="content"
          class="content-wrapper no-drag data-vaul-no-drag"
          data-ignore-click-outside
        >
          <!--<div class="header">
            <div class="tabs">
              <div class="tab" class:active={$selectedIconTab === 'emoji'}>
                <button on:click={() => selectedIconTab.set('emoji')}> Emoji </button>
              </div>

              <div class="tab" class:active={$selectedIconTab === 'image'}>
                <button on:click={() => selectedIconTab.set('image')}> Image </button>
              </div>
            </div>

            <button class="color-picker-action" on:click={() => updateColor()}>Random Color</button>
          </div>-->

          <div class="content">
            {#if $selectedIconTab === 'emoji'}
              <div class="emoji-wrapper">
                <!-- <button use:emojiPicker={handleSelectEmoji}>Pick Emoji</button> -->
                <EmojiPicker on:select={handleSelectEmoji} />
              </div>
            {:else if $selectedIconTab === 'image'}
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
                  {#if true}
                    After the space is created right click any image saved and select "Use as
                    Context Icon" to change it
                  {:else}
                    Tip: you can also right click any image saved in the space and select "Use as
                    Context Icon"
                  {/if}
                </p>
              </div>
            {/if}
          </div>
        </div>
      </CustomPopover>
    </div>

    <div class="grow-1 flex w-full flex-col gap-2">
      <input
        bind:this={nameEl}
        type="text"
        bind:value={toolName}
        on:keydown={handleKeydownModal}
        disabled={saveToolComplete}
        class="input"
        placeholder="Name"
      />

      <div class="prompt-input" style="min-height:5ch;max-height:35vh; overflow-y: auto;">
        <Editor bind:content={toolPrompt} autofocus={false} placeholder="Your prompt" />
      </div>
    </div>
  </div>
  {#if saveToolComplete}
    <p class="mt-2 text-sm text-green-600">Saved!</p>
  {/if}
  <div class="mt-6 flex justify-end gap-3">
    <button
      class="transform whitespace-nowrap active:scale-95 disabled:opacity-30 appearance-none border-0 group margin-0 flex items-center px-3 py-2 bg-neutral-200/80 dark:bg-gray-700 hover:bg-neutral-300 dark:hover:bg-gray-600 transition-colors duration-200 rounded-lg text-sky-1000 dark:text-gray-100 text-sm font-medium"
      on:click={() => {
        show = false
        saveToolComplete = false
        toolName = ''
      }}
    >
      Cancel
    </button>
    <button
      class="transform whitespace-nowrap active:scale-95 disabled:opacity-40 appearance-none border-0 group margin-0 flex items-center px-3 py-2 bg-sky-300 dark:bg-sky-700 hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors duration-200 rounded-lg text-sky-1000 dark:text-gray-100 text-sm font-medium"
      on:click={saveToolWithName}
      hidden={saveToolComplete}
      disabled={!toolName}
    >
      Save
    </button>
  </div>
</div>

<style lang="scss">
  .input {
    @apply block w-full   border-gray-300 py-1  shadow-sm focus:border-blue-500;

    font-size: 1.2em;
    font-weight: 500;
    background: transparent;
    color: light-dark(#222, #fff);

    &:focus,
    &:focus-within,
    &:active {
      outline: none;
      border-color: #787878 !important;
    }
  }
</style>
