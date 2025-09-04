<script lang="ts">
  import { onMount } from 'svelte'
  import { useResourceManager } from '@deta/services/resources'

  let { resourceId }: { resourceId: string } = $props()

  const resourceManager = useResourceManager()

  let name = $state(null)

  onMount(async () => {
    const resource = await resourceManager.getResource(resourceId, { includeAnnotations: false })
    name = resource.metadata.name
  })
</script>

{#if name}
  {name}
{/if}
