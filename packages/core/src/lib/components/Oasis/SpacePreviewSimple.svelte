<script lang="ts">
  import { DynamicIcon } from '@horizon/icons'
  import { tooltip } from '@deta/utils'

  export let icon: string = 'grid'
  export let isLink: boolean = false
</script>

<div class="preview-wrapper">
  <div class="preview-container">
    <div class="folder">
      <div class="folder-tab"></div>
      <div class="folder-body">
        <div class="icon-container">
          <DynamicIcon name={icon} size={'24px'} />
        </div>
        {#if isLink}
          <div
            class="link-indicator"
            use:tooltip={{
              text: 'Context is linked here.',
              position: 'left'
            }}
          >
            <DynamicIcon name="link" size={'12px'} />
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .preview-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
  }

  .preview-container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .folder {
    width: 100%;
    position: relative;
    perspective: 1000px;
    aspect-ratio: 5 / 4;
    cursor: pointer;
    transition: transform 0.3s ease;
  }

  .folder:hover {
    transform: translateY(-5px);
  }

  .folder-tab {
    position: absolute;
    top: 0;
    left: 20px;
    width: 60px;
    height: 15px;
    background-color: #4b98ef;
    border-radius: 5px 5px 0 0;
    z-index: 2;
    transition: background-color 0.3s ease;
  }

  .folder-body {
    width: 100%;
    height: calc(100% - 10px);
    /* Gradient background */
    background: linear-gradient(135deg, #72c9f3 0%, #4b98ef 100%);
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 20px;
    position: relative;
    overflow: hidden;
    margin-top: 10px;
    transition:
      box-shadow 0.3s ease,
      background 0.3s ease;
  }

  .folder:hover .folder-body {
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    background: linear-gradient(135deg, #7fd1fc 0%, #5aa3f7 100%);
  }

  .folder:hover .folder-tab {
    background-color: #5aa3f7;
  }

  .folder-body::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 5px;
    background-color: #4b98ef;
  }

  .icon-container {
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 60px;
    height: 60px;
    aspect-ratio: 1 / 1;
    z-index: 1;
    transition:
      transform 0.3s ease,
      background-color 0.3s ease;
  }

  .icon-container :global(svg) {
    width: 100%;
    height: 100%;
    max-width: 32px;
    max-height: 32px;
    color: white;
    transition:
      transform 0.3s ease,
      color 0.3s ease;
  }

  .link-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    opacity: 0.8;
    transition:
      transform 0.2s ease,
      opacity 0.2s ease,
      box-shadow 0.2s ease;
  }

  .link-indicator :global(svg) {
    color: #4b98ef;
    opacity: 0.9;
    transition: opacity 0.2s ease;
  }

  .folder:hover .link-indicator {
    transform: scale(1.05);
    opacity: 1;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }

  .folder:hover .link-indicator :global(svg) {
    opacity: 1;
  }

  /* Hover effects */
  .folder:hover .icon-container {
    /* transform: scale(1.1); */
    background-color: rgba(255, 255, 255, 0.3);
  }

  .folder:hover .icon-container :global(svg) {
    /* transform: scale(1.15); */
    color: #ffffff;
  }

  /* Dark Mode */
  :global(.dark) .folder-body {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  }

  :global(.dark) .folder:hover .folder-body {
    background: linear-gradient(135deg, #4f8df8 0%, #2b54d5 100%);
  }

  :global(.dark) .folder-tab {
    background-color: #2563eb;
  }

  :global(.dark) .folder:hover .folder-tab {
    background-color: #3671f1;
  }

  :global(.dark) .folder-body::before {
    background-color: #2563eb;
  }

  :global(.dark) .icon-container {
    background-color: rgba(255, 255, 255, 0.15);
  }

  :global(.dark) .folder:hover .icon-container {
    background-color: rgba(255, 255, 255, 0.25);
  }

  :global(.dark) .icon-container :global(svg) {
    color: white;
  }

  :global(.dark) .link-indicator {
    background-color: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    opacity: 0.7;
  }

  :global(.dark) .link-indicator :global(svg) {
    color: #60a5fa;
    opacity: 0.8;
  }

  :global(.dark) .folder:hover .link-indicator {
    background-color: rgba(30, 41, 59, 0.9);
    border-color: rgba(255, 255, 255, 0.12);
    opacity: 1;
  }

  :global(.dark) .folder:hover .link-indicator :global(svg) {
    opacity: 1;
  }
</style>
