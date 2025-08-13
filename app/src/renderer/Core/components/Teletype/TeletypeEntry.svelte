<script lang="ts">
  import { TeletypeProvider, Teletype, type Action, type TeletypeSystem } from '@deta/teletype/src'

  import { DynamicIcon } from '@deta/icons'
  import { useViewManager } from '@deta/services'

  const viewManager = useViewManager()

  let { open = $bindable() } = $props()

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

  $effect(() => {
    if (open) {
      teletype?.open()
      viewManager.changeOverlayState({ teletypeOpen: true })
    } else {
      teletype?.close()
      viewManager.changeOverlayState({ teletypeOpen: false })
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
