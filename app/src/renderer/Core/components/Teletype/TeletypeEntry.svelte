<script lang="ts">
  import { TeletypeProvider, Teletype, type TeletypeSystem } from '@deta/teletype'
  import { DynamicIcon } from '@deta/icons'
  import { useTeletypeService } from '@deta/services'
  import type { MentionItem } from '@deta/editor'

  const teletypeService = useTeletypeService()

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
    console.log('Teletype input received:', event.detail)
    const { query, mentions } = event.detail
    teletypeService.setMentions(mentions)
    teletypeService.setQuery(query)
  }

  const handleAsk = (event: CustomEvent<{ query: string; mentions: MentionItem[] }>) => {
    const { query, mentions } = event.detail
    teletypeService.ask(query, mentions)
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
    <Teletype on:input={handleTeletypeInput} on:ask={handleAsk} />
  </TeletypeProvider>
{/if}
