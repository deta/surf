<script lang="ts">
  import { flip } from 'svelte/animate'
  import { Toasts } from '../../service/toast'
  import Toast from './Toast.svelte'
  import { fade, fly } from 'svelte/transition'

  export let service: Toasts

  $: toasts = service.toasts
</script>

{#if $toasts}
  <section class="toasts-wrapper">
    {#each $toasts as toast (toast.id)}
      <div
        class="toast-wrapper"
        animate:flip={{ duration: 300 }}
        in:fly={{ y: -200, duration: 300 }}
        out:fade={{ duration: 300 }}
      >
        <Toast {toast} />
      </div>
    {/each}
  </section>
{/if}

<style lang="scss">
  .toasts-wrapper {
    position: fixed;
    z-index: 1000000000;
    top: 2rem;
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }
</style>
