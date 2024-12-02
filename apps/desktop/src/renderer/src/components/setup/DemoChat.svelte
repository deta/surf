<script lang="ts">
  import { onMount, tick } from 'svelte'
  import Tab from './Tab.svelte'
  import chatWithResource from './assets/chat.with.resource.mp4'
  import chatWithTabs from './assets/chat.with.tabs.mp4'
  import chatWithSpace from './assets/chat.with.space.mp4'
  import { fly } from 'svelte/transition'

  let tabs = [
    { id: 'tabs', label: 'Chat with Tabs' },
    { id: 'spaces', label: 'Chat with Your Contexts' },
    { id: 'resources', label: 'Chat with Resources' }
  ]
  let activeTab = tabs[0].id
  let videos: { [key: string]: HTMLVideoElement } = {}

  async function handleTabChange(event: CustomEvent<string>) {
    const tabId = event.detail
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
  })
</script>

<div class="component-container" in:fly={{ x: 35, duration: 500, delay: 650 }}>
  <Tab {tabs} {activeTab} on:tabChange={handleTabChange}>
    <div slot="content">
      {#each tabs as tab (tab.id)}
        <div class="video-wrapper" class:active={activeTab === tab.id}>
          <video loop muted bind:this={videos[tab.id]} class:hidden={activeTab !== tab.id}>
            <source
              src={tab.id === 'tabs'
                ? chatWithTabs
                : tab.id === 'spaces'
                  ? chatWithSpace
                  : chatWithResource}
              type="video/mp4"
            />
          </video>
        </div>
      {/each}
    </div>
  </Tab>
</div>

<style lang="scss">
  .component-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1.25rem;
    width: 100%;
    height: 100%;
    max-width: 50rem;
    margin: 0 auto;
  }
  .video-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    position: absolute;
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
      border-radius: 0.75rem;
      border: 0.194px solid rgba(0, 0, 0, 0.13);
      border: 0.194px solid color(display-p3 0 0 0 / 0.13);
    }
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    &.hidden {
      visibility: hidden;
    }
  }
</style>
