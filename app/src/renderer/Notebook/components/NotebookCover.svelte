<script lang="ts">
  let { title }: { title?: string } = $props()
</script>

<div class="cover-wrapper">
  <div class="cover">
    <div class="cover-text">{title}</div>
  </div>
</div>

<style lang="scss">
  :root {
    /* Base colors */
    --color-white: #ffffff;
    --color-blue-primary: #002dff;
    --color-blue-dark: #0025d3;
    --color-blue-light: #1e4cff;

    /* Opacity variants */
    --color-white-20: rgba(255, 255, 255, 0.2);
    --color-white-17: rgba(255, 255, 255, 0.17);
    --color-white-00: rgba(255, 255, 255, 0);

    /* Display P3 colors */
    --color-p3-blue-primary: color(display-p3 0.0159 0.1733 1);
    --color-p3-blue-dark: color(display-p3 0.0187 0.1424 0.7952);
    --color-p3-blue-light: color(display-p3 0.1671 0.2945 0.9663);
    --color-p3-white-17: color(display-p3 1 1 1 / 0.17);
    --color-p3-white-00: color(display-p3 1 1 1 / 0);

    /* Shadow colors */
    --shadow-color-1: rgba(0, 0, 0, 0.18);
    --shadow-color-2: rgba(0, 0, 0, 0.1);
    --p3-shadow-color-1: color(display-p3 0 0 0 / 0.18);
    --p3-shadow-color-2: color(display-p3 0 0 0 / 0.1);
  }

  .cover {
    width: calc(137px * var(--scale));
    height: calc(219px * var(--scale));
    border-radius: calc(4px * var(--scale)) calc(12px * var(--scale)) calc(12px * var(--scale))
      calc(4px * var(--scale));
    overflow: hidden;

    /* Original gradients with CSS variables */
    background: linear-gradient(
        90deg,
        var(--color-white-20) 0%,
        var(--color-white-17) 11.8%,
        var(--color-white-20) 12.59%
      ),
      linear-gradient(180deg, var(--color-blue-light) 77.85%, var(--color-blue-dark) 100%),
      linear-gradient(0deg, var(--color-blue-primary) 0%, var(--color-blue-primary) 100%),
      var(--color-white);

    /* Display P3 version */
    background: linear-gradient(
        90deg,
        var(--color-p3-white-00) 0%,
        var(--color-p3-white-17) 11.8%,
        var(--color-p3-white-00) 12.59%
      ),
      linear-gradient(180deg, var(--color-p3-blue-light) 77.85%, var(--color-p3-blue-dark) 100%),
      linear-gradient(0deg, var(--color-p3-blue-primary) 0%, var(--color-p3-blue-primary) 100%),
      var(--color-white);

    /* Box shadows with variables and scaling */
    box-shadow:
      0 0 calc(0.467px * var(--scale)) 0 var(--shadow-color-1),
      0 calc(0.933px * var(--scale)) calc(2.8px * var(--scale)) 0 var(--shadow-color-2),
      0 calc(2.8px * var(--scale)) calc(7.467px * var(--scale)) 0 var(--shadow-color-2);

    /* Display P3 version with scaling */
    box-shadow:
      0 0 calc(0.467px * var(--scale)) 0 var(--p3-shadow-color-1),
      0 calc(0.933px * var(--scale)) calc(2.8px * var(--scale)) 0 var(--p3-shadow-color-2),
      0 calc(2.8px * var(--scale)) calc(7.467px * var(--scale)) 0 var(--p3-shadow-color-2);
  }

  .cover-text {
    font-size: calc(14px * var(--scale));
    font-family: 'Inter';
    letter-spacing: 0.01em;
    padding-left: calc(28px * var(--scale));
    padding-top: calc(20px * var(--scale));
    color: var(--color-white);
  }
</style>
