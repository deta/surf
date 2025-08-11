<script lang="ts">
  import clsx from 'clsx'
  import type { HTMLAttributes } from 'svelte/elements'

  type $$Props = HTMLAttributes<HTMLDivElement>

  let className: $$Props['class'] = undefined
  export { className as class }
</script>

<div
  class={clsx('flex flex-col space-y-1.5 text-center sm:!text-left', className)}
  {...$$restProps}
>
  <slot />
</div>
