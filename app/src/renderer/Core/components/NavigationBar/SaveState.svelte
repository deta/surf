<script lang="ts">
  import { Icon } from '@deta/icons'
  import type { WebContentsView } from '@deta/services/views'
  import { Button } from '@deta/ui'
  import { useLogScope } from '@deta/utils'

  let {
    view
  }: {
    view: WebContentsView
  } = $props()

  const log = useLogScope('SaveState')

  let isSaved = $derived(view.resourceCreatedByUser)

  async function onClick() {
    if ($isSaved) {
      log.info('Resource is already saved')
      return
    }

    log.debug('Bookmarking page')
    await view.bookmarkPage()
  }
</script>

<Button size="md" onclick={onClick} style="padding-block: 6px;padding-inline: 8px;">
  {#if $isSaved}
    <Icon name="bookmarkFilled" size="1.085em" />
    Saved
  {:else}
    <Icon name="bookmark" size="1.085em" />
    Save
  {/if}
</Button>
