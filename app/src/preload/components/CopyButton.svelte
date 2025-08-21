<script lang="ts">
  import { useClipboard } from '@deta/utils/browser'
  import { Icon } from '@deta/icons'

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
