<script lang="ts">
  import type { ResourceObject } from '@horizon/core/src/lib/service/resources'

  import ResourcePreview from '@horizon/core/src/lib/components/Resources/ResourcePreview.svelte'

  export let nearbyResults: any[]
</script>

<div>
  Results right next to this: {nearbyResults.length}
  {#each nearbyResults as result}
    <ResourcePreview resource={result.resource} />
  {/each}
</div>
