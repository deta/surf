<script lang="ts">
  import { onMount } from 'svelte'

  const searchParams = new URLSearchParams(window.location.search)
  let overlayId: string = searchParams.get('overlayId') || 'default'

  let count = 0
  let outOfView = false

  let rafID: number | null = null

  const handleMouseEnter = () => {
    console.log('Mouse entered the overlay')
    outOfView = false
  }

  const handleMouseLeave = () => {
    console.log('Mouse left the overlay')
    outOfView = true
  }

  const handleMouseMove = (event: MouseEvent) => {
    // Check if the mouse is within the bounds of the overlay
    const overlayElement = document.querySelector('.overlay-content')
    if (overlayElement) {
      const rect = overlayElement.getBoundingClientRect()
      outOfView = !(
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      )
    }
  }

  onMount(() => {
    console.log('Overlay mounted with ID:', overlayId)

    // // Check if the mouse is within the bounds of the overlay
    // const checkMouseInOverlay = () => {
    //   const overlayElement = document.querySelector('.overlay-content')
    //   if (overlayElement) {

    //     // check
    //     const rect = overlayElement.getBoundingClientRect()
    //     const mouseX = window.mouseX || 0
    //     const mouseY = window.mouseY || 0
    //     outOfView = !(mouseX >= rect.left && mouseX <= rect.right &&
    //                   mouseY >= rect.top && mouseY <= rect.bottom)

    //     count += 1 // Increment count on each check
    //   }

    //   rafID = requestAnimationFrame(checkMouseInOverlay)
    // }
    // rafID = requestAnimationFrame(checkMouseInOverlay)

    // return () => {
    //   if (rafID) {
    //     cancelAnimationFrame(rafID)
    //   }
    // }
  })
</script>

<svelte:window
  on:mousemove={handleMouseMove}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  on:focus={handleMouseEnter}
  on:blur={handleMouseLeave}
/>

<div class="overlay-wrapper">
  <!-- <div class="overlay-debug" class:out-of-view={outOfView}>
    <p>Overlay ID: {overlayId}</p>
    <p>Mouse is {outOfView ? 'out of view' : 'in view'}</p>
    <button on:click={() => (count += 1)}>Count: {count}</button>
  </div> -->

  <div id="wcv-overlay-content"></div>
</div>

<style lang="scss">
  :global(html, body) {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 10px;
    background: #ffffff00;
  }

  .overlay-wrapper {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    // border-radius: 18px;
    // overflow: hidden;
    // background: #ffffff73;
    // backdrop-filter: blur(10px);
    // border: 0.5px solid rgba(0, 0, 0, 0.1);
    // box-shadow:
    //   0 4px 30px rgba(0, 0, 0, 0.1),
    //   0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .overlay-debug {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;

    &.out-of-view {
      opacity: 0.25;
    }

    button {
      background: #fff;
      border: none;
      padding: 0.25rem 0.5rem;
      border-radius: 8px;
      pointer-events: all;
      font-size: 1rem;
      color: #333;

      &:hover {
        background: #f0f0f0;
      }
    }
  }

  #overlay-content {
    height: 100%;
    width: 100%;
  }
</style>
