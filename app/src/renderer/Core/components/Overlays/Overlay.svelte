<script lang="ts">
  import { getAllContexts, mount, onMount, onDestroy, unmount } from 'svelte'
  import { useOverlayManager, type Overlay } from '@deta/services/views'
  import type { Fn } from '@deta/types'
  import { copyStyles } from '@deta/utils/src/dom/copy-styles.svelte'

  import OverlayConsumer from './OverlayConsumer.svelte'
  import type { OverlayProps } from './types.js'

  let { bounds, children, disabled, autofocus = false }: OverlayProps = $props()

  const overlayManager = useOverlayManager()

  let overlay: Overlay
  let instance: ReturnType<typeof mount> | null

  function unmountInstance() {
    if (overlay) {
      overlayManager.destroy(overlay.id)
    }

    if (instance) {
      unmount(instance)
      instance = null
    }
  }

  let unsubs: Fn[] = []

  $effect(() => {
    if (bounds) overlay?.saveBounds(bounds)
  })

  onMount(async () => {
    overlay = await overlayManager.create({ bounds })

    instance = mount(OverlayConsumer, {
      target: overlay.wrapperElement,
      props: { children }
    })

    unsubs.push(copyStyles(overlay.window))

    if (autofocus) {
      overlay.focus()

      // sue me
      setTimeout(() => {
        overlay.focus()
      }, 100)

      setTimeout(() => {
        overlay.focus()
      }, 300)

      setTimeout(() => {
        overlay.focus()
      }, 400)
    }
  })

  onDestroy(() => {
    unsubs.forEach((unsub) => unsub())

    unmountInstance()
  })
</script>

{#if disabled}
  {@render children?.()}
{/if}
