<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import appIcon from '../assets/icon_512.png'

  let downloadProgress = 0
  let status = 'Starting download...'
  let showProgress = true

  function handleDownloadProgress(progress: number) {
    downloadProgress = progress
    if (progress === 100) {
      status = 'Download complete. Restarting...'
    } else {
      status = `Downloading update...`
    }
    showProgress = true
  }

  onMount(() => {
    window.updatesAPI.onUpdateProgress(handleDownloadProgress)
  })

  onDestroy(() => {
    window.updatesAPI.removeUpdateProgressListener()
  })
</script>

<main class="main-container drag">
  <div class="content-wrapper no-drag">
    <div class="icon-container">
      <img src={appIcon} alt="App Icon" />
    </div>

    <div class="update-container">
      <p class="status-text">
        {status}
      </p>

      <br />

      {#if showProgress}
        <div class="progress-bar-container">
          <div
            class="progress-bar"
            style="width: {downloadProgress}%"
            class:complete={downloadProgress === 100}
          />
        </div>
        <br />
        <p class="progress-text">{downloadProgress.toFixed(1)}%</p>
      {/if}
    </div>
  </div>
</main>

<style lang="scss">
  .drag {
    -webkit-app-region: drag;
  }

  .no-drag {
    -webkit-app-region: no-drag;
  }

  img {
    width: 100px;
    height: 100px;
    user-select: none;
    pointer-events: none;
  }

  .main-container {
    height: 100vh;
    width: 100vw;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #f5f5f5;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 300px;
  }

  .icon-container {
    display: flex;
    justify-content: center;
  }

  .update-container {
    padding: 2rem;
    border-radius: 8px;
    background-color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .status-text {
    margin: 0;
    text-align: center;
    color: #333;
    font-size: 1rem;
  }

  .progress-bar-container {
    width: 100%;
    height: 8px;
    background-color: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background-color: #007bff;
    transition: width 0.3s ease-in-out;

    &.complete {
      background-color: #28a745;
    }
  }

  .progress-text {
    margin: 0;
    text-align: center;
    font-size: 0.875rem;
    color: #666;
  }
</style>
