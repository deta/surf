<script lang="ts">
  import { onMount, type SvelteComponent } from 'svelte'

  export let component: () => Promise<typeof SvelteComponent>

  let loadedComponent: typeof SvelteComponent | null = null

  onMount(() => {
    component().then((module) => {
      loadedComponent = module.default
    })
  })
</script>

{#if loadedComponent}
  <svelte:component this={loadedComponent} {...$$props} />
{:else}
  <slot />
{/if}
