<script lang="ts">
  import { writable } from 'svelte/store'
  import { Toasts } from '../../service/toast'
  import Toast from './Toast.svelte'
  import { onMount } from 'svelte'

  export let service: Toasts

  $: toasts = service.toasts

  const willDismiss = writable(new Set<string>())

  onMount(() => {
    service.eventEmitter.on('will-dismiss', (toast) => {
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
      <Toast {toast} {i} outro={$willDismiss.has(toast.id)} />
    {/each}
  </section>
{/if}

<style lang="scss">
  .toasts-wrapper {
    position: fixed;
    z-index: 1000000000;
    top: 0;
    left: 50%;
    transform: translateX(-50%);

    :global(body:has(.horizontalTabs)) & {
      top: 2.5em !important;
    }
  }
</style>
