<script lang="ts">
  import { useTeletype } from './index'
  import type { Action } from './types'

  let {
    icon = undefined
  }: {
    icon?: Action['icon'] | undefined
  } = $props()

  const name = $derived(typeof icon === 'string' && icon)
  const component = $derived(typeof icon !== 'string' && icon !== undefined && icon)

  const teletype = useTeletype()
  const iconComponent = teletype.iconComponent
</script>

{#if component}
  <svelte:component this={component} />
{:else if name && iconComponent}
  <svelte:component this={iconComponent} {name} />
{/if}
