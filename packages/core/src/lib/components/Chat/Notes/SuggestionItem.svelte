<script lang="ts">
  import { Icon, type Icons } from '@deta/icons'

  export let label: string
  export let icon: Icons | undefined = undefined
</script>

<button
  on:click
  class="flex-shrink-0 max-w-128 flex items-center justify-center gap-2 px-2 py-1 w-fit rounded-xl transition-colors bg-blue-50 border-blue-300 dark:border-gray-700 dark:text-gray-100 hover:bg-blue-100 dark:bg-gray-800 dark:hover:bg-gray-700 border-[1px] select-none"
>
  {#if icon}
    <div class="text-sky-800 dark:text-gray-100">
      <Icon name={icon} />
    </div>
  {/if}

  <div class="text-sky-800 dark:text-gray-100 text-sm w-full truncate">
    {label}
  </div>
</button>
