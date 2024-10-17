<script lang="ts">
  import { useOasis } from '@horizon/core/src/lib/service/oasis'

  import type { PillSpace } from '../ContextBubbles.svelte'
  import ContextBubbleItemWrapper, { type PillProperties } from './ContextBubbleItemWrapper.svelte'
  import SpaceIcon from '../../Atoms/SpaceIcon.svelte'
  import type { Space } from '@horizon/core/src/lib/types'

  export let pill: PillSpace
  export let pillProperties: PillProperties

  const oasis = useOasis()

  let space: Space | null = null

  const getSpace = async (spaceId: string) => {
    space = await oasis.getSpace(spaceId)
    return space
  }
</script>

<ContextBubbleItemWrapper {pill} {pillProperties} on:remove-item on:select>
  {#if typeof pill?.data === 'string'}
    {#await getSpace(pill.data) then fetchedSpace}
      {#if fetchedSpace}
        <SpaceIcon folder={fetchedSpace} />
      {/if}
    {/await}
  {:else}
    <SpaceIcon folder={pill.data} />
  {/if}

  <div slot="popover" class="p-4 space-y-2 min-w-48">
    <div class="text-slate-700 text-sm">Space</div>

    <div class="flex items-center gap-2">
      {#if space}
        <div class="w-6 h-6">
          <SpaceIcon folder={space} />
        </div>
      {/if}

      <div class="text-slate-900 text-lg font-medium">{pill.title}</div>
    </div>
  </div>
</ContextBubbleItemWrapper>
