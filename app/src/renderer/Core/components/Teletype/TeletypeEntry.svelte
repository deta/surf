<script lang="ts">
  import { TeletypeProvider, Teletype, type TeletypeSystem } from '@deta/teletype/src'
  import { DynamicIcon } from '@deta/icons'
  import { useViewManager } from '@deta/services/views'
  import { useTeletypeService, useMentionService } from '@deta/services'
  import { useTabs } from '@deta/services/tabs'

  const viewManager = useViewManager()
  const teletypeService = useTeletypeService()
  const tabsService = useTabs()
  const mentionsService = useMentionService()

  let { open = $bindable() }: { open: boolean } = $props()
  let teletype: TeletypeSystem

  let actionsArray = $state([])

  // Subscribe to teletype actions
  $effect(() => {
    return teletypeService.actions.subscribe((actions) => {
      actionsArray = actions || []
    })
  })

  const handleTeletypeInput = (event: CustomEvent<string>) => {
    const query = event.detail
    teletypeService.setQuery(query)
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
    <Teletype on:input={handleTeletypeInput} {mentionsService} />
  </TeletypeProvider>
{/if}
