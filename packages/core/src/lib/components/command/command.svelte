<script lang="ts">
  import { Command as CommandPrimitive } from '@horizon/cmdk-sv'
  import { cn } from '../../utils'

  type $$Props = CommandPrimitive.CommandProps

  export let value: $$Props['value'] = undefined

  let className: string | undefined | null = undefined
  export { className as class }
</script>

<CommandPrimitive.Root
  class={cn(
    'bg-neutral-100 text-neutral-800 flex h-full w-full flex-col overflow-hidden rounded-md',
    className
  )}
  bind:value
  {...$$restProps}
>
  <slot />
</CommandPrimitive.Root>
