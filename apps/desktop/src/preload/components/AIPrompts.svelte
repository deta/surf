<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  import { Icon } from '@horizon/icons'
  import type { WebViewEventTransform } from '@horizon/types'

  const dispatch = createEventDispatcher<{ click: WebViewEventTransform['type'] }>()

  const runAIAction = (action: WebViewEventTransform['type']) => {
    dispatch('click', action)
  }
</script>

<div class="actions">
  <button on:click|preventDefault|stopPropagation={() => runAIAction('summarize')}>
    <div>Summarize</div>
    <Icon name="arrow.right" />
  </button>

  <button on:click|preventDefault|stopPropagation={() => runAIAction('explain')}>
    <div>Explain</div>
    <Icon name="arrow.right" />
  </button>

  <button on:click|preventDefault|stopPropagation={() => runAIAction('grammar')}>
    <div>Improve Writing</div>
    <Icon name="arrow.right" />
  </button>

  <button on:click|preventDefault|stopPropagation={() => runAIAction('translate')}>
    <div>Translate</div>
    <Icon name="arrow.right" />
  </button>
</div>

<style lang="scss">
  .actions {
    display: flex;
    flex-direction: column;

    button {
      pointer-events: auto;
      appearance: none;
      padding: 8px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      background: none;
      color: #333;
      font-size: 17px;
      font-weight: 500;
      transition: background-color 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      justify-content: space-between;
      width: 100%;
      opacity: 0.75;
      font-size: 15px !important;
    }

    button:hover {
      opacity: 1;
    }
  }
</style>
