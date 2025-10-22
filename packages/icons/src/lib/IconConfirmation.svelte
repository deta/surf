<script lang="ts">
  import { icons, type Icons } from './main'

  export let size = '18px'
  export let name: Icons
  export let confirmationIcon: Icons = 'check'
  export let loadingIcon: Icons = 'spinner'
  export let className: string = ''
  export let color: string | undefined = undefined

  /**
   * Delay in milliseconds before the confirmation icon disappears.
   */
  export let delay = 2000

  /**
   * Whether to show the confirmation icon.
   */
  export let show = false

  export let loading = false

  $: style = color ? `color: ${color};` : ''

  /**
   * Show the confirmation icon for a short period of time before reverting back to the original icon.
   */
  export const showConfirmation = () => {
    loading = false
    show = true

    setTimeout(() => {
      show = false
    }, delay)
  }

  /**
   * Show the loading icon.
   */
  export const startLoading = () => {
    loading = true
  }

  /**
   * Stop showing the loading icon.
   */
  export const stopLoading = () => {
    loading = false
  }
</script>

<!--
@component IconConfirmation - A component that displays a confirmation icon for a short period of time before reverting back to the original icon.

To show the confirmation icon, call the `showConfirmation` function on the component:
```svelte
<script lang="ts">
  import { IconConfirmation } from '@deta/icons'
  import { onMount } from 'svelte'

  let icon: IconConfirmation

  const showConfirm = () => icon.showConfirmation()
</script>

<IconConfirmation bind:this={icon} />
```

As an alternative, you can set the `show` prop to `true` to show the confirmation icon:

```svelte
<script lang="ts">
  import { IconConfirmation } from '@deta/icons'

  let showConfirmation = false
</script>

<IconConfirmation show={showConfirmation} />
```

-->
{#if show}
  <svelte:component
    this={icons[confirmationIcon]}
    {size}
    class={className}
    {style}
    width={size}
    height={size}
    {...$$restProps}
  />
{:else if loading}
  <svelte:component
    this={icons[loadingIcon]}
    {size}
    class={className}
    {style}
    width={size}
    height={size}
    {...$$restProps}
  />
{:else}
  <svelte:component
    this={icons[name]}
    {size}
    class={className}
    {style}
    width={size}
    height={size}
    {...$$restProps}
  />
{/if}
