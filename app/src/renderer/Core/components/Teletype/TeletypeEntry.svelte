<script lang="ts">
  import { TeletypeProvider, Teletype } from '@deta/teletype'
  import { DynamicIcon } from '@deta/icons'
  import { type TeletypeService, useTeletypeService } from '@deta/services'
  import type { MentionItem } from '@deta/editor'
  import { useLogScope } from '@deta/utils/io'
  import { onMount } from 'svelte'
  import ToolsList from './ToolsList.svelte'
  import { AddToContextMenu, ModelPicker } from '@deta/ui'

  const log = useLogScope('TeletypeEntry')

  let {
    open = $bindable(),
    teletypeService = useTeletypeService(),
    hideNavigation = false
  }: { open: boolean; teletypeService: TeletypeService; hideNavigation: boolean } = $props()
  let teletypeProvider: TeletypeProvider

  let actionsArray = $state([])
  let preferredActionIndex = $state<number | null>(null)

  const handleTeletypeInput = (event: CustomEvent<{ query: string; mentions: MentionItem[] }>) => {
    log.debug('Teletype input received:', event.detail)
    const { query, mentions } = event.detail
    teletypeService.setMentions(mentions)
    teletypeService.setQuery(query)
  }

  const handleAsk = (event: CustomEvent<{ query: string; mentions: MentionItem[] }>) => {
    const { query, mentions } = event.detail
    log.debug('Ask requested:', query, mentions)
    teletypeService.ask({ query, mentions })
  }

  const handleCreateNote = (event: CustomEvent<{ content: string }>) => {
    const { content } = event.detail
    log.debug('Create note requested:', content)
    teletypeService.createNote(content)
  }

  const handleSearchWeb = (event: CustomEvent<{ query: string }>) => {
    const { query } = event.detail
    log.debug('Search web requested:', query)
    teletypeService.navigateToUrlOrSearch(query)
  }

  const handleClear = () => {
    log.debug('Clear requested')
    teletypeService.clear()
  }

  const onFileSelect = async () => {
    log.debug('File select triggered')
    teletypeService.promptForAndInsertFileMentions()
  }

  const onMentionSelect = async () => {
    log.debug('Mention select triggered')
    teletypeService.insertMention(undefined, '@')
  }

  $effect(() => {
    if (open) {
      teletypeProvider?.teletype?.open()
    } else {
      teletypeProvider?.teletype?.close()
    }
  })

  $effect(() => {
    if (teletypeProvider?.teletype && !teletypeService.teletype) {
      // Attach the teletype instance to the service for internal use
      teletypeService.attachTeletype(teletypeProvider.teletype)
    }
  })

  $effect(() => {
    teletypeService.setHideNavigation(hideNavigation)
  })

  onMount(() => {
    const unsubActions = teletypeService.actions.subscribe((actions) => {
      log.debug('Received actions update:', actions)
      actionsArray = actions || []
    })

    const unsubPreferredIndex = teletypeService.preferredActionIndex.subscribe((index) => {
      log.debug('Received preferred action index update:', index)
      preferredActionIndex = index
    })

    return () => {
      unsubActions()
      unsubPreferredIndex()
    }
  })
</script>

{#if open}
  <TeletypeProvider
    bind:this={teletypeProvider}
    actions={actionsArray}
    class="teletype-provider"
    options={{
      iconComponent: DynamicIcon,
      placeholder: 'Ask a question, write a note, enter a URL or search the web…',
      localSearch: false,
      open: true
    }}
  >
    <Teletype
      {preferredActionIndex}
      on:input={handleTeletypeInput}
      on:ask={handleAsk}
      on:create-note={handleCreateNote}
      on:clear={handleClear}
      on:search-web={handleSearchWeb}
      {hideNavigation}
    >
      <svelte:fragment slot="tools">
        <div class="controls-list">
          <AddToContextMenu {onFileSelect} {onMentionSelect} />
          <ToolsList teletype={teletypeService} />
          <ModelPicker />
        </div>
      </svelte:fragment>
    </Teletype>
  </TeletypeProvider>

  <!-- <IntentDebug inputText={currentQuery} /> -->
{/if}

<style lang="scss">
  .controls-list {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
</style>
