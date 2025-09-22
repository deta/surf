<script lang="ts">
  /**
   * Scrollable content which is masked correctly (Verttical only for now!)
   */
  import { onMount, tick, type Snippet } from "svelte"

  let { children, grow, ...restProps }: { children: Snippet, grow?: boolean } = $props();

  let el: HTMLElement
  let observer: ResizeObserver
  let maskTop = $state(false)
  let maskBottom = $state(false)

  function updateMasks() {
    maskTop = el.scrollTop !== 0;
    maskBottom = el.scrollTop + el.clientHeight < el.scrollHeight;
  }

  // FIX: update on content changed
  onMount(() => {
    tick().then(() => {
      updateMasks()
    })

    observer = new ResizeObserver(() => {
      tick().then(() => {
        updateMasks()
      })
    })
    observer.observe(el)
    
    return () => {
      observer?.disconnect()
    }
  })
</script>

<scroll-container {...restProps} bind:this={el} class:maskTop class:maskBottom onscroll={updateMasks} class:grow>
  <scroll-contents>
    {@render children?.()}
  </scroll-contents>
</scroll-container>

<style lang="scss">
  scroll-container {
    display: block;
    height: inherit;
    --mask-default: 0.5rem;

    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: none;


    &.grow {
      flex-grow: 1;
      height: inherit;
    }


    &.maskTop {
      mask-image: linear-gradient(to bottom,
        transparent 0,
        #000 var(--mask-size, var(--mask-default)),
        #000 100%), /* main content */
    linear-gradient(to left, black 8px, transparent 10px); /* not masked area for scrollbar */
}

    &.maskBottom {
      mask-image: linear-gradient(to bottom,
        #000 0,
        #000 calc(100% - var(--mask-size, var(--mask-default))),
        transparent 100%), /* main content */
        linear-gradient(to left, black 8px, transparent 10px); /* not masked area for scrollbar */
}

    &.maskTop.maskBottom {
      mask-image: linear-gradient(to bottom,
        transparent 0,
        #000 var(--mask-size, var(--mask-default)),
        #000 calc(100% - var(--mask-size, var(--mask-default))),
        transparent 100%), /* main content */
        linear-gradient(to left, black 8px, transparent 10px); /* not masked area for scrollbar */
}
      mask-size: 100% 100%;
      mask-position: 0 0, 100% 0;
      mask-repeat: no-repeat, no-repeat;
      &::-webkit-scrollbar-track {
        background: transparent; /* hides the track */
      }
    }


    scroll-contents {
      display:flex;
      flex-direction: column;
      max-width: 100%;
      padding: var(--padding, 0);
    }
</style>
