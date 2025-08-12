<script lang="ts">
  import { writable, type Writable } from 'svelte/store'
  import { slide } from 'svelte/transition'

  import { Icon } from '@deta/icons'
  import CustomPopover from '../Popover/CustomPopover.svelte'

  export let showText: boolean = false
  export let opened: Writable<boolean> = writable(false)
</script>

<CustomPopover position="right" popoverOpened={opened}>
  <div slot="trigger" class="flex items-center gap-2 overflow-hidden">
    <div class="text-orange-400">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18px"
        height="18px"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path
          fill="white"
          d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"
        />
        <path d="M12 9v4" />
        <path d="M12 16h.01" />
      </svg>
    </div>

    {#if showText}
      <div
        class="text-sm text-orange-600 flex-shrink-0 whitespace-nowrap"
        transition:slide={{ axis: 'x' }}
      >
        not encrypted
      </div>
    {/if}
  </div>

  <div slot="content" class="no-drag p-4 space-y-3">
    <div class="flex items-center gap-2">
      <div class="text-orange-400">
        <Icon name="alert-triangle" />
      </div>

      <h1 class="text-orange-400 text-lg">Your connection to this site is not secure</h1>
    </div>

    <div class="space-y-2">
      <p class="text-sm">This site is not using encryption to protect your data (https).</p>

      <p class="text-sm">
        You should not enter any sensitive information on this site (for example, passwords or
        credit cards), because it could be stolen by attackers.
      </p>
    </div>
  </div>
</CustomPopover>
