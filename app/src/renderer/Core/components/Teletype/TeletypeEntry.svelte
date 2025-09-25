<script lang="ts">
  import { TeletypeProvider, Teletype } from '@deta/teletype'
  import { DynamicIcon } from '@deta/icons'
  import { type TeletypeService, useTeletypeService } from '@deta/services'
  import type { MentionItem } from '@deta/editor'
  import { useLogScope } from '@deta/utils/io'
  import { onMount } from 'svelte'
  import ToolsList from './ToolsList.svelte'
  import { AddToContextMenu } from '@deta/ui'

  const log = useLogScope('TeletypeEntry')

  let {
    open = $bindable(),
    teletypeService = useTeletypeService()
  }: { open: boolean; teletypeService: TeletypeService } = $props()
  let teletypeProvider: TeletypeProvider

  let actionsArray = $state([])

  const handleTeletypeInput = (event: CustomEvent<{ query: string; mentions: MentionItem[] }>) => {
    log.debug('Teletype input received:', event.detail)
    const { query, mentions } = event.detail
    teletypeService.setMentions(mentions)
    teletypeService.setQuery(query)
  }

  const handleAsk = (event: CustomEvent<{ query: string; mentions: MentionItem[] }>) => {
    const { query, mentions } = event.detail
    log.debug('Ask requested:', query, mentions)
    teletypeService.ask(query, mentions)
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

  onMount(() => {
    return teletypeService.actions.subscribe((actions) => {
      log.debug('Received actions update:', actions)
      actionsArray = actions || []
      // teletype?.setActions(actionsArray)
    })
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
      on:input={handleTeletypeInput}
      on:ask={handleAsk}
      on:create-note={handleCreateNote}
      on:clear={handleClear}
      on:search-web={handleSearchWeb}
    >
      <svelte:fragment slot="tools">
        <div class="controls-list">
          <AddToContextMenu {onFileSelect} {onMentionSelect} />
          <ToolsList teletype={teletypeService} />
        </div>
      </svelte:fragment>
    </Teletype>
  </TeletypeProvider>
{/if}

<style lang="scss">
  .controls-list {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
</style>
