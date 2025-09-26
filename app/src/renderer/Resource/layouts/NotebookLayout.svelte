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

    //.bg {
    //  content: '';
    //  position: absolute;
    //  inset: -4px;
    //  background:
    //    linear-gradient(rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 1)),
    //    url('https://i.imgur.com/7XbyivJ.png');
    //  background-repeat: no-repeat;
    //  background-size: cover;
    //  background-position: 50% 30%;
    //  //background: #fff;
    //  z-index: -1;
    //  filter: blur(2px);
    //  pointer-events: none;
    //}

    height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;

    padding-inline: 1.5rem;
    padding-block: 4.5rem;

    //&::before {
    //  content: '';
    //  position: absolute;
    //  top: 0;
    //  left: 0;
    //  right: 0;
    //  height: 2rem;
    //  z-index: 0;
    //  pointer-events: none;
    //  background: linear-gradient(to bottom, var(--page-gradient-color), transparent);
    //}
  }
</style>
