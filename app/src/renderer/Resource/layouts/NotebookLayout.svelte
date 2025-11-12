<div class="notebook">
  <div class="bg"></div>
  <slot></slot>
</div>

<style lang="scss">
  @media screen and (min-width: 1200px) {
    :global(.notebook:has(aside.open) main) {
      transform: translateX(calc(1 * var(--sidebar-width) / 2));
    }
    :global(.notebook main) {
      transition: transform 123ms ease-out;
    }
  }

  .notebook {
    position: relative;
    overflow-x: hidden;
    height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;

    // default for laptops (13-15")
    padding-inline: 2rem;
    padding-block: 2rem;

    // larger laptops and small external monitors (15-24")
    @media screen and (min-width: 1440px) {
      padding-inline: 3rem;
      padding-block: 3rem;
    }

    // large external monitors (27"+)
    @media screen and (min-width: 1920px) {
      padding-inline: 4rem;
      padding-block: 4rem;
    }

    // ultra-wide or very large displays
    @media screen and (min-width: 2560px) {
      padding-inline: 5rem;
      padding-block: 5rem;
    }
  }
</style>
