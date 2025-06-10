<script lang="ts">
  import { useLogScope, wait } from '@horizon/utils'
  import { DragculaDragEvent, HTMLDragZone } from '@horizon/dragcula'
  import { type MentionItem } from '@horizon/editor'

  import {
    PageChatMessageSentEventTrigger,
    PageChatUpdateContextEventTrigger
  } from '@horizon/types'

  import { DragTypeNames, type DragTypes } from '../../types'

  import { type Resource } from '../../service/resources'
  import { useToasts } from '../../service/toast'

  import TextResource, {
    type ChatSubmitOptions
  } from '@horizon/core/src/lib/components/Resources/Previews/Text/TextResource.svelte'
  import type { SmartNote } from '@horizon/core/src/lib/service/ai/note'
  import { onMount } from 'svelte'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import type {
    ContextItemResource,
    ContextItemSpace
  } from '@horizon/core/src/lib/service/ai/context'

  export let note: SmartNote
  export let inputOnly = false

  const log = useLogScope('Chat')
  const toasts = useToasts()
  const config = useConfig()

  const userSettings = config.settings
  const contextManager = note.contextManager
  const ai = note.ai

  let noteComp: TextResource

  $: activeTabContextItem = contextManager.activeTabContextItem
  $: activeTabContextItemItem = $activeTabContextItem?.item

  $: if ($activeTabContextItemItem) {
    log.debug('Active tab context item changed', $activeTabContextItemItem)
    generatePrompts($activeTabContextItemItem)
  } else {
    contextManager.resetPrompts()
  }

  export const updateChatInput = (text: string, focus = true) => {
    noteComp.replaceContent(text)
  }

  export const insertQueryIntoChat = async (query: string, target: 'note' | 'input' = 'note') => {
    if (!noteComp) return

    if (target === 'input') {
      noteComp.setChatInputContent(query, true)
    } else {
      noteComp.insertText(query, true)
    }
  }

  export const addChatWithQuery = async (query: string, replace = false) => {
    const value = '<blockquote>' + query + '</blockquote>' + '<p></p>'

    if (replace) {
      updateChatInput(value, true)
    } else {
      await insertQueryIntoChat(value)
    }
  }

  export const submitCurrentChatMessage = async () => {
    try {
      if (noteComp && typeof noteComp.submitChatMessage === 'function') {
        return await noteComp.submitChatMessage()
      }
      return false
    } catch (e) {
      log.error('Error submitting chat message', e)
      toasts.error('Error submitting chat message')
      return false
    }
  }

  export const createChatCompletion = async (
    query: string,
    mentions?: MentionItem[],
    trigger?: PageChatMessageSentEventTrigger,
    opts?: Partial<ChatSubmitOptions>
  ) => {
    try {
      await noteComp.generateAndInsertAIOutput(query, mentions, trigger, opts)
    } catch (e) {
      log.error('Error creating chat completion', e)
      toasts.error('Error creating chat completion')
    }
  }

  export const submitChatMessage = async (_selected?: 'general' | 'all' | 'active') => {
    await submitCurrentChatMessage()
  }

  const handleDrop = async (drag: DragculaDragEvent<DragTypes>) => {
    if (drag.isNative) {
      log.warn('Not yet implemented!')
    } else if (drag.item!.data.hasData(DragTypeNames.SURF_TAB)) {
      const tabId = drag.item!.data.getData(DragTypeNames.SURF_TAB).id
      contextManager.addTab(tabId, { trigger: PageChatUpdateContextEventTrigger.DragAndDrop })
    } else if (drag.item!.data.hasData(DragTypeNames.SURF_SPACE)) {
      const space = drag.item!.data.getData(DragTypeNames.SURF_SPACE)

      contextManager.addSpace(space, { trigger: PageChatUpdateContextEventTrigger.DragAndDrop })
    } else if (
      drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE) ||
      drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
    ) {
      let resource: Resource | null = null
      if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE)) {
        resource = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE)
      } else if (drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)) {
        const resourceFetcher = drag.item!.data.getData(DragTypeNames.ASYNC_SURF_RESOURCE)
        resource = await resourceFetcher()
      }

      if (resource === null) {
        log.warn('Dropped resource but resource is null! Aborting drop!')
        drag.abort()
        return
      }

      log.debug('dropped resource, adding to context', resource)

      contextManager.addResource(resource, {
        trigger: PageChatUpdateContextEventTrigger.DragAndDrop
      })
    }
  }

  const handleUpdateNoteTitle = async (e: CustomEvent<string>) => {
    const title = e.detail

    await note.updateTitle(title)
  }

  const generatePrompts = async (contextItem: ContextItemResource | ContextItemSpace) => {
    if (!contextItem) {
      log.debug('No active tab context item found, skipping auto prompt generation')
      return
    }

    const showChatSidebar = ai.showChatSidebarValue
    const autoGeneratePrompts = $userSettings.automatic_chat_prompt_generation

    if (!showChatSidebar || !autoGeneratePrompts) {
      log.debug('Skipping auto prompt generation for active tab as it is disabled')
      return
    }

    // give the new item some time to be fully registered
    await wait(200)

    log.debug('Getting prompts for active tab')
    await contextManager.getPrompts()
  }

  onMount(async () => {
    log.debug('Mounting chat', note.id)
    await contextManager.getPrompts(true)
  })
</script>

<div
  class="flex flex-col h-full relative overflow-hidden chat-wrapper"
  id="magic-chat"
  use:HTMLDragZone.action={{
    accepts: (drag) => {
      if (drag.from?.id === 'magic-chat') return false
      if (
        drag.isNative ||
        drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
        drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
        drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE) ||
        drag.item?.data.hasData(DragTypeNames.SURF_SPACE)
      ) {
        return true
      }
      return false
    }
  }}
  on:Drop={handleDrop}
>
  <!-- {#if showAddPromptDialog}
    <div
      id="tool-dialog"
      class="absolute inset-0 z-50 flex items-end justify-start pb-[14rem] pl-8"
      style="background: rgba(0 0 0 / 0.2);"
      transition:fade={{ duration: 133, easing: quartOut }}
    >
      <CreateAiToolDialog
        bind:show={showAddPromptDialog}
        app={appModalContent}
        on:added={() => ($promptSelectorOpen = true)}
      />
    </div>
  {/if} -->

  {#if !inputOnly}
    <div id="chat-responses-{note.id}" class="flex flex-col overflow-auto h-full overflow-x-hidden">
      <TextResource
        bind:this={noteComp}
        resourceId={note.id}
        {note}
        manualContextControl
        autoGenerateTitle
        autofocus={true}
        showTitle={false}
        on:highlightWebviewText
        on:seekToTimestamp
        on:update-title={handleUpdateNoteTitle}
      />
    </div>
  {/if}
</div>

<style lang="scss">
  :global(#magic-chat[data-drag-target]) {
    outline: 2px dashed gray;
    outline-offset: -2px;
  }

  :global(.chat-message-content h2) {
    font-size: 1.4rem;
    margin-top: 1rem !important;
    margin-bottom: 0.5rem !important;
  }
</style>
