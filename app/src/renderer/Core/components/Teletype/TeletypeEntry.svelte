<script lang="ts">
  import { TeletypeProvider, Teletype, type TeletypeSystem } from '@deta/teletype'
  import { DynamicIcon } from '@deta/icons'
  import { useTeletypeService } from '@deta/services'
  import type { MentionItem } from '@deta/editor'
  import { useLogScope } from '@deta/utils/io'

  const teletypeService = useTeletypeService()
  const log = useLogScope('TeletypeEntry')

  let { open = $bindable() }: { open: boolean } = $props()
  let teletype: TeletypeSystem

  let actionsArray = $state([])

  // Subscribe to teletype actions
  $effect(() => {
    return teletypeService.actions.subscribe((actions) => {
      actionsArray = actions || []
    })
  })

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

  const handleClear = () => {
    log.debug('Clear requested')
    teletypeService.clear()
  }

  $effect(() => {
    if (open) {
      teletype?.open()
    } else {
      teletype?.close()
    }
  })
</script>

{#if open}
  <TeletypeProvider
    bind:teletype
    actions={actionsArray}
    class="teletype-provider"
    options={{
      iconComponent: DynamicIcon,
      placeholder: 'Search the web, enter URL or ask a question...',
      localSearch: false,
      open: true
    }}
  >
    <Teletype
      on:input={handleTeletypeInput}
      on:ask={handleAsk}
      on:create-note={handleCreateNote}
      on:clear={handleClear}
    />
  </TeletypeProvider>
{/if}
