<!-- DistortedGlass.svelte -->
<script>
  // Any necessary script logic goes here
  // For this component, script logic might be minimal since it's primarily style-based
</script>

<div class="distorted-glass-container">
  <div class="glass-effect"></div>
  <svg style="width: 0; height: 0; position: absolute;">
    <defs>
      <filter id="fractal-noise-glass">
        <feTurbulence type="fractalNoise" baseFrequency="0.12 0.12" numOctaves="1" result="warp"
        ></feTurbulence>
        <feDisplacementMap
          xChannelSelector="R"
          yChannelSelector="G"
          scale="30"
          in="SourceGraphic"
          in2="warp"
        />
      </filter>
    </defs>
  </svg>
</div>

<style>
  .distorted-glass-container {
    position: relative;
    width: 100%;
    height: 100%; /* Fills the parent space */
    overflow: hidden;
  }

  .glass-effect {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.2);
    background: repeating-radial-gradient(
      circle at 50% 50%,
      rgb(255 255 255 / 0),
      rgba(255, 255, 255, 0.2) 10px,
      rgb(255 255 255) 31px
    );
    background-size: 6px 6px;
    filter: url(#fractal-noise-glass);
    backdrop-filter: blur(0px);
  }
</style>
