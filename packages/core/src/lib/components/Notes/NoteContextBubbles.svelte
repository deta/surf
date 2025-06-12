<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { ContextItemResource, ContextManager } from '../../service/ai/contextManager'
  import { derived, writable, type Writable } from 'svelte/store'
  import { hover, useLogScope } from '@horizon/utils'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import Tooltip from '../Atoms/Tooltip.svelte'
  import AppBarButton from '../Browser/AppBarButton.svelte'
  import { useResourceManager } from '../../service/resources'
  import NotesContextPickerDetails from './Atoms/NotesContextPickerDetails.svelte'
  import { PageChatUpdateContextEventTrigger } from '@horizon/types'
  import NoteContextItemIcon from './NoteContextItemIcon.svelte'
  import { requestUserScreenshot } from '../Core/ScreenPicker.svelte'
  import NoteContextTabPicker from './Atoms/NoteContextTabPicker.svelte'

  export let contextManager: ContextManager
  export let pickerOpen: Writable<boolean> = writable(false)
  export let layout: 'floaty' | 'bottom' = 'floaty'
  export let firstLine: boolean = false
  export let canClosePicker: boolean = true

  const log = useLogScope('NoteContextBubbles')
  const tabsManager = useTabsManager()
  const resourceManager = useResourceManager()

  const tabs = tabsManager.tabs
  const tabsPickerOpen = writable(false)

  // const { status, error } = chat
  const { items: contextItems, tabsInContext } = contextManager

  const visibleContextItems = derived([contextItems], ([$contextItems]) => {
    return $contextItems.filter((item) => item.visibleValue)
  })

  const showContextItems = writable(false)

  const contextPickerTabs = derived([tabs, tabsInContext], ([tabs, tabsInContext]) => {
    return tabs
      .filter((e) => !tabsInContext.find((i) => i.id === e.id))
      .sort((a, b) => b.index - a.index)
  })

  const handleRemoveContextItem = (e: CustomEvent<string>) => {
    const id = e.detail
    log.debug('Removing context item', id)
    contextManager.removeContextItem(id, PageChatUpdateContextEventTrigger.ChatContextItem)
  }

  const handleRetryContextItem = async (e: CustomEvent<string>) => {
    const id = e.detail
    log.debug('Retrying context item', id)
    const contextItem = contextManager.getItem(id)
    if (!contextItem) {
      log.error('Context item not found', id)
      return
    }

    if (contextItem instanceof ContextItemResource) {
      log.debug('re-processing context item tab resource', contextItem.data.id)
      await resourceManager.refreshResourceData(contextItem.data.id)
    } else {
      log.debug(
        `cannot re-process context item since it doesn't have a resource attached`,
        contextItem
      )
    }
  }

  const handleOpenAsTab = async (e: CustomEvent<string>) => {
    const id = e.detail
    const contextItem = contextManager.getItem(id)
    if (!contextItem) {
      log.error('Context item not found', id)
      return
    }

    if (contextItem.data?.dataValue?.resourceBookmark) {
      tabsManager.openResourceAsTab(contextItem.data.dataValue.resourceBookmark, { active: true })
    } else {
      tabsManager.openResourceAsTab(id, { active: true })
    }
  }
</script>

<div
  class="context-bubbles-wrapper {layout}"
  class:active={$pickerOpen}
  class:extra-space={$visibleContextItems.length > 2}
