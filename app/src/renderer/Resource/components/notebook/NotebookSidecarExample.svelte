<script lang="ts">
  import { EXAMPLE_PROMPTS, type ExamplePrompt } from '@deta/services/constants'
  import { Button } from '@deta/ui'
  import { Icon } from '@deta/icons'
  import { useConfig } from '@deta/services'

  import NotebookSidecar from './NotebookSidecar.svelte'

  let {
    onselect
  }: {
    onselect: (example: ExamplePrompt) => void
  } = $props()

  const config = useConfig()
  const settings = config.settings

  const completedExamples = $derived($settings.completed_onboarding_examples ?? [])
  const hideExamples = $derived(
    completedExamples.length === EXAMPLE_PROMPTS.length || $settings.dismissed_onboarding_examples
  )

  const handleSelect = (example: ExamplePrompt) => {
    if (!completedExamples.includes(example.id)) {
      config.updateSettings({
        completed_onboarding_examples: [...completedExamples, example.id]
      })
    }

    onselect(example)
  }

  const handleToggleTried = (id: string) => {
    if (completedExamples.includes(id)) {
      config.updateSettings({
        completed_onboarding_examples: completedExamples.filter((item) => item !== id)
      })
    } else {
      config.updateSettings({
        completed_onboarding_examples: [...completedExamples, id]
      })
    }
  }

  const handleClose = () => {
    config.updateSettings({
      dismissed_onboarding_examples: true
    })
  }
</script>

{#if !hideExamples}
  <NotebookSidecar>
    {#snippet children()}
      <div class="sidecar-header">
        <Icon name="bolt" size="22px" />
        <h1>Getting Started</h1>
      </div>

      <p>Here are some ideas to get you started:</p>

      <ul>
        {#each EXAMPLE_PROMPTS as item}
          <li>
            <button onclick={() => handleToggleTried(item.id)} class="item-icon">
              {#if completedExamples.includes(item.id)}
                <Icon name="check" color="#1d8aff" />
              {:else}
                <Icon name={item.icon} />
              {/if}
            </button>

            <div class="list-item-content">
              <p>{item.description}</p>

              <Button size="md" onclick={() => handleSelect(item)} class="try-button">
                Try it out
                <Icon name="arrow.right" size="15px" />
              </Button>
            </div>
          </li>
        {/each}
      </ul>

      <button onclick={handleClose} class="close">
        <Icon name="close" size="15px" />
      </button>
    {/snippet}
  </NotebookSidecar>
{/if}

<style lang="scss">
  .sidecar-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  h1 {
    font-size: 1rem;
    font-weight: 500;
  }

  p {
    font-size: 0.85rem;
    line-height: 1.4;
    color: light-dark(rgba(0, 0, 0, 0.6), rgba(255, 255, 255, 0.6));
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  li {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    height: min-content;
    max-height: 3.5rem;
    transition:
      max-height 300ms cubic-bezier(0.4, 0, 0.2, 1),
      background-color 200ms ease-in-out,
      color 200ms ease-in-out;
    overflow: hidden;
    border-radius: 8px;
    padding: 0.5rem;
    margin: -0.5rem;
    will-change: max-height, background-color;

    &:hover {
      max-height: 8rem;
      background: var(--ctx-item-hover);
      color: var(--ctx-item-text-hover);

      :global(.try-button[data-button-root]) {
        display: inline-flex;
        margin-top: 0.5rem;
        opacity: 1;
        transform: translateY(0);
      }
    }

    .list-item-content {
      display: flex;
      flex-direction: column;
    }

    :global(.item-icon) {
      flex-shrink: 0;
    }

    p {
      margin: 0;
    }

    :global(.try-button[data-button-root]) {
      font-size: 0.8rem;
      display: inline-flex;
      opacity: 0;
      transform: translateY(-5px);
      transition:
        transform 250ms cubic-bezier(0.4, 0, 0.2, 1),
        opacity 200ms cubic-bezier(0.4, 0, 0.2, 1);
      margin-top: 0.5rem;
      will-change: transform, opacity;
      background: light-dark(#8c9dff, #6075f1);
      color: #fff;
      border-radius: 10px;
      padding: 0.2rem 0.5rem;
      padding-left: 0.75rem;
      min-width: 4.5rem;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.2rem;

      :global(svg) {
        transition: transform 150ms ease-in-out;
      }

      &:hover:not(&:disabled) {
        transition:
          transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        background: light-dark(#7d8ff3, #7d8ff3);
        color: #fff;
      }

      &:hover {
        :global(svg) {
          transition: transform 150ms ease-in-out;
          transform: translateX(2px);
        }
      }
    }
  }

  :global(.sidecar:hover .close) {
    opacity: 1;
  }

  .close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: transparent;
    border: none;
    padding: 0.25rem;
    border-radius: 5px;
    color: light-dark(rgba(0, 0, 0, 0.4), rgba(255, 255, 255, 0.4));
    opacity: 0;

    &:hover {
      background: var(--ctx-item-hover);
      color: var(--ctx-item-text-hover);
    }
  }
</style>
