<script lang="ts">
  import { TeletypeProvider, Teletype, type Action } from '@/components/Teletype'

  const defaultActions: Action[] = []
</script>

<TeletypeProvider actions={defaultActions} options={{ nestedSearch: true }}>
  <Teletype />
</TeletypeProvider>
