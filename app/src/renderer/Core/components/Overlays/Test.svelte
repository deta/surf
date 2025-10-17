<script lang="ts">
  let count = $state(0)

  function handleClick() {
    console.log('Button clicked in Test overlay')
    count += 1
  }
</script>

<div class="wrapper">
  <h1>Test Overlay</h1>
  <button on:click={handleClick}>Click Me</button>
  <p>Button clicked {count} times</p>
</div>

<style lang="scss">
  .wrapper {
    padding: 20px;
    background-color: light-dark(
      var(--surface-elevated, #f2f2f2),
      var(--surface-elevated-dark, #1f2937)
    );
    border-radius: 8px;
    border: 1px solid
      light-dark(var(--border-subtle, #ccc), var(--border-subtle-dark, rgba(71, 85, 105, 0.4)));
    box-shadow: 0 2px 10px
      light-dark(
        var(--shadow-soft, rgba(0, 0, 0, 0.1)),
        var(--shadow-soft-dark, rgba(15, 23, 42, 0.45))
      );
  }

  h1 {
    color: light-dark(var(--text-primary, #333333), var(--text-primary-dark, #e5edff));
  }

  button {
    padding: 10px 20px;
    background-color: light-dark(var(--brand-primary, #007bff), var(--brand-primary-dark, #4c8dff));
    color: light-dark(var(--text-primary, #ffffff), var(--text-primary-dark, #e5edff));
    border: none;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background-color: light-dark(
        color-mix(in srgb, var(--brand-primary, #007bff) 80%, var(--on-app-background, #000) 20%),
        color-mix(
          in srgb,
          var(--brand-primary-dark, #4c8dff) 85%,
          var(--on-app-background-dark, #e5edff) 15%
        )
      );
    }
  }
</style>
