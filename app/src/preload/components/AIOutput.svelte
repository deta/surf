<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  import { useClipboard } from '@deta/utils/browser'
  import { Icon, IconConfirmation } from '@deta/icons'
  import Button from './Button.svelte'

  export let output = ''

  let bookmarkingIcon: IconConfirmation
  let insertingIcon: IconConfirmation

  const dispatch = createEventDispatcher<{ save: void; insert: void }>()

  const { copy, copied } = useClipboard()

  const handleBookmark = () => {
    bookmarkingIcon.showConfirmation()
    dispatch('save')
  }

  const handleInsert = () => {
    insertingIcon.showConfirmation()
    dispatch('insert')
  }
</script>

<div class="output">
  {output}
</div>

<div class="actions">
  <Button on:click={handleBookmark} tooltip="Save to My Stuff as a comment">
    <IconConfirmation bind:this={bookmarkingIcon} name="save" />
  </Button>

  <Button on:click={() => copy(output)} tooltip="Copy to Clipboard">
    {#if $copied}
      <Icon name="check" />
    {:else}
      <Icon name="copy" />
    {/if}
  </Button>

  <Button on:click={handleInsert} tooltip="Replace Selection with Text">
    <IconConfirmation bind:this={insertingIcon} name="textInsert" />
  </Button>
</div>

<style lang="scss">
  .output {
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    font-size: 16px;
    color: #333;
    background: #f0f0f0;
    padding: 12px;
    border-radius: 8px;
    user-select: text;
  }

  .actions {
    display: flex;
    align-items: stretch;
    gap: 3px;
  }
</style>
