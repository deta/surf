<script lang="ts">
  import { Command as CommandPrimitive } from '@horizon/cmdk-sv'
  import { Icon } from '@horizon/icons'
  import { cn } from '../../utils'

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

<div class="flex items-center border-b px-4 gap-2" data-cmdk-input-wrapper="">
  {#if breadcrumb}
    <div class="bg-neutral-200 py-1 px-2 rounded-lg flex-shrink-0">
      <span class="text-neutral-900 text-md">{breadcrumb}</span>
    </div>
  {:else if loading}
    <Icon name="spinner" class="shrink-0 opacity-50" />
  {:else}
    <Icon name="search" class="shrink-0 opacity-50" />
  {/if}

  <CommandPrimitive.Input
    class={cn(
      'placeholder:text-neutral-500 flex w-full max-w-[calc(100%-3rem)] text-xl rounded-md bg-transparent py-8 outline-none disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...$$restProps}
    bind:value
  />
</div>
