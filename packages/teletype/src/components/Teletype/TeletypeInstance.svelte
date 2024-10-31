<script lang="ts">
  import { provideTeletype } from './index'
  import TeletypeCore from './TeletypeCore.svelte'
  import type { Action, Options } from './types'

  export let key = 'default'
  export let actions: Action[] = []
  export let options: Options = {}
  export let show = true

  export const teletype = provideTeletype(
    { open: true, ...options },
    actions,
    key
  )
</script>

{#if show}
  <TeletypeCore {key} />
{/if}
