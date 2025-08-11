<script lang="ts">
  import { useClipboard } from '@deta/utils'
  import { Icon } from '@horizon/icons'

  import Button, { type ButtonKind } from './Button.svelte'

  export let text = ''
  export let tooltip = 'Copy to clipboard'
  export let kind: ButtonKind = 'standard'

  const { copy, copied } = useClipboard()
</script>

<Button on:click={() => copy(text)} {tooltip} {kind} {...$$restProps}>
  {#if $copied}
    <Icon name="check" />
  {:else}
    <Icon name="copy" />
  {/if}
</Button>

<style lang="scss">
</style>
