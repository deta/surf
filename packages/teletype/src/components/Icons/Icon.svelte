<script lang="ts">
  import { components } from './'

  export let name
  export let color = 'currentColor'
  export let size = '20px'
</script>

<div style:width={size} style:height={size} style:color>
  <svelte:component this={components[name]} />
</div>
