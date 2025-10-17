<script lang="ts">
  import { onMount } from 'svelte'
  import { wait } from '@deta/utils'

  const searchParams = new URLSearchParams(window.location.search)
  let overlayId: string = searchParams.get('overlayId') || 'default'

  let count = 0
  let outOfView = false

  let rafID: number | null = null

  const handleMouseEnter = () => {
    outOfView = false
  }

  const handleMouseLeave = () => {
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

  onMount(async () => {
    document.body.classList.remove('hide-everything')

    // Initialize dark mode
    try {
      // @ts-ignore - window.api is injected
      const settings = await window.api.getSettings()
      const appStyle = settings?.app_style || 'light'
      document.documentElement.dataset.colorScheme = appStyle
      document.documentElement.style.colorScheme = appStyle

      // Listen for theme changes
      // @ts-ignore - window.api is injected
      const cleanup = window.api.onSettingsChanged?.((newSettings) => {
        const newAppStyle = newSettings?.app_style || 'light'
        document.documentElement.dataset.colorScheme = newAppStyle
        document.documentElement.style.colorScheme = newAppStyle
      })

      return () => cleanup?.()
    } catch (error) {
      console.error('Failed to initialize theme:', error)
    }

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
    background: transparent;
  }

  .overlay-wrapper {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    // border-radius: 18px;
    // overflow: hidden;
    // background: light-dark(#ffffff73, rgba(26, 36, 56, 0.45));
    // backdrop-filter: blur(10px);
    // border: 0.5px solid light-dark(rgba(0, 0, 0, 0.1), rgba(71, 85, 105, 0.3));
    // box-shadow:
    //   0 4px 30px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.25)),
    //   0 2px 10px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.2));
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
      background: light-dark(#fff, #1a2438);
      border: none;
      padding: 0.25rem 0.5rem;
      border-radius: 8px;
      pointer-events: all;
      font-size: 1rem;
      color: light-dark(#333, #e5edff);

      &:hover {
        background: light-dark(#f0f0f0, #283549);
      }
    }
  }

  #overlay-content {
    height: 100%;
    width: 100%;
  }
</style>
