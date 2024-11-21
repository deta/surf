<script lang="ts">
  import { Command as CommandPrimitive } from '@horizon/cmdk-sv'
  import { cn } from '../../utils/tailwind'

  type $$Props = {
    value?: string
    selectFirstCommandItem?: () => string | undefined
  } & CommandPrimitive.RootProps

  export let value: $$Props['value'] = undefined
  export let selectFirstCommandItem: () => string | undefined

  let className: string | undefined | null = undefined
  export { className as class }
</script>

<CommandPrimitive.Root
  class={cn(
    'bg-white dark:text-gray-100 dark:bg-gray-900 text-gray-800 flex h-full w-full flex-col overflow-hidden rounded-xl',
    className
  )}
  bind:value
  bind:selectFirstCommandItem
  {...$$restProps}
>
  <slot />
</CommandPrimitive.Root>
