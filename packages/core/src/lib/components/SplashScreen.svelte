<script lang="ts">
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'

  let done = false
  onMount(() => {
    setTimeout(() => {
      done = true
    }, 1000)
  })
</script>

{#if !done}
  <div class="splash" transition:fade={{ duration: 150 }}>
    <svg
      id="Ebene_1"
      data-name="Ebene 1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 102.36 99.88"
      style="margin-top:40%;"
      width="90px"
      height="90px"
    >
      <defs>
        <style>
          .cls-1 {
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-width: 5px;
          }
        </style>
      </defs>
      <g id="_1AWJB8.tif" data-name="1AWJB8.tif">
        <g>
          <path
            class="cls-1"
            d="M73.46,58.94c7.08.18,12.8-3.02,17.75-7.6,3.64-3.36,6.52-7.48,7.85-12.33,1.99-7.22.41-11.87-6.91-15.34-2-.95-4.22-1.42-6.32-2.16-1.62-.57-3.26-.44-4.82.03-3.04.92-5.99,2.23-9.08,2.91-2.39.53-3.5,2.82-5.72,3.4"
          />
          <path
            class="cls-1"
            d="M70.75,24.54c-.4-1.51-.94-3-1.19-4.53-1.38-8.57-6.41-14.1-14.53-16.52-7.93-2.36-15.19-.49-21.07,5.4-4.79,4.8-5.5,10.77-3.97,17.16,1.19,4.96,4.17,8.77,7.89,12.02,1.1.96,2.04,1.99,2.98,3.07"
          />
          <path
            class="cls-1"
            d="M28.8,22.73c-1.31.36-2.65.55-3.92-.01-3.18-1.4-6.52-2.13-9.97-2.39-7.39-.57-11.3,1.79-12.21,9.06-1.21,9.63,2.98,21.94,14.34,27.1,2.15.98,4.53,1.39,6.92.64"
          />
          <path
            class="cls-1"
            d="M59.28,39.33c.92,2.03,2.62,3.3,4.54,4.2,5.52,2.61,8.14,6.84,8.9,12.97.59,4.8-1.78,7.87-4.44,10.82-4.51,5-10.69,6.79-17.14,6.87-4.32.05-9.14-.1-12.84-1.96-3.74-1.88-7.4-4.87-9.81-8.77-.83-1.35-1.86-2.58-2.69-3.94-2.32-3.77-2.02-6.84.89-10.25,2.88-3.38,6.43-5.26,10.82-6.51,5.41-1.54,10.86-1.97,16.34-2.55,5.45-.58,8.76-4.2,11.4-8.48.84-1.37,1.55-3.3-.24-4.78-1.51-1.24-1.32-2.89-1.2-4.53"
          />
          <path
            class="cls-1"
            d="M38.15,72.82c-1.24,9.94,3.12,20.22,13.63,23.68,2.01.66,4.53,1.13,6.89.76"
          />
          <path
            class="cls-1"
            d="M43.89,17.91c-3.66.15-4.15,1.3-3.72,4.84.53,4.44,1.4,8.74,2.8,12.97.56,1.69,1.87,3.16,1.52,5.12"
          />
          <path
            class="cls-1"
            d="M52.94,22.28c-.92.25-1.93.34-2.49,1.51,3.38,3.97,2.84,8.09.07,12.22-.8,1.19-1.06,2.51-.91,3.92"
          />
        </g>
      </g>
    </svg>
    <span class="ttr" style="margin-top: 1rem;">Horizon</span>
    <span class="ttr" style="margin-top: 4px; font-size: 0.9em;">by Deta</span>
  </div>
{/if}

<style>
  .splash {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
    background: white;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }
  .cls-1 {
    fill: none;
    stroke: #000;
    stroke-width: 0;
    stroke-miterlimit: 10;
    stroke-dasharray: 250;
    stroke-dashoffset: 0;
    animation: stroke-reveal 1.1s ease-out infinite;
  }
  .ttr {
    animation: title-reveal 1.1s ease-out infinite;
  }
  @keyframes stroke-reveal {
    from {
      stroke-dashoffset: 450;
      stroke: rgba(255, 255, 255, 0.4);
      stroke-width: 0;
      stroke-opacity: 0.4;
    }
    to {
      stroke-dashoffset: 0;
      stroke: rgba(0, 0, 0, 1);
      stroke-width: 5px;
      stroke-opacity: 1;
    }
  }
  @keyframes title-reveal {
    0% {
      opacity: 0;
    }
    50% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
</style>
