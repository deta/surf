<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui'
  import { cn } from '../../utils/tailwind'

  type $$Props = DialogPrimitive.DescriptionProps

  let className: $$Props['class'] = undefined
  export { className as class }
</script>

<DialogPrimitive.Description class={cn('text-neutral-500 text-sm', className)} {...$$restProps}>
  <slot />
</DialogPrimitive.Description>
