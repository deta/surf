<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui'
  import clsx from 'clsx'

  type $$Props = DialogPrimitive.DescriptionProps

  let className: $$Props['class'] = undefined
  export { className as class }
</script>

<DialogPrimitive.Description class={clsx('text-gray-500 text-sm', className)} {...$$restProps}>
  <slot />
</DialogPrimitive.Description>
