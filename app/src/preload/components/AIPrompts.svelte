<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  import { Icon } from '@deta/icons'
  import { tooltip } from '@deta/utils/dom'
  import type { WebViewEventTransform } from '@deta/types'

  const dispatch = createEventDispatcher<{ click: WebViewEventTransform['type'] }>()

  const runAIAction = (action: WebViewEventTransform['type']) => {
    dispatch('click', action)
  }
</script>

<div class="actions">
  <button
    on:click|preventDefault|stopPropagation={() => runAIAction('summarize')}
    use:tooltip={{
      text: 'Summarize',
      position: 'top'
    }}
  >
    <!-- <div>Summarize</div> -->
    <Icon name="circle-dot" />
  </button>

  <!-- <button
    on:click|preventDefault|stopPropagation={() => runAIAction('explain')}
    use:tooltip={{
      text: 'Explain',
      position: 'top'
    }}
  >
    <div>Explain</div>
    <Icon name="search" />
  </button> -->

  <button
    on:click|preventDefault|stopPropagation={() => runAIAction('grammar')}
    use:tooltip={{
      text: 'Improve Writing',
      position: 'top'
    }}
  >
    <!-- <div>Improve Writing</div> -->
    <Icon name="grammar" />
  </button>

  <button
    on:click|preventDefault|stopPropagation={() => runAIAction('translate')}
    use:tooltip={{
      text: 'Translate',
      position: 'top'
    }}
  >
    <!-- <div>Translate</div> -->
    <Icon name="language" />
  </button>
</div>

<style lang="scss">
  .actions {
    display: flex;
    flex-direction: row;

    button {
      pointer-events: auto;
      appearance: none;
      padding: 8px;
      border: none;
      border-radius: 8px;

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
      width: fit-content;
      opacity: 0.75;
      font-size: 15px !important;
    }

    button:hover {
      opacity: 1;
    }
  }
</style>
