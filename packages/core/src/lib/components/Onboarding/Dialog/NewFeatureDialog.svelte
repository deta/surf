<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import type { VersionContent } from '../featured'
  import { versions, completedFeatures } from '../featured'
  import { useTabsManager, type TabsManager } from '../../../service/tabs'

  const dispatch = createEventDispatcher()
  const tabsManager = useTabsManager()

  let selectedVersion = versions[0]

  async function handleTryNow() {
    selectedVersion.action()
    $completedFeatures = [...$completedFeatures, selectedVersion.featureID]

    await tick()
    tabsManager.showNewTabOverlay.set(0)
    dispatch('dismiss')
  }

  function handleAskLater() {
    dispatch('dismiss')
  }

  function handleVersionSelect(version: VersionContent) {
    selectedVersion = version
  }
</script>

<div class="dialog" class:no-versions={versions.length === 1}>
  <div class="content">
    <div class="preview">
      <img
        src={selectedVersion.image}
        alt={`Preview of ${selectedVersion.label}`}
        class="preview-image"
      />
    </div>

    <div class="info">
      <div class="header">
        <span class="subtitle">What's new — {selectedVersion.label}</span>
        <h1 class="title">{selectedVersion.title}</h1>
      </div>

      <p class="description">
        {selectedVersion.description}
      </p>

      <div class="actions">
        <button class="try-button" on:click={handleTryNow}>
          {selectedVersion.buttonText}
        </button>
        <button class="later-button" on:click={handleAskLater}> Maybe Later </button>
      </div>
    </div>

    {#if versions.length > 1}
      <div class="versions">
        {#each versions as version}
          <button
            class="version-button"
            class:current={version === selectedVersion}
            on:click={() => handleVersionSelect(version)}
          >
            {#if version.emoji}
              <span class="emoji">{version.emoji}</span>
            {/if}
            {version.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  :global(::view-transition-old(whatsnew)) {
    height: 100%;
  }
  :global(::view-transition-new(whatsnew)) {
    height: 100%;
  }

  .dialog > * {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-feature-settings:
      'liga' 1,
      'kern' 1;
  }

  .dialog {
    view-transition-name: whatsnew;
    position: fixed;
    bottom: 100%;
    left: 50%;
    transform: translate(-50%, -28vh);
    display: flex;
    padding: 0.5rem;
    z-index: 100;
    background: white;
    border-radius: 24px;
    width: 980px;
    max-width: 80vw;
    overflow: hidden;
    border-radius: 18px;
    border: 1px solid color(display-p3 0.8353 0.8863 0.9961);
    background: radial-gradient(
        143.56% 143.56% at 50% -43.39%,
        #eef4ff 0%,
        #ecf3ff 50%,
        #d2e2ff 100%
      ),
      #fff;
    background: radial-gradient(
        143.56% 143.56% at 50% -43.39%,
        color(display-p3 0.9373 0.9569 1) 0%,
        color(display-p3 0.9321 0.9531 1) 50%,
        color(display-p3 0.8349 0.8849 0.9974) 100%
      ),
      color(display-p3 1 1 1);
    box-shadow:
      0px 116px 33px 0px #000,
      0px 74px 30px 0px rgba(0, 0, 0, 0.01),
      0px 42px 25px 0px rgba(0, 0, 0, 0.05),
      0px 19px 19px 0px rgba(0, 0, 0, 0.09),
      0px 5px 10px 0px rgba(0, 0, 0, 0.1);
    box-shadow:
      0px 116px 33px 0px color(display-p3 0 0 0 / 0),
      0px 74px 30px 0px color(display-p3 0 0 0 / 0.01),
      0px 42px 25px 0px color(display-p3 0 0 0 / 0.05),
      0px 19px 19px 0px color(display-p3 0 0 0 / 0.09),
      0px 5px 10px 0px color(display-p3 0 0 0 / 0.1);
    &.no-versions {
      width: 820px;
      .content {
        grid-template-columns: 1fr 1.2fr;
      }
    }
  }

  .content {
    display: grid;
    grid-template-columns: 1fr 1.2fr 200px;
    min-height: 560px;
  }

  .preview {
    background: #666;
    min-height: 100%;
    position: relative;
    overflow: hidden;
    border-radius: 12px;
  }

  .preview-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.3s ease;
  }

  .info {
    padding: 64px 36px 16px 36px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .subtitle {
    color: #224e94;
    font-size: 14px;
    font-weight: 450;
    letter-spacing: 0.0075em;
  }

  h1 {
    font-size: 32px;
    font-weight: 600;
    color: #224e94;
    margin: 0;
    text-wrap: pretty;
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  .description {
    color: #224e94;
    font-size: 16px;
    line-height: 1.6;
    margin: 0;
    letter-spacing: 0.0075em;
    font-weight: 450;
  }

  .actions {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .try-button {
    background: #ff6b7d;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 8px 20px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    letter-spacing: -0.01em;
    border-radius: 10px;
    border: 1px solid #ff859b;
    border: 1px solid color(display-p3 0.9895 0.5499 0.6136);
    background: #fe5472;
    background: color(display-p3 0.98 0.45 0.47);
    box-shadow:
      0px 0px 3px 0px #e34360 inset,
      1.444px 23.111px 5.778px 0px #5a87cb,
      1.444px 14.444px 5.778px 0px rgba(90, 135, 203, 0.01),
      1.444px 8.667px 4.333px 0px rgba(90, 135, 203, 0.05),
      0px 2.889px 4.333px 0px rgba(90, 135, 203, 0.09),
      0px 1.444px 1.444px 0px rgba(90, 135, 203, 0.1);
    box-shadow:
      0px 0px 3px 0px color(display-p3 0.8235 0.3137 0.3882) inset,
      1.444px 23.111px 5.778px 0px color(display-p3 0.3922 0.5255 0.7765 / 0),
      1.444px 14.444px 5.778px 0px color(display-p3 0.3922 0.5255 0.7765 / 0.01),
      1.444px 8.667px 4.333px 0px color(display-p3 0.3922 0.5255 0.7765 / 0.05),
      0px 2.889px 4.333px 0px color(display-p3 0.3922 0.5255 0.7765 / 0.09),
      0px 1.444px 1.444px 0px color(display-p3 0.3922 0.5255 0.7765 / 0.1);

    &:hover {
      background: #ff5666;
    }
  }

  .later-button {
    background: none;
    border: none;
    color: #6b85c1;
    font-size: 14px;
    cursor: pointer;
    padding: 8px;
    letter-spacing: -0.01em;
    font-weight: 450;

    &:hover {
      color: rgba(107, 133, 193, 0.6);
    }
  }

  .versions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-left: 0.5px solid rgba(0, 0, 0, 0.12);
    padding-left: 8px;
  }

  .version-button {
    background: transparent;
    border: none;
    padding: 8px 16px;
    text-align: left;
    font-size: 14px;
    color: #6485c6;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
    letter-spacing: 0.0075em;
    font-weight: 500;

    &:hover {
      background: #5b68822f;
    }

    &.current {
      background: #5b68821a;
      color: #6b85c1;
      font-weight: 500;
    }

    .emoji {
      font-size: 16px;
    }
  }
</style>
