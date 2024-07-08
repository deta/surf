<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { fade, fly, slide } from 'svelte/transition'

  import type { Toast } from '../../service/toast'
  import { Icon } from '@horizon/icons'

  const dispatch = createEventDispatcher()

  export let toast: Toast
</script>

<article class={toast.type} role="alert">
  <div class="icon">
    {#if toast.type === 'success'}
      <Icon name="check" size="22px" stroke-width="2.5" />
    {:else if toast.type === 'error'}
      <Icon name="close" size="22px" stroke-width="2.5" />
    {:else if toast.type === 'warning'}
      <Icon name="alert-triangle" size="22px" stroke-width="2.5" />
    {:else if toast.type === 'loading'}
      <Icon name="spinner" size="18px" />
    {:else}
      <Icon name="info" size="22px" stroke-width="2.5" />
    {/if}
  </div>

  <div class="text">
    <slot>
      {toast.message}
    </slot>
  </div>

  <!-- {#if dismissible}
      <button class="close" on:click={() => dispatch("dismiss")}>
        <Icon name="close" />
      </button>
    {/if} -->
</article>

<style lang="scss">
  article {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 12px;
    padding: 0.75rem 1rem;
    padding-right: 1.25rem;
    margin: 0 auto 0.5rem auto;
    color: rgba(0, 0, 0, 0.7);
    background: #fffdf9;
    border: 1px solid #e4dfd6;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .text {
    font-size: 1.1rem;
  }

  .error {
    background: #fff8f8;

    .icon {
      color: IndianRed;
    }
  }

  .success {
    background: #fbfffb;

    .icon {
      color: MediumSeaGreen;
    }
  }

  .warning {
    background: #fefcf4;

    .icon {
      color: DarkOrange;
    }
  }

  .info {
    background: #feffff;

    .icon {
      color: SkyBlue;
    }
  }
</style>
