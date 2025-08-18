<script lang="ts">
  import { writable } from 'svelte/store'
  import { Toasts } from './toast'
  import Toast from './Toast.svelte'
  import { onMount } from 'svelte'

  export let service: Toasts

  $: toasts = service.toasts

  const willDismiss = writable(new Set<string>())

  onMount(() => {
    service.on('will-dismiss', (toast) => {
      willDismiss.update((v) => {
        v.add(toast.id)
        return v
      })

      setTimeout(() => {
        willDismiss.update((v) => {
          v.delete(toast.id)
          return v
        })
      }, 500)
    })
  })
</script>

{#if $toasts}
  <section class="toasts-wrapper">
    {#each $toasts.toReversed() as toast, i (toast.id)}
      <Toast
        {toast}
        {i}
        outro={$willDismiss.has(toast.id)}
        on:dismiss={() => service.dismiss(toast.id)}
      />
    {/each}
  </section>
{/if}

<style lang="scss">
  .toasts-wrapper {
    position: fixed;
    z-index: 1000000000;
    top: 2rem;
    left: 0.5rem;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    transition: top 245ms ease-in-out;

    :global(body:has(.app-contents.horizontalTabs):not(:has(.stuff-backdrop))) & {
      top: -0.5rem;
      left: 6rem !important;
    }
  }
</style>
