<script lang="ts">
  // from https://svelte.dev/repl/d65a4e9f0ae74d1eb1b08d13e428af32?version=3.35.0
  // based on suggestions from:
  // Inclusive Components by Heydon Pickering https://inclusive-components.design/toggle-button/
  // On Designing and Building Toggle Switches by Sara Soueidan https://www.sarasoueidan.com/blog/toggle-switch-design/
  // and this example by Scott O'hara https://codepen.io/scottohara/pen/zLZwNv

  import { createEventDispatcher } from 'svelte'

  export let label: string | undefined = undefined
  export let fontSize = 16
  export let checked = false
  export let color = 'CornflowerBlue'
  export let reverse = false

  const dispatch = createEventDispatcher<{ update: boolean }>()

  const uniqueID = Math.floor(Math.random() * 100)

  function handleClick(event: MouseEvent) {
    const target = event.target as HTMLButtonElement

    const state = target.getAttribute('aria-checked')

    checked = state === 'true' ? false : true

    dispatch('update', checked)
  }
</script>

<div class="s s--slider" style="font-size:{fontSize}px; --accent-color: {color}">
  {#if !reverse && label}
    <span id={`switch-${uniqueID}`}>{label}</span>
  {/if}

  <button
    role="switch"
    aria-checked={checked}
    aria-labelledby={`switch-${uniqueID}`}
    on:click={handleClick}
  >
  </button>

  {#if reverse && label}
    <span id={`switch-${uniqueID}`}>{label}</span>
  {/if}
</div>

<style>
  :root {
    --gray: #ccc;
  }

  /* Slider Design Option */

  .s--slider {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
  }

  .s--slider button {
    width: 3em;
    height: 1.6em;
    position: relative;
    margin: 0;
    background: var(--gray);
    border: none;
  }

  .s--slider button::before {
    content: '';
    position: absolute;
    width: 1.3em;
    height: 1.3em;
    background: #fff;
    top: 0.13em;
    right: 1.5em;
    transition: transform 0.3s;
  }

  .s--slider button[aria-checked='true'] {
    background-color: var(--accent-color);
  }

  .s--slider button[aria-checked='true']::before {
    transform: translateX(1.3em);
    transition: transform 0.3s;
  }

  .s--slider button:focus {
    box-shadow: 0 0px 0px 1px var(--accent-color);
  }

  /* Slider Design Option */
  .s--slider button {
    border-radius: 1.5em;
  }

  .s--slider button::before {
    border-radius: 100%;
  }

  .s--slider button:focus {
    border-radius: 1.5em;
  }
</style>
