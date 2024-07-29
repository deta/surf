<script lang="ts">
  import { Command as CommandPrimitive } from '@horizon/cmdk-sv'
  import { cn } from '../../utils'

  type $$Props = CommandPrimitive.ItemProps

  export let asChild = false

  let className: string | undefined | null = undefined
  export { className as class }
</script>

<CommandPrimitive.Item
  {asChild}
  class={cn(
    'aria-selected:bg-neutral-200 aria-selected:text-neutral-900 rounded-xl relative flex cursor-pointer select-none items-center  outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    className
  )}
  {...$$restProps}
  let:action
  let:attrs
>
  <slot {action} {attrs} />
</CommandPrimitive.Item>