>
  <div
    class:no-items={$visibleContextItems.length === 0}
    class:has-items={$visibleContextItems.length > 0}
  >
    {#if !$pickerOpen || $contextItems.length <= 0}
      {#if $contextItems.length <= 0}
        <Tooltip side="top">
          <AppBarButton
            on:click={async () => {
              const blob = await requestUserScreenshot()
              if (!blob) return

              contextManager.addScreenshot(blob, {
                trigger: PageChatUpdateContextEventTrigger.ChatAddContextMenu
              })
            }}
          >
            <Icon name="camera.plus" size="1rem" />
          </AppBarButton>
          <svelte:fragment slot="content">Add Screenshot</svelte:fragment>
        </Tooltip>

        <Tooltip side="top">
          <NoteContextTabPicker
            tabs={contextPickerTabs}
            excludeActiveTab={false}
            {contextManager}
            pickerOpen={tabsPickerOpen}
            on:close={() => {
              $tabsPickerOpen = false
            }}
            on:rety={handleRetryContextItem}
            on:select={handleOpenAsTab}
            on:remove-item={handleRemoveContextItem}
          />
          <svelte:fragment slot="content">Add Context</svelte:fragment>
        </Tooltip>
      {:else}
        <Tooltip side="top">
          {#if $contextItems.length > 0}
            <button
              disabled={$tabs.filter((e) => !$tabsInContext.includes(e)).length <= 0}
              popovertarget="chat-add-context-tabs"
              class="open-tab-picker disabled:opacity-40 disabled:cursor-not-allowed transform whitespace-nowrap active:scale-95 appearance-none border-0 group margin-0 flex items-center px-1 py-1 transition-colors duration-200 rounded-xl text-sky-1000 dark:text-gray-100 text-sm"
              on:click={(e) => {
                $pickerOpen = !$pickerOpen
              }}
            >
              <div
                class="bubbles"
                class:active={$pickerOpen}
                class:isEmpty={false}
                use:hover={showContextItems}
              >
                {#each $contextItems.slice(0, 3) as item, i}
                  <div
                    class="bubble"
                    class:first={i === 0}
                    style="z-index: {100 - i};--i: {i}; --even: {i % 2 === 0 ? 1 : -1};"
                  >
                    {#if $contextItems.length > 3 && i === 0}
                      {@const count = $contextItems.length - 3}
                      <div class="bubble-count" class:small={count > 9}>
                        +{count}
                      </div>
                    {:else}
                      <div class="bubble-icon" data-type={item.type}>
                        <NoteContextItemIcon {item} />
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </button>
          {:else}
            <AppBarButton class="" on:click={() => ($pickerOpen = !$pickerOpen)}>
              <Icon name="add" size="1rem" />
            </AppBarButton>
          {/if}
          <svelte:fragment slot="content">Modify Context</svelte:fragment>
        </Tooltip>
      {/if}
    {:else}
      <NotesContextPickerDetails
        {contextManager}
        {contextPickerTabs}
        on:close={() => ($pickerOpen = false)}
        {layout}
        {firstLine}
        canClose={canClosePicker}
        on:retry={handleRetryContextItem}
        on:select={handleOpenAsTab}
        on:remove-item={handleRemoveContextItem}
      />
    {/if}
  </div>
</div>

<style lang="scss">
  .context-bubbles-wrapper {
    display: flex;
    align-items: center;
    gap: 1rem;

    &.extra-space {
      margin-right: 0.25rem;
    }

    //&.active::before {
    //  z-index: 100;
    //  content: '';
    //  background: rgba(0, 0, 0, 0.05);
    //  backdrop-filter: blur(0.8px);
    //  position: fixed;
    //  inset: 0;
    //}
  }

  .bubbles {
    isolation: isolate;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    --card-size: 24px;
    width: var(--card-size, 26px);
    height: var(--card-size, 26px);
    margin-bottom: 2px;

    --dist: 1;
    &:hover,
    &.active {
      --dist: 1.5;

      .bubble {
        border: 1px solid light-dark(rgba(0, 0, 0, 0.12), rgba(255, 255, 255, 0.2));
      }

      .bubble-icon {
        opacity: 1;
      }
    }

    .bubble {
      grid-row: 1;
      grid-column: 1;

      display: flex;
      align-items: center;
      justify-content: center;

      background: light-dark(rgb(250, 250, 250), rgb(35, 35, 35));
      border-radius: 0.6rem;
      border: 1px solid light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.175));
      box-shadow: light-dark(rgba(99, 99, 99, 0.03), rgba(156, 156, 156, 0.06)) 0px 2px 4px 0px;

      transition-property: transform, border;
      transition-duration: 187ms;
      transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1);

      &:not(.first) {
        transform: translate(calc(var(--even) * 6px * var(--dist)), calc(-1px + 1px * var(--dist)))
          rotate(calc(var(--even) * var(--i) * 6deg * var(--dist)));
      }
      &.first {
        transform: translate(0px, calc(-1px + -4px * (var(--dist) - 1)));
      }
    }

    .bubble-icon {
      display: flex;
      align-items: center;
      justify-content: center;

      opacity: 0.5;
      transition: opacity 0.2s ease-in-out;
    }

    .bubble-count {
      font-size: 0.9em;
      font-variant-numeric: tabular-nums;
      opacity: 0.75;

      &.small {
        font-size: 0.7em;
      }
    }
  }

  .context-items-details {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
</style>
