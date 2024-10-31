<script lang="ts">
  import { TeletypeProvider, Teletype } from '@deta/teletype/src'
  import { Icon } from '@horizon/icons'
  // import { teletype as teletypeStore } from 'src/utils/store'

  let teletype: any

  /*$: if (teletype) {
    teletypeStore.set(teletype)
  }

  provideStore(api)
  const router = provideRouter([...routes, ...builderRoutes])

  const metadata = provideMetadata(api)
  const { isLoading } = metadata

  const actionContext = { api, metadata, router } as CommonActionContext
  const defaultActions = useDefaultActions(actionContext)

  // when we have the metadata we can refresh the default teletype actions depending on the set flags
  $: if (!$isLoading) {
    teletype.defaultActions = teletype.flattenActions(
      useDefaultActions(actionContext)
    )
    teletype.useActions(useDiscoveryActions(actionContext))
  }*/
</script>

<TeletypeProvider bind:teletype actions={[]} options={{ iconComponent: Icon, showHelper: true }}>
  <Teletype />
</TeletypeProvider>

<style lang="scss" is:global>
  :root {
    --text: #32302f; // 800
    --text-light: #494645; // 700
    --background-dark: #f7f5f2; // 100
    --background-accent: #f0eeea; // 200
    --border-color: #ddd6d088; // 300/40
    --outline-color: #ddd6d027; // 300/20
    --primary: #2a62f1; // default
    --primary-dark: #a48e8e;
    --green: #0ec463; // default
    --red: #f24441; // default
    --orange: #fa870c; // default

    --border-radius: 8px;
  }
  .dark {
    --text: #ddd6d0; // 300
    --text-light: #bcb6b1; // 400
    --background-dark: #191818; // 1000
    --background-accent: #32302f; // 800
    --border-color: #32302f83; // 800/40
    --outline-color: #32302f37; // 800
    --primary: #4d73e0; // default
    --primary-dark: #a48e8e;
    --green: #0ec463; // default
    --red: #f24441; // default
    --orange: #fa870c; // default

    --border-radius: 8px;
  }
</style>
