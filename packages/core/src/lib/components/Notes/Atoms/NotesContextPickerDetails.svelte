<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { ContextManager } from '../../../service/ai/contextManager'
  import AppBarButton from '../../Browser/AppBarButton.svelte'
  import ContextBubbles from '../../Chat/ContextBubbles.svelte'
  import Tooltip from '../../Atoms/Tooltip.svelte'
  import { writable, type Readable } from 'svelte/store'
  import { useTabsManager } from '../../../service/tabs'
  import { createEventDispatcher } from 'svelte'
  import NoteContextTabPicker from './NoteContextTabPicker.svelte'
  import { requestUserScreenshot } from '../../Core/ScreenPicker.svelte'
  import { PageChatUpdateContextEventTrigger } from '@horizon/types'
  import { type Tab } from '@horizon/core/src/lib/types'

  export let contextManager = ContextManager
  export let layout: 'floaty' | 'bottom' = 'floaty'
  export let firstLine: boolean = false
  export let canClose: boolean = true
  export let contextPickerTabs: Readable<Tab[]>

  const dispatch = createEventDispatcher<{
    close: void
    'retry-processing': string
    'open-as-tab': string
    'remove-from-ctx': string
  }>()

  const tabsManager = useTabsManager()
  const tabs = tabsManager.tabs
  const tabsInContext = contextManager.tabsInContext

  const pickerOpen = writable(false)
</script>

<div class="context-picker {layout} mb-2.5" class:firstLine>
  <ContextBubbles {contextManager} {layout} on:retry on:select on:remove-item />

  <div class="flex gap-1" style={layout === 'floaty' ? 'align-items: start;' : 'align-items: end;'}>
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
        {pickerOpen}
        on:close={() => {
          $pickerOpen = false
        }}
        on:rety
        on:select
        on:remove
      />
      <svelte:fragment slot="content">Add Context</svelte:fragment>
    </Tooltip>

    {#if canClose}
      <Tooltip side="top">
        <AppBarButton
          on:click={() => {
            dispatch('close')
          }}
        >
          <Icon name="close" size="1rem" />
        </AppBarButton>
        <svelte:fragment slot="content">Close</svelte:fragment>
      </Tooltip>
    {/if}
  </div>
</div>

<style lang="scss">
  .context-picker {
    width: 100%;

    display: flex;
    gap: 2rem;
    justify-content: space-between;

    position: absolute;

    padding-right: 0.3rem;

    &.floaty {
      top: 3.25rem;
      &.firstLine {
        top: -0rem;
      }
      left: calc(anchor(--editor-last-line start) - 0.6rem);
      left: 0;
      right: calc(anchor(--editor-last-line end) - 0.6rem);
      left: 0;
    }
    &.bottom {
      bottom: 0rem;
      //left: calc(anchor(--editor-last-line start) - 0.6rem);
      //right: calc(anchor(--editor-last-line end) - 0.6rem);
      left: 0;
      right: 0;
    }

    :global(.bubble-wrapper) {
      margin-right: -0.75rem;
    }
  }
</style>
