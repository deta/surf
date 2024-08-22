<script lang="ts">
  import { Command as CommandPrimitive } from '@horizon/cmdk-sv'
  import { cn } from '../../utils/tailwind'
  type $$Props = CommandPrimitive.GroupProps

  let className: string | undefined | null = undefined
  export { className as class }
</script>

<CommandPrimitive.Group
  class={cn(
    'text-neutral-800 [&_[data-cmdk-group-heading]]:text-neutral-500 overflow-hidden p-1 [&_[data-cmdk-group-heading]]:px-2 [&_[data-cmdk-group-heading]]:py-1.5 [&_[data-cmdk-group-heading]]:text [&_[data-cmdk-group-heading]]:font-medium',
    className
  )}
  {...$$restProps}
>
  <slot />
</CommandPrimitive.Group>
