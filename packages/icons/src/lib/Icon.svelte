<script lang="ts">
  import { icons, type Icons } from './main'

  export let size = '18px'
  export let name: Icons
  export let className: string = ''
  export let color: string | undefined = undefined

  $: style = color ? `color: ${color};` : ''
</script>

<svelte:component
  this={icons[name]}
  {size}
  class={className}
  {style}
  width={size}
  height={size}
  {...$$restProps}
/>
