<script lang="ts">
  import { onMount } from 'svelte'
  import { OasisSpace, useOasis } from '@horizon/core/src/lib/service/oasis'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { Icon, type Icons } from '@horizon/icons'

  export let name: string

  const oasis = useOasis()

  $: isSpaceIcon = name.startsWith('space;;')
  $: isFavicon = name.startsWith('favicon;;')
  $: spaceId = isSpaceIcon ? name.split(';;')[1] : null
  $: faviconUrl = isFavicon ? name.split(';;')[1] : null
  $: iconName = !isSpaceIcon && !isFavicon ? (name as Icons) : null

  let space: OasisSpace | null = null

  onMount(async () => {
    if (spaceId) {
      space = await oasis.getSpace(spaceId)
    }
  })
</script>

{#if space}
  <div class="space-icon-wrapper">
    <SpaceIcon folder={space} size="md" interactive={false} />
  </div>
{:else if faviconUrl}
  <div class="favicon-wrapper">
    <img src={faviconUrl} alt="favicon" />
  </div>
{:else if iconName}
  <Icon name={iconName} />
{/if}

<style lang="scss">
  .space-icon-wrapper {
    display: inline-block;
    width: 18px;
    height: 18px;
  }

  .favicon-wrapper {
    display: inline-block;
    width: 18px;
    height: 18px;

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }
</style>
