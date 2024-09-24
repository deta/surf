<script lang="ts" context="module">
  export type OnboardingEvents = {
    close: void
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import overviewDemoFull from '../../../../public/assets/demo/overview-demo-full.gif'
  import ResourceOverlay from './ResourceOverlay.svelte'
  import { Icon } from '@horizon/icons'

  export let title: string
  export let tip: string
  export let sections: Array<{
    title?: string
    description: string
    hint?: string
    icon?: string
    imgSrc: string
    imgAlt: string
  }>
  export let warning: string | null = null
  export let buttonText: string = 'Continue'

  const dispatch = createEventDispatcher<OnboardingEvents>()
</script>

{#if title && sections}
  <div
    class="absolute top-0 left-0 w-full h-full flex border border-gray-300 border-opacity-25 shadow-md shadow-gray-200 flex-col items-center justify-center bg-white/95 rounded-xl backdrop-blur-sm select-none text-lg gap-8 px-24"
    style="z-index: 2147483647;"
  >
    <div class="gap-4 flex flex-col items-center max-w-md">
      <h1 class="text-2xl font-bold">{title}</h1>
      <p class="opacity-70 text-center">{tip}</p>
    </div>

    <div
      class="flex flex-col gap-10 w-full max-w-md border-t-[0.07rem] border-t-[rgba(0,0,0,0.15)] pt-8"
    >
      {#each sections as section}
        <ResourceOverlay>
          <div class="flex items-start gap-4" slot="content">
            {#if section.icon}
              {@html section.icon}
            {:else}
              <div
                class="relative w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center font-semibold text-xl"
              >
                <Icon name="add" />
              </div>
            {/if}
            <div class="flex-1 flex-grow">
              {#if section.title}
                <h2 class="font-semibold">{section.title}</h2>
              {/if}
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
      class="bg-[#2497e9] text-white py-2 px-4 rounded-[8px] max-w-md"
      on:click={() => dispatch('close')}>{buttonText}</button
    >
  </div>
{/if}
