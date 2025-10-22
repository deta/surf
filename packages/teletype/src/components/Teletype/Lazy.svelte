<script lang="ts">
  import { onMount, type SvelteComponent } from 'svelte'

  let {
    component,
    ...restProps
  }: {
    component: () => Promise<typeof SvelteComponent>
  } = $props()

  let loadedComponent: typeof SvelteComponent | null = $state(null)

  onMount(() => {
    component().then((module) => {
      loadedComponent = module.default
    })
  })
</script>

{#if loadedComponent}
  <svelte:component this={loadedComponent} {...restProps} />
{:else}
  <slot />
{/if}
