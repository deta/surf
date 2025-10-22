<script lang="ts">
  import DynamicIcon from './DynamicIcon.svelte'
  import { icons, type Icons } from './main'

  /**
   * The name of the icon to display. The `name` prop must be one of the keys from the `Icons` enum in the `@deta/icons` package.
   */
  export let name: Icons

  /**
   * The size of the icon. The `size` prop must be a valid CSS size value.
   */
  export let size: string | number = '18px'

  /**
   * Additional classes to add to the icon.
   */
  export let className: string = ''

  /**
   * The color of the icon. The `color` prop must be a valid CSS color value.
   */
  export let color: string | undefined = undefined

  /**
   * Dynamic icon data
   */
  export let data: string | undefined = undefined

  $: style = color ? `color: ${color};` : ''
</script>

<!--
@component Icon - A component that displays an icon from the `@deta/icons` package.

To use the `Icon` component, import it from the `@deta/icons` package and pass the `name` prop to specify the icon to display:

```svelte
<script lang="ts">
  import { Icon } from '@deta/icons'
</script>

<Icon name="check" />
```

You can also customize the size and color of the icon by passing the `size` and `color` props:

```svelte
<Icon name="check" size="24px" color="green" />
```
-->

{#if name === 'dynamic' && data}
  <DynamicIcon name={data} {size} {...$$restProps} />
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
