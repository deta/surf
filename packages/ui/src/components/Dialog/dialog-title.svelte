<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui'
  import clsx from 'clsx'

  type $$Props = DialogPrimitive.TitleProps

  let className: $$Props['class'] = undefined
  export { className as class }
</script>

<DialogPrimitive.Title
  class={clsx('text-lg font-semibold leading-none tracking-tight', className)}
  {...$$restProps}
>
  <slot />
</DialogPrimitive.Title>
