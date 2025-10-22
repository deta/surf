<script lang="ts">
  import { provideTeletype } from './index'
  import TeletypeCore from './TeletypeCore.svelte'
  import type { Action, Options } from './types'

  let {
    key = 'default',
    actions = [],
    options = {},
    show = true
  }: {
    key?: string
    actions?: Action[]
    options?: Options
    show?: boolean
  } = $props()

  export const teletype = provideTeletype({ open: true, ...options }, actions, key)
</script>

{#if show}
  <TeletypeCore {key} />
{/if}
