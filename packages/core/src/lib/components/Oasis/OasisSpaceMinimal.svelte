<script lang="ts">
  import { onMount } from 'svelte'
  import { derived, writable } from 'svelte/store'

  import type { Space, SpaceEntry } from '../../types'

  import { useResourceManager } from '../../service/resources'
  import { useLogScope } from '../../utils/log'
  import OasisResourcesView from './OasisResourcesView.svelte'

  export let space: Space

  const log = useLogScope('OasisSpace')
  const resourceManager = useResourceManager()

  const spaceContents = writable<SpaceEntry[]>([])

  const resourceIds = derived(spaceContents, ($spaceContents) => {
    return $spaceContents.map((x) => x.resource_id)
  })

  const loadSpaceContents = async () => {
    if (!space) {
      // TODO: load everything space
      return
    }

    const items = await resourceManager.getSpaceContents(space.id)
    log.debug('Loaded space contents:', items)

    spaceContents.set(items)
  }

  onMount(() => {
    loadSpaceContents()
  })
</script>

<div class="wrapper">
  <!-- <div class="header">
        <div class="title">
            {space.name}
        </div>
    </div> -->

  <OasisResourcesView {resourceIds} on:itemClick />
</div>

<style lang="scss">
  .wrapper {
    height: 100%;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2rem;
    padding-bottom: 0;
  }

  .title {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .content {
    height: 100%;
    overflow: auto;
  }
</style>
