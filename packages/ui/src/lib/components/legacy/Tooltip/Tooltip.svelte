<script lang="ts">
  /**
   * Unified Tooltip component so that we don't style each one individually any longer using tailwind.
   */

  import { flyAndScale } from '@deta/utils'
  import { Tooltip } from 'bits-ui'

  export let side: 'top' | 'left' | 'right' | 'bottom' | undefined = 'top'
</script>

<Tooltip.Root openDelay={385} closeDelay={10}>
  <Tooltip.Trigger>
    <slot />
  </Tooltip.Trigger>
  <Tooltip.Content
    transition={flyAndScale}
    transitionConfig={{ y: 8, duration: 150 }}
    sideOffset={8}
    {side}
  >
    <div class="bg-gray-100 dark:bg-gray-800">
      <Tooltip.Arrow class="rounded-[2px] border-l border-t border-gray-200 dark:border-gray-700" />
    </div>
    <div
      class="content flex items-center justify-center rounded-input border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl px-3 py-2 text-sm font-medium shadow-md outline-none"
    >
      <slot name="content" />
    </div>
  </Tooltip.Content>
</Tooltip.Root>

<style>
  .content {
    pointer-events: none;
    user-select: none;
  }
</style>
