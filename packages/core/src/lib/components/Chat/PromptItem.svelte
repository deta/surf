<script lang="ts">
  import { DynamicIcon, type Icons } from '@horizon/icons'

  export let label: string | undefined
  export let icon: Icons | undefined = undefined
</script>

<button
  on:click
  class="flex-shrink-0 max-w-64 flex items-center justify-center gap-2 px-2 py-1 w-fit rounded-xl transition-colors text-sky-800 bg-blue-50 border-blue-300 dark:border-gray-700 dark:text-gray-100 hover:bg-blue-100 dark:bg-gray-800 dark:hover:bg-gray-700 border-[1px] select-none"
>
  {#if icon}
    <div class="text-sky-800 dark:text-gray-100">
      <DynamicIcon name={icon} />
    </div>
  {/if}

  {#if label}
    <div class="text-sky-800 dark:text-gray-100 w-full truncate">
      {label}
    </div>
  {/if}
</button>
