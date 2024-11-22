<script lang="ts">
  import { useTeletype } from './index'
  import type { Action } from './types'

  export let icon: Action['icon'] | undefined = undefined
  export let name: string | undefined = typeof icon === 'string' && icon
  export let component: Action['icon'] = typeof icon !== 'string' && icon !== undefined && icon

  const teletype = useTeletype()
  const iconComponent = teletype.iconComponent
</script>

<div class="icon">
  {#if component}
    <svelte:component this={component} />
  {:else if name && iconComponent}
    <svelte:component this={iconComponent} {name} />
  {/if}
</div>
