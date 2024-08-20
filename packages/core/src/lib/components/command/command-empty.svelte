<script lang="ts">
  import { Command as CommandPrimitive } from '@horizon/cmdk-sv'
  import { cn } from '../../utils/tailwind'

  type $$Props = CommandPrimitive.EmptyProps
  let className: string | undefined | null = undefined
  export { className as class }
</script>

<CommandPrimitive.Empty class={cn('py-6 text-center text', className)} {...$$restProps}>
  <slot />
</CommandPrimitive.Empty>
