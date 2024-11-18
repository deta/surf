<script lang="ts">
  import { HTMLDragZone } from '@horizon/dragcula'
  import { useHomescreen } from './homescreen'
  import { OpenHomescreenEventTrigger } from '@horizon/types'
  import { Icon } from '@horizon/icons'

  const homescreen = useHomescreen()
  const homescreenVisible = homescreen.visible
</script>

<button
  class="text-sky-800 font-medium text-md"
  class:toggled={$homescreenVisible}
  on:click={() => homescreen.setVisible(!$homescreenVisible)}
  use:HTMLDragZone.action={{ accepts: () => true }}
  on:DragEnter={() => {
    if ($homescreenVisible) return
    homescreen.setVisible(!$homescreenVisible, OpenHomescreenEventTrigger.DragOver)
    window.addEventListener(
      'dragend',
      () => {
        homescreen.setVisible(!$homescreenVisible, OpenHomescreenEventTrigger.DragOver)
      },
      {
        once: true
      }
    )
  }}
>
  <span class="inline-block translate-x-0 transition-transform ease-in-out duration-200">
    <Icon name="home" size="16px" color="currentColor" />
  </span>
</button>

<style lang="scss">
  button {
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;

    padding-inline: 0.563rem;
    padding-block: 0.438rem;

    @apply rounded-lg bg-sky-100/60;

    &.active {
      scale: 98%;
    }

    &.toggled {
      @apply text-sky-950;
      background: #e9f5fd;
      @apply shadow-inner;
      @apply ring-[0.5px];
    }

    &:hover {
      @apply bg-sky-100/90;
    }
  }

  :global(.verticalTabs) button {
    &:hover {
      @apply bg-sky-100;
    }
    &.toggled {
      background: #e9f5fd;
    }
    aspect-ratio: 1 / 1;
    @apply rounded-2xl mr-[0.15em] bg-sky-100/10 w-fit min-w-fit border-2 border-white/10;
  }
</style>
