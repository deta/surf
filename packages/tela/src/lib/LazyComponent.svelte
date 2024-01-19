<script>
  let loadComponent;
  export { loadComponent as this };

  let componentPromise = loadComponent();
</script>

<!-- Does not seem to improve stuff: -->
<svelte:options immutable={true} />

{#await componentPromise}
{:then { default: Component }}
  <slot name="component" {Component} />
{/await}
