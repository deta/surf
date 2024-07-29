<script lang="ts">
  import { Command as CommandPrimitive } from '@horizon/cmdk-sv'
  import { Icon } from '@horizon/icons'
  import { cn } from '../../utils'

  type $$Props = CommandPrimitive.InputProps

  let className: string | undefined | null = undefined
  export { className as class }
  export let value: string = ''
</script>

<div class="flex items-center border-b px-4" data-cmdk-input-wrapper="">
  <Icon name="search" class="mr-2 shrink-0 opacity-50" />
  <CommandPrimitive.Input
    class={cn(
      'placeholder:text-neutral-500 flex w-full max-w-[calc(100%-3rem)] text-xl rounded-md bg-transparent py-8 outline-none disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...$$restProps}
    bind:value
  />
</div>
