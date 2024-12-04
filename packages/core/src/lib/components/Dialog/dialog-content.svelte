<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui'
  import * as Dialog from './index.js'
  import { cn } from '../../utils/tailwind.js'
  import { flyAndScale } from '@horizon/utils'
  import { Icon } from '@horizon/icons'

  type $$Props = DialogPrimitive.ContentProps

  let className: $$Props['class'] = undefined
  export let transition: $$Props['transition'] = flyAndScale
  export let transitionConfig: $$Props['transitionConfig'] = {
    duration: 50
  }
  export { className as class }
</script>

<Dialog.Portal>
  <Dialog.Overlay />
  <DialogPrimitive.Content
    {transition}
    {transitionConfig}
    class={cn(
      'bg-gray-100 fixed left-[50%] top-[50%] z-50 grid w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-2xl sm:rounded-lg md:!w-full',
      className
    )}
    {...$$restProps}
  >
    <slot />
    <DialogPrimitive.Close
      class="ring-offset-gray-500/10 focus:ring-ring data-[state=open]:bg-gray-200 data-[state=open]:text-gray-500 absolute right-4 top-[1.35rem] rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none"
    >
      <Icon name="close" />
      <span class="sr-only">Close</span>
    </DialogPrimitive.Close>
  </DialogPrimitive.Content>
</Dialog.Portal>
