<script lang="ts">
  export let color: string = '#FF00FF'
</script>

<div class="folder-icon"></div>

<style lang="scss">
  .folder-icon {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: radial-gradient(
        97.58% 97.58% at 50% 10.89%,
        rgba(255, 255, 255, 0.5) 0%,
        rgba(0, 0, 0, 0.5) 100%
      ),
      linear-gradient(180deg, #76e0ff 0%, #4ec9fb 100%);
    background: radial-gradient(
        97.58% 97.58% at 50% 10.89%,
        color(display-p3 1 1 1 / 0.5) 0%,
        color(display-p3 0 0 0 / 0.5) 100%
      ),
      linear-gradient(
        180deg,
        color(display-p3 0.5667 0.87 1) 0%,
        color(display-p3 0.4431 0.7765 0.9647) 100%
      );
    background-blend-mode: soft-light, normal;
    box-shadow:
      0px -0.312px 0.624px 0px rgba(0, 0, 0, 0.15),
      0px -1.248px 1.872px 0px rgba(0, 0, 0, 0.75) inset,
      0px 0.936px 0.624px 0px rgba(255, 255, 255, 0.3) inset,
      0px -1.56px 12.48px 0px #000 inset,
      0px -1.56px 24.96px 0px rgba(0, 0, 0, 0.25) inset;
    box-shadow:
      0px -0.312px 0.624px 0px color(display-p3 0 0 0 / 0.15),
      0px -1.248px 1.872px 0px color(display-p3 0 0 0 / 0.75) inset,
      0px 0.936px 0.624px 0px color(display-p3 1 1 1 / 0.3) inset,
      0px -1.56px 12.48px 0px color(display-p3 0 0 0) inset,
      0px -1.56px 24.96px 0px color(display-p3 0 0 0 / 0.25) inset;
  }
</style>
