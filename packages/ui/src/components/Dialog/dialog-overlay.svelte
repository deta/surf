<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui'
  import clsx from 'clsx'
  import { fade } from 'svelte/transition'

  type $$Props = DialogPrimitive.OverlayProps

  let className: $$Props['class'] = undefined
  export let transition: $$Props['transition'] = fade
  export let transitionConfig: $$Props['transitionConfig'] = {
    duration: 150
  }
  export { className as class }
</script>

<DialogPrimitive.Overlay
  {transition}
  {transitionConfig}
  class={clsx('bg-gray-100/5 fixed inset-0 z-50', className)}
  {...$$restProps}
/>
