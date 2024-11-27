<script lang="ts">
  import { onMount } from 'svelte'
  import { OasisSpace, useOasis } from '@horizon/core/src/lib/service/oasis'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { Icon, type Icons } from '@horizon/icons'

  export let name: string

  const oasis = useOasis()

  $: isSpaceIcon = name.startsWith('space;;')
  $: spaceId = isSpaceIcon ? name.split(';;')[1] : null
  $: iconName = isSpaceIcon ? null : (name as Icons)

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
{:else if iconName}
  <Icon name={iconName} />
{/if}

<style lang="scss">
  .space-icon-wrapper {
    display: inline-block;
    width: 18px;
    height: 18px;
  }
</style>
