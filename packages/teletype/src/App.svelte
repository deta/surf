<script lang="ts">
  import { Router, Route, navigate } from 'svelte-navigator'

  import Index from '@/pages/index.svelte'

  import { TeletypeProvider, Teletype, Action } from '@/components/Teletype'
  import { Icons } from '@/components/Icons'

  const defaultActions: Action[] = []
</script>

<Router>
  <TeletypeProvider actions={defaultActions} options={{ nestedSearch: true }}>
    <Teletype />
    <Route path="/" component={Index} />
  </TeletypeProvider>
</Router>
