<script lang="ts">
  import { TeletypeProvider, Teletype, type Action, type TeletypeSystem } from '@deta/teletype/src'

  import { useLogScope } from '@deta/utils/io'
  import { DynamicIcon } from '@deta/icons'
  import { useViewManager } from '@deta/services/views'
  import { useShortcutsManager, ShortcutActions } from '@deta/services/shortcuts'

  const log = useLogScope('TeletypeEntry')
  const viewManager = useViewManager()
  const shortcutsManager = useShortcutsManager<ShortcutActions>()

  let { open = $bindable() }: { open: boolean } = $props()

  let teletype: TeletypeSystem

  const actions = [
    {
      id: 'action1',
      name: 'Action 1',
      icon: 'save',
      handler: () => {
        console.log('Action 1 clicked')
      }
    },
    {
      id: 'action2',
      name: 'Action 2',
      icon: 'reload',
      handler: () => {
        console.log('Action 2 clicked')
      }
    }
  ] satisfies Action[]

  let unregister: any

  $effect(() => {
    if (open) {
      teletype?.open()
      viewManager.changeOverlayState({ teletypeOpen: true })
      unregister = shortcutsManager.registerHandler(ShortcutActions.CLOSE_TELETYPE, () => {
        log.debug('Opening Teletype')

        if (open) {
          open = false
          return true
        }

        return false
      })
    } else {
      teletype?.close()
      viewManager.changeOverlayState({ teletypeOpen: false })
      unregister?.()
    }
  })
</script>

<div class="teletype-wrapper">
  {#if open}
    <TeletypeProvider
      bind:teletype
      {actions}
      class="teletype-provider"
      options={{
        iconComponent: DynamicIcon,
        placeholder: 'Search the web, enter URL or ask a question...'
      }}
    >
      <Teletype />
    </TeletypeProvider>
  {/if}
</div>

<style lang="scss">
</style>
