<script lang="ts">
  import { Command as CommandPrimitive } from '@horizon/cmdk-sv'
  import { Icon } from '@horizon/icons'
  import { cn } from '../../utils/tailwind'

  type $$Props = CommandPrimitive.InputProps & {
    breadcrumb?: string
    loading?: boolean
  }

  let className: string | undefined | null = undefined
  export { className as class }
  export let value: string = ''
  export let breadcrumb: string | undefined = undefined
  export let loading = false
</script>

<div class="flex items-center px-4 gap-2 w-full" data-cmdk-input-wrapper="">
  {#if breadcrumb}
    <div class="bg-gray-200 py-1 px-2 rounded-lg flex-shrink-0">
      <span class="text-gray-900 text-md">{breadcrumb}</span>
    </div>
  {:else if loading}
    <Icon name="spinner" class="shrink-0 opacity-50" />
  {:else}
    <Icon name="search" class="shrink-0 opacity-50" />
  {/if}

  <CommandPrimitive.Input
    class={cn(
      'placeholder:text-gray-500 flex w-full max-w-[calc(100%-3rem)] text-xl rounded-md bg-transparent py-8 outline-none disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...$$restProps}
    bind:value
    autofocus
  />
</div>
