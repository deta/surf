<script lang="ts">
  export let html: string
  import { Icon } from '@horizon/icons'

  let isOpen = false

  function toggleSpoiler() {
    isOpen = !isOpen
  }
</script>

<div class="spoiler-container">
  <div class:spoiler-content-open={isOpen} class="spoiler-content">
    <div class="wrap"></div>
    {@html html}
  </div>
</div>

<style lang="scss">
  .spoiler-container {
    margin: 0;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    bottom: -2rem;
    height: 20rem;
    container-type: inline-size;
    container-name: spoiler-container;
  }

  .spoiler-button span {
    margin-left: 0.625rem;
  }

  .spoiler-content {
    position: absolute;
    left: 50%;
    right: 50%;
    transform: translateX(-50%);
    overflow: hidden;
    max-height: 20rem;
    max-width: 20rem;
    width: 100%;
    transition:
      max-height 0.5s ease,
      padding 0.5s ease;
    padding: 4rem 3.5rem 0 3.5rem;
    background-image: url('../../../../../../../packages/core/public/assets/paper.png');
    background-size: cover;
    color: #3d3927;
    user-select: none;
    letter-spacing: 0.01rem;
    opacity: 1;
    line-height: 1.4;
    font-size: 0.9rem;
    -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 80%, rgba(0, 0, 0, 0));
  }

  @container spoiler-container (max-width: 15rem) {
    .spoiler-content {
      background-image: none !important;
      padding: 0 !important;
    }
  }

  .spoiler-content-open {
    max-height: fit-content; /* Large enough to show the content */
    padding: 1rem;
  }
</style>
