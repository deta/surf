<script lang="ts">
  import { icons, type Icons } from './main'

  export let size = '18px'
  export let name: Icons
  export let color = '#8a8a8a'
</script>

<svelte:component this={icons[name]} {size} {color} {...$$restProps} />
