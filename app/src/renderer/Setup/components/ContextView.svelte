<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import Button from './Button.svelte'
  import LeftPanel from './LeftPanel.svelte'
  import RightPanel from './RightPanel.svelte'
  import { Icon } from '@horizon/icons'
  import { fade, fly } from 'svelte/transition'
  import { Persona } from './personas'
  import SpaceIcon from '@horizon/core/src/lib/components/Atoms/SpaceIcon.svelte'
  import { OasisSpace, useOasis } from '@horizon/core/src/lib/service/oasis'
  import type { SpaceIconChange } from '@horizon/core/src/lib/components/Oasis/IconSelector.svelte'
  import { useLogScope } from '@deta/utils'
  import DemoContexts from './DemoContexts.svelte'
  import { get } from 'svelte/store'

  export let selectedPersonas: string[]

  const dispatch = createEventDispatcher()
  const log = useLogScope('ContextView')
  const oasis = useOasis()

  let showContent = false
  let showButton = false

  let space: OasisSpace | undefined = undefined
  let contextName = ''
  let contextEmoji = ''
  let contextColors: [string, string] = ['#76E0FF', '#4EC9FB']
  let contextImage: string | null = null

  const handleContinue = async () => {
    log.debug('Creating context', { contextName, contextEmoji, contextColors, contextImage })

    if (space.dataValue.default) {
      await space.updateData({
        folderName: contextName,
        emoji: contextEmoji,
        colors: contextColors,
        imageIcon: contextImage,
        useAsBrowsingContext: true
      })

      log.debug('Updated default context', space)
    } else {
      const newContext = await oasis.createSpace({
        folderName: contextName,
        emoji: contextEmoji,
        colors: contextColors,
        imageIcon: contextImage,
        default: true,
        pinned: true,
        useAsBrowsingContext: true
      })

      log.debug('Created new context', newContext)
    }

    dispatch('viewChange', 'language')
  }

  const handleBack = () => {
    dispatch('back')
  }

  const handleSpaceIconUpdate = (event: CustomEvent<SpaceIconChange>) => {
    log.debug('Changed icon', event.detail)
    const { colors: updatedColors, emoji, imageIcon } = event.detail
    if (updatedColors) {
      contextColors = updatedColors
    } else {
      contextColors = undefined
    }

    contextEmoji = emoji ?? null
    contextImage = imageIcon ?? null
  }

  onMount(() => {
    if (selectedPersonas.includes(Persona.Student)) {
      contextName = 'Study'
      contextEmoji = '🏫'
    } else if (selectedPersonas.includes(Persona.Researcher)) {
      contextName = 'Research'
      contextEmoji = '🔬'
    } else if (selectedPersonas.includes(Persona.SoftwareEngineer)) {
      contextName = 'Development'
      contextEmoji = '💻'
    } else if (selectedPersonas.includes(Persona.Designer)) {
      contextName = 'Design'
      contextEmoji = '🎨'
    } else if (selectedPersonas.includes(Persona.Marketing)) {
      contextName = 'Marketing'
      contextEmoji = '📈'
    } else if (selectedPersonas.includes(Persona.Artist)) {
      contextName = 'Art'
      contextEmoji = '🎨'
    } else if (selectedPersonas.includes(Persona.Writer)) {
      contextName = 'Writing'
      contextEmoji = '📝'
    } else if (selectedPersonas.includes(Persona.Entrepreneur)) {
      contextName = 'Entrepreneurship'
      contextEmoji = '💼'
    } else if (selectedPersonas.includes(Persona.ProductManager)) {
      contextName = 'Product Management'
      contextEmoji = '📥'
    } else {
      contextName = 'Personal'
      contextEmoji = '🏠'
    }

    const defaultSpace = get(oasis.spaces).find((s) => s.dataValue.default)
    if (defaultSpace) {
      log.debug('Found default space', defaultSpace)
      space = defaultSpace

      const data = defaultSpace.dataValue
      contextName = data.folderName
      contextEmoji = data.emoji
      contextColors = data.colors
      contextImage = data.imageIcon
    } else {
      space = oasis.createFakeSpace({
        folderName: contextName,
        emoji: contextEmoji
      })
    }

    showContent = true
    setTimeout(() => {
      showButton = true
    }, 600)
  })
</script>

<LeftPanel>
  <div class="wrapper">
    <button on:click={handleBack} class="back-button" aria-label="Go back">
      <Icon name="arrow.left" size="28" color="#3B82F6" />
    </button>
    {#if showContent}
      <div in:fly={{ x: 35, duration: 500, delay: 150 }}>
        <h1>Create your first Context</h1>
      </div>
      <div in:fly={{ x: 35, duration: 500, delay: 300 }}>
        <p>
          Surf can help you manage your tabs, links and files based on the contexts you work in.
        </p>

        <p>
          We have created the first context for you. Make it your own by changing the name and icon
          on the right.
        </p>

        <p>Later you can create more for different topics, projects or areas of your life.</p>
      </div>
    {/if}
    <div class="actions bottom">
      {#if showButton}
        <div in:fade={{ duration: 300 }}>
          <Button on:click={handleContinue} disabled={!contextName}>Continue</Button>
        </div>
      {/if}
    </div>
  </div>
</LeftPanel>

<RightPanel>
  <div class="demo-wrapper">
    <DemoContexts
      bind:space
      bind:contextName
      bind:contextEmoji
      bind:contextColors
      bind:contextImage
      on:iconUpdate={handleSpaceIconUpdate}
    />
  </div>
</RightPanel>

<style lang="scss">
  .back-button {
    background: none;
    border: none;

    padding: 4px;
    margin-bottom: 20px;

    &:hover {
      opacity: 0.8;
    }
  }

  h1 {
    font-size: 2.5rem;
    line-height: 1.33;
    font-weight: 400;
    color: #333;
    margin-top: 0.75rem;
    margin-bottom: 2rem;
    text-wrap: balance;
    letter-spacing: -0.005rem;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  p {
    font-family: 'Inter', sans-serif;
    font-size: 1.25rem;
    line-height: 1.5;
    color: #666;
    margin-bottom: 1rem;
    text-wrap: pretty;

    &.faded {
      font-size: 1rem;
      font-weight: 400;
      letter-spacing: 0.225px;
      color: #888;
    }
  }

  .actions {
    margin-top: 2rem;
  }

  .wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .bottom {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    bottom: 0;
    width: 100%;

    button {
      width: 100% !important;
    }
  }

  .demo-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
</style>
