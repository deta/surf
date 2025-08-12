<script lang="ts">
  import { Icon, type Icons } from '@deta/icons'

  export let text: string = 'Click'
  export let icon: Icons | undefined = undefined
  export let onClick: () => void = () => {}
</script>

<button on:click={onClick}>
  {#if icon}
    <Icon name={icon} />
  {/if}
  <span>{text}</span>
</button>

<style lang="scss">
  :root {
    --button-primary-color: #3a53ff;
    --button-primary-hover: #426eff;
    --button-text-color: #ffffff;
    --button-text-size: 13px;
    --button-radius: 0.65rem;
    --button-transition-speed: 0.5s;
    --button-shine-opacity: 0.3;
    --button-shadow-light: rgba(0, 0, 0, 0.05);
    --button-shadow-medium: rgba(0, 0, 0, 0.1);
  }

  button {
    /* Base styling */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background-color: var(--button-primary-color);
    padding: 0.65rem 1rem 0.75rem 1rem;
    border-radius: var(--button-radius);
    font-size: var(--button-text-size);
    font-weight: 500;
    color: var(--button-text-color);
    line-height: 1;
    text-align: center;
    cursor: pointer;
    border: none;

    /* Transition effects */
    transition: all var(--button-transition-speed) cubic-bezier(0.4, 0, 0.2, 1);

    /* Shine effect */
    border-top: 0.5px solid rgba(255, 255, 255, var(--button-shine-opacity));
    background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0));

    /* Shadow effect */
    box-shadow:
      0 1px var(--button-shadow-light),
      0 1.5px 2px var(--button-shadow-medium),
      inset 0 -1px var(--button-shadow-medium);

    :global(.dark) & {
      background-color: var(--button-primary-color);
      color: var(--button-text-color);
    }
  }

  button:hover {
    background-color: var(--button-primary-hover);
  }

  button:active {
    transform: translateY(1px);
  }

  button:disabled {
    opacity: 0.5;
  }

  button span {
    display: inline-block;
  }
</style>
