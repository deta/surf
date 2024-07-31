<script lang="ts">
  import { Command as CommandPrimitive } from '@horizon/cmdk-sv'
  import { cn } from '../../utils'

  type $$Props = CommandPrimitive.ListProps
  let className: string | undefined | null = undefined
  export { className as class }
</script>

<CommandPrimitive.List
  class={cn('max-h-[450px] overflow-y-auto overflow-x-hidden', className)}
  {...$$restProps}
>
  <slot />
</CommandPrimitive.List>
