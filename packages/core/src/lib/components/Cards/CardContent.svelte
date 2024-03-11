<!-- <svelte:options immutable={true} /> -->

<script lang="ts">
  import { SvelteComponent } from 'svelte'
  import { type Writable } from 'svelte/store'

  import { type IPositionable, LazyComponent } from '@horizon/tela'

  import type { Card } from '../../types/index'
  import type { Horizon } from '../../service/horizon'
  import type { MagicFieldParticipant } from '../../service/magicField'

  // TODO: fix this unnecessary cast
  const BrowserCard = () =>
    import('../Cards/Browser/BrowserCard.svelte') as unknown as Promise<typeof SvelteComponent>
  const TextCard = () =>
    import('../Cards/Text/TextCard.svelte') as unknown as Promise<typeof SvelteComponent>
  const LinkCard = () =>
    import('../Cards/Link/LinkCard.svelte') as unknown as Promise<typeof SvelteComponent>
  const FileCard = () =>
    import('../Cards/File/FileCard.svelte') as unknown as Promise<typeof SvelteComponent>
  const AITextCard = () =>
    import('../Cards/Smart/AITextCard.svelte') as unknown as Promise<typeof SvelteComponent>
  const AudioTranscriber = () =>
    import('../Cards/Smart/AudioTranscriber.svelte') as unknown as Promise<typeof SvelteComponent>

  export let positionable: Writable<IPositionable<any>>
  export let horizon: Horizon
  export let magicFieldParticipant: MagicFieldParticipant | null = null

  $: card = positionable as Writable<Card> // todo: fix this unnecessary cast
  $: activeCardId = horizon.activeCardId
  $: active = $activeCardId === $card.id
</script>

{#if $card.type === 'browser'}
  <LazyComponent this={BrowserCard}>
    <svelte:fragment slot="component" let:Component>
      <Component {card} {horizon} {active} {magicFieldParticipant} on:load on:change on:delete />
    </svelte:fragment>
  </LazyComponent>
{:else if $card.type === 'text'}
  <LazyComponent this={TextCard}>
    <svelte:fragment slot="component" let:Component>
      <Component
        {card}
        {active}
        {magicFieldParticipant}
        resourceManager={horizon.resourceManager}
        on:load
        on:change
        on:delete
      />
    </svelte:fragment>
  </LazyComponent>
{:else if $card.type === 'link'}
  <LazyComponent this={LinkCard}>
    <svelte:fragment slot="component" let:Component>
      <Component {card} {horizon} {active} on:load on:change on:delete />
    </svelte:fragment>
  </LazyComponent>
{:else if $card.type === 'file'}
  <LazyComponent this={FileCard}>
    <svelte:fragment slot="component" let:Component>
      <Component {card} {horizon} {active} {magicFieldParticipant} on:load on:change on:delete />
    </svelte:fragment>
  </LazyComponent>
{:else if $card.type === 'ai-text'}
  <LazyComponent this={AITextCard}>
    <svelte:fragment slot="component" let:Component>
      <Component {card} {horizon} {active} on:load on:change on:delete />
    </svelte:fragment>
  </LazyComponent>
{:else if $card.type === 'audio-transcriber'}
  <LazyComponent this={AudioTranscriber}>
    <svelte:fragment slot="component" let:Component>
      <Component {card} {horizon} {active} on:load on:change on:delete />
    </svelte:fragment>
  </LazyComponent>
{/if}

<style lang="scss">
</style>
