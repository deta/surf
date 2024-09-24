<script lang="ts" context="module">
  export type OnboardingEvents = {
    close: void
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import overviewDemoFull from '../../../../public/assets/demo/overview-demo-full.gif'
  import ResourceOverlay from './ResourceOverlay.svelte'

  export let title: string
  export let tip: string
  export let sections: Array<{
    title: string
    description: string
    hint?: string
    imgSrc: string
    imgAlt: string
  }>
  export let warning: string | null = null
  export let buttonText: string = 'Continue'

  const dispatch = createEventDispatcher<OnboardingEvents>()
</script>

{#if title && sections}
  <div
    class="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black/50 rounded-xl backdrop-blur-sm select-none text-white text-lg gap-12 px-24"
    style="z-index: 2147483647;"
  >
    <div class="gap-4 flex flex-col items-center max-w-md">
      <h1 class="text-2xl font-bold">{title}</h1>
      <p class="opacity-70 text-center">{tip}</p>
    </div>

    <div class="flex flex-col gap-10 w-full max-w-md">
      {#each sections as section}
        <ResourceOverlay>
          <div class="flex items-start gap-4" slot="content">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="w-12 h-12"
            >
              <rect width="32" height="32" rx="8" fill="#F0F0F0" />
              <circle cx="8" cy="16" r="4" fill="#FFD700" />
              <rect x="14" y="10" width="6" height="12" rx="2" fill="#000" />
              <rect x="22" y="10" width="6" height="12" rx="2" fill="#000" />
              <path
                d="M20 16C20 14.8954 20.8954 14 22 14H26C27.1046 14 28 14.8954 28 16V20C28 21.1046 27.1046 22 26 22H22C20.8954 22 20 21.1046 20 20V16Z"
                fill="#00BFFF"
              />
            </svg>
            <div class="flex-1 flex-grow">
              <h2 class="font-semibold">{section.title}</h2>
              <div>{@html section.description}</div>
              {#if section.hint}
                <p class="opacity-70">{section.hint}</p>
              {/if}
            </div>
          </div>

          <div slot="caption">
            <img src={overviewDemoFull} class="w-80 h-80 object-contain" alt={section.imgAlt} />
          </div>
        </ResourceOverlay>
      {/each}
    </div>

    {#if warning}
      <p class="opacity-70 text-center max-w-md">{warning}</p>
    {/if}

    <button
      class="bg-sky-500 text-white py-2 px-4 rounded-2xl max-w-md"
      on:click={() => dispatch('close')}>{buttonText}</button
    >
  </div>
{/if}
