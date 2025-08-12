<script lang="ts">
  import stuff from '../assets/hero.png'
  import stuffHeader from '../assets/stuff.png'
  import stuffSave from '../assets/stuff.save.mp4'
  import stuffSmartSpace from '../assets/stuff.smart.space.mp4'
  import { onMount, tick } from 'svelte'
  import { fly, fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { createEventDispatcher } from 'svelte'
  import Button from './Button.svelte'
  import { isMac } from '@deta/utils'

  export let running = false

  let isOpen = false
  let openCloseCount = 0
  let showFinishButton = false
  let imagesLoaded = false

  $: modShortcut = isMac() ? '⌘' : 'Ctrl'

  const dispatch = createEventDispatcher()

  const texts = [
    'Your stuff is everywhere? We think it deserves a new home.',
    'Finally there is a cool spot to stash all your internet things, following along wherever you go.'
  ]

  // New code for tabs
  let tabs = [
    { id: 'stuff', label: 'Your Stuff' },
    { id: 'spaces', label: 'Save everything' },
    { id: 'smart-spaces', label: 'Auto Organize' }
  ]

  let activeTab = tabs[0].id
  let videos: { [key: string]: HTMLVideoElement } = {}

  $: if (!running) {
    isOpen = false
    openCloseCount = 0
    showFinishButton = false
  }

  function handleKeydown(event: KeyboardEvent) {
    if (running && ((event.metaKey && event.key === 'o') || (event.ctrlKey && event.key === 'o'))) {
      event.preventDefault()
      toggleOverlay()
    }
  }

  function toggleOverlay() {
    dispatch('finish')
    // isOpen = !isOpen
    // openCloseCount++
    // if (openCloseCount >= 1 && !showFinishButton) {
    //   showFinishButton = true
    // }
  }

  function finish() {
    dispatch('finish')
  }

  // New function for handling tab changes
  async function handleTabChange(tabId: string) {
    activeTab = tabId
    await tick()
    if (videos[tabId]) {
      videos[tabId].currentTime = 0
      videos[tabId].play()
    }
  }

  onMount(async () => {
    await tick()
    if (videos[activeTab]) {
      videos[activeTab].play()
    }
    // Force load images and set imagesLoaded to true when done
    const images = [stuff, stuffHeader]
    let loadedCount = 0
    images.forEach((src) => {
      const img = new Image()
      img.src = src
      img.onload = () => {
        loadedCount++
        if (loadedCount === images.length) {
          imagesLoaded = true
        }
      }
    })
  })
</script>

<svelte:window on:keydown={handleKeydown} />

{#if imagesLoaded}
  <div class="content">
    {#if running && !isOpen}
      <div
        class="stuff-header"
        in:fly|global={{
          y: 15,
          duration: 600,
          delay: 100,
          easing: cubicOut
        }}
        out:fly|global={{
          x: -50,
          duration: 600,
          easing: cubicOut
        }}
      >
        <img
          src={stuffHeader}
          alt="Stuff Header"
          class="stuff-header-img"
          class:running
          class:open={isOpen}
          style="max-height: {running ? '50rem' : '100%'};"
          loading="lazy"
        />
      </div>
      <div class="disclaimer" in:fade={{ duration: 300 }} out:fade={{ duration: 300 }}>
        {#each texts as text, index}
          <div
            in:fly|global={{
              y: 50,
              duration: (index + 1) * 600,
              delay: 360 * (index + 1),
              easing: cubicOut
            }}
            out:fly|global={{
              y: -50,
              duration: (index + 1) * 600,
              easing: cubicOut
            }}
            class="info-text"
          >
            <p>{text}</p>
          </div>
        {/each}
        <div
          in:fly|global={{
            y: 15,
            duration: 600,
            delay: 2200,
            easing: cubicOut
          }}
          out:fly|global={{
            y: -15,
            duration: 600,
            easing: cubicOut
          }}
        >
          <div class="open-stuff">
            <Button on:click={toggleOverlay}>Open Stuff</Button>
            <span class="caption">or use {modShortcut} + O</span>
          </div>
        </div>
      </div>
    {/if}

    <div class="demo">
      {#if !running}
        <div class="tab-container" in:fly={{ y: 50, duration: 280, delay: 320 }}>
          {#each tabs as tab}
            <button
              class="tab-button"
              class:active={activeTab === tab.id}
              on:click={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          {/each}
        </div>
      {/if}
      <div class="tab-content" in:fly={{ x: 35, duration: 500, delay: 650 }}>
        {#if activeTab === 'stuff' || running}
          <img
            src={stuff}
            alt="Stuff Illustration"
            class="explainer-image"
            class:running
            class:open={isOpen}
            style="max-height: {running ? '50rem' : '100%'};"
            loading="lazy"
          />
        {/if}
        {#if activeTab === 'spaces' && !running}
          <div class="tab spaces">
            <div class="video-wrapper" class:active={activeTab === 'spaces'}>
              <video loop muted bind:this={videos['spaces']} class:hidden={activeTab !== 'spaces'}>
                <source src={stuffSave} type="video/mp4" />
              </video>
            </div>
          </div>
        {/if}
        {#if activeTab === 'smart-spaces' && !running}
          <div class="tab smart-spaces">
            <div class="video-wrapper" class:active={activeTab === 'smart-spaces'}>
              <video
                loop
                muted
                bind:this={videos['smart-spaces']}
                class:hidden={activeTab !== 'smart-spaces'}
              >
                <source src={stuffSmartSpace} type="video/mp4" />
              </video>
            </div>
          </div>
        {/if}
      </div>
      {#if showFinishButton}
        <div class="finish-button">
          <Button on:click={finish}>Nice, got it!</Button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  @import '../assets/motion.css';

  .content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: fit-content;
    width: 100%;
    position: relative;
    overflow: hidden;
  }
  .stuff-header {
    display: block;
    height: 0; /* This needs to be 0 for svelte transitions to work properly*/
    /* background: #fff; */
    border-radius: 1rem;
    visibility: visible;
    img {
      width: 20rem;
    }
  }

  .open-stuff {
    padding: 2rem 0;
  }

  .video-wrapper {
    width: 100%;
    height: auto;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    top: 0;
    left: 0;
    opacity: 0;
    transition: opacity 0.3s ease;
    border-radius: 0.75rem;
    &.active {
      opacity: 1;
      z-index: 1;
    }
    video {
      width: 100%;
      height: 100%;
      border-radius: 1.25rem;
      border: 0.194px solid rgba(0, 0, 0, 0.13);
      border: 0.194px solid color(display-p3 0 0 0 / 0.13);
    }
  }

  .demo {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    width: 100%;
    height: 100%;
    max-height: 100%;

    img {
      width: 100%;
      height: auto;
      max-height: 100%;
      transition:
        transform 684.42ms var(--custom-timing-650),
        max-height 684.42ms var(--custom-timing-650);

      &.running {
        transform: translateY(100%);
      }

      &.open {
        transform: translateY(0);
      }
    }

    .finish-button {
      position: fixed;
      top: 4rem;
      z-index: 10;
      transition: opacity 630ms var(--custom-timing-630);
    }
  }

  .explainer-image {
    z-index: 10;
  }

  .disclaimer {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    position: absolute;
    top: 60%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 5;
    transition: top 630 var(--custom-timing-630);

    .info-text {
      &:first-child > p {
        font-family: 'Inter', sans-serif;
        font-size: 1.75rem;
      }

      > p {
        font-family: 'Inter', sans-serif;
        font-size: 1.5rem;
        color: #fff;
        text-align: center;
        transition: opacity 630ms var(--custom-timing-630);
        text-wrap: balance;
        text-shadow:
          0px 2.633px 0.745px 0px #001c38,
          0px 1.689px 0.646px 0px rgba(0, 28, 56, 0.01),
          0px 0.944px 0.547px 0px rgba(0, 28, 56, 0.05),
          0px 0.397px 0.397px 0px rgba(0, 28, 56, 0.09),
          0px 0.099px 0.248px 0px rgba(0, 28, 56, 0.1);
        text-shadow:
          0px 2.633px 0.745px 0px color(display-p3 0.0275 0.1059 0.2118 / 0),
          0px 1.689px 0.646px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.01),
          0px 0.944px 0.547px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.05),
          0px 0.397px 0.397px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.09),
          0px 0.099px 0.248px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.1);
      }
    }
  }

  span.caption {
    font-size: 1rem;
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    padding: 0.75rem;
    letter-spacing: 0.225px;
    color: #fff;
    text-shadow:
      0px 2.633px 0.745px 0px #001c38,
      0px 1.689px 0.646px 0px rgba(0, 28, 56, 0.01),
      0px 0.944px 0.547px 0px rgba(0, 28, 56, 0.05),
      0px 0.397px 0.397px 0px rgba(0, 28, 56, 0.09),
      0px 0.099px 0.248px 0px rgba(0, 28, 56, 0.1);
    text-shadow:
      0px 2.633px 0.745px 0px color(display-p3 0.0275 0.1059 0.2118 / 0),
      0px 1.689px 0.646px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.01),
      0px 0.944px 0.547px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.05),
      0px 0.397px 0.397px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.09),
      0px 0.099px 0.248px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.1);
  }

  :global(.disclaimer .button) {
    width: auto;
    padding: 0.5rem 1.5rem;
  }

  .tab {
    background: #fff;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    border-radius: 1.25rem;
    margin: 1rem;
    margin-top: 2rem;
    width: 100%;
  }

  .tab-container {
    display: flex;
    justify-content: center;
    border-radius: 1.25rem;
    padding: 0.3125rem;
    gap: 0.5rem;
    margin-top: 6rem;
    margin-bottom: 1rem;
  }

  .tab-button {
    background-color: transparent;
    border: none;
    padding: 0.875rem 2rem 0.95rem 2rem;
    border-radius: 2rem;

    font-family: 'Inter', sans-serif;
    font-size: 1.25rem;
    line-height: 1;
    font-weight: 500;
    color: white;
    transition:
      background-color 0.3s,
      color 0.3s;

    &:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }

    &.active {
      background-color: white;
      color: #4a90e2;
    }
  }

  .tab-content {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 2rem;
  }

  .description,
  .details {
    color: #fff;
    text-align: center;
    padding: 1rem;

    h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }

    p,
    ul {
      font-size: 1rem;
    }

    ul {
      list-style-type: none;
      padding: 0;
    }

    li {
      margin-bottom: 0.5rem;
    }
  }
</style>
