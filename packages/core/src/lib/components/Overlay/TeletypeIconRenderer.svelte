<script lang="ts">
  import { onMount } from 'svelte'
  import { OasisService, OasisSpace, useOasis } from '@horizon/core/src/lib/service/oasis'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { Icon, type Icons } from '@deta/icons'

  export let name: string
  export let size: string = '18px'

  export let oasis: OasisService | undefined = useOasis()

  $: isSpaceIcon = name.startsWith('space;;')
  $: isFavicon = name.startsWith('favicon;;')
  $: spaceId = isSpaceIcon ? name.split(';;')[1] : null
  $: faviconUrl = isFavicon
    ? `https://www.google.com/s2/favicons?sz=64&domain_url=${name.split(';;')[1]}`
    : null
  $: iconName = !isSpaceIcon && !isFavicon ? (name as Icons) : null

  let space: OasisSpace | null = null

  onMount(async () => {
    if (spaceId) {
      space = await oasis!.getSpace(spaceId)
    }
  })
</script>

{#if space}
  <div class="space-icon-wrapper" style:--size={size}>
    <SpaceIcon folder={space} size="md" interactive={false} />
  </div>
{:else if faviconUrl}
  <div class="favicon-wrapper" style:--size={size}>
    <img src={faviconUrl} alt="favicon" />
  </div>
{:else if iconName}
  <Icon name={iconName} {size} />
{/if}

<style lang="scss">
  .space-icon-wrapper {
    display: inline-block;
    width: var(--size, 18px);
    height: var(--size, 18px);
  }

  .favicon-wrapper {
    display: inline-block;
    width: var(--size, 18px);
    height: var(--size, 18px);

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }
</style>
