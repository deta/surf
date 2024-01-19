<script>
  let loadComponent;
  export { loadComponent as this };

  let componentPromise = loadComponent();
</script>

{#await componentPromise}
{:then { default: Component }}
  <slot name="component" {Component} />
{/await}
