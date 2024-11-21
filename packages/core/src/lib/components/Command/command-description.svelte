<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { cn } from '../../utils/tailwind'

  type $$Props = HTMLAttributes<HTMLSpanElement>

  let className: string | undefined | null = undefined
  export { className as class }
</script>

<span class={cn('text-gray-500 ml-auto text-sm', className)} {...$$restProps}>
  <slot />
</span>
