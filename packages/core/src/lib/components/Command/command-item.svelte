<script lang="ts">
  import { Command as CommandPrimitive } from '@horizon/cmdk-sv'
  import { cn } from '../../utils/tailwind'

  type $$Props = CommandPrimitive.ItemProps

  export let asChild = false

  let className: string | undefined | null = undefined
  export { className as class }
</script>

<CommandPrimitive.Item
  {asChild}
  class={cn(
    'aria-selected:bg-gray-200 dark:aria-selected:bg-gray-800 aria-selected:text-gray-900 dark:aria-selected:text-gray-100 rounded-lg relative flex  select-none items-center  outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    className
  )}
  {...$$restProps}
  let:action
  let:attrs
>
  <slot {action} {attrs} />
</CommandPrimitive.Item>
