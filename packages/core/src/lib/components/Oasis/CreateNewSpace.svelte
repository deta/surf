<script lang="ts">
  import { Icon } from '@horizon/icons'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { writable } from 'svelte/store'
  import { createEventDispatcher } from 'svelte'
  import { Editor } from '@horizon/editor'
  import { fly } from 'svelte/transition'
  import { quartOut } from 'svelte/easing'

  import { colorPairs } from '../../service/oasis'
  import ResourceOverlay from '../Core/ResourceOverlay.svelte'

  const aiEnabled = writable(false)
  const name = writable('')
  const userPrompt = writable('<p></p>')
  const colors = writable(colorPairs[Math.floor(Math.random() * colorPairs.length)])
  const dispatch = createEventDispatcher()
  const userEnteredName = writable(false)
  let editor: Editor

  const templatePrompts = [
    { name: 'Screenshots', prompt: 'All my Screenshots' },
    { name: 'Articles', prompt: 'Articles about...' },
    { name: 'Notion Documents', prompt: 'All my Notion Documents' },
    { name: 'YouTube Videos', prompt: 'Youtube Videos I watched' },
    { name: 'PDFs', prompt: 'Every PDF' }
  ]

  $: aiEnabled.set($userPrompt !== '<p></p>')

  const newSpace = () => {
    const now = new Date().toISOString()
    return {
      id: 'new',
      name: {
        folderName: 'New Space',
        colors: $colors,
        showInSidebar: true,
        sources: [],
        liveModeEnabled: false,
        hideViewed: false,
        smartFilterQuery: null,
        sortBy: 'created_at'
      },
      created_at: now,
      updated_at: now,
      deleted: 0
    }
  }

  const handleCloseModal = () => {
    dispatch('close-modal')
  }

  const handleColorChange = async (event: CustomEvent<[string, string]>) => {
    colors.set(event.detail)
  }

  const handleSubmit = () => {
    const sanitizedUserPrompt = $userPrompt.replace(/<\/?[^>]+(>|$)/g, '')

    dispatch('submit', {
      name: $name,
      aiEnabled: $aiEnabled,
      colors: $colors,
      userPrompt: sanitizedUserPrompt
    })
    dispatch('close-modal')
  }

  const handleTemplatePromptClick = (template: { name: string; prompt: string }) => {
    userPrompt.set(`<p>${template.prompt}</p>`)
    editor.setContent($userPrompt)
    aiEnabled.set(true)
    if (!$userEnteredName || templatePrompts.some((t) => t.name === $name)) {
      name.set(template.name)
    }
  }

  const handleNameInput = () => {
    if ($name === '') {
      userEnteredName.set(false)
    } else {
      userEnteredName.set(true)
    }
  }

  const handleEditorUpdate = (event) => {
    userPrompt.set(event.detail)
  }
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === 'Escape') {
      handleCloseModal()
    } else if (e.key === 'Enter') {
      if ($name.length > 0) {
        handleSubmit()
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
  }}
/>

<div class="centered-content">
  <ResourceOverlay caption="Click to change color.">
    <div slot="content" class="space-icon-wrapper transform active:scale-[98%]">
      <SpaceIcon on:change={handleColorChange} folder={newSpace()} />
    </div>
  </ResourceOverlay>
  <div class="input-group">
    <div class="input-wrapper">
      <input
        type="text"
        class="folder-name"
        id="folder-name"
        name="folder-name"
        placeholder="Enter Space Name"
        bind:value={$name}
        on:input={handleNameInput}
        tabindex="0"
        autofocus
        on:keydown={(e) => {
          if (e.key === 'Tab') {
            e.stopPropagation()
            e.stopImmediatePropagation()
          }
        }}
      />
    </div>
    <div class="ai-voodoo bg-white px-12 pt-8 pb-12 mb-16 mt-4 rounded-xl relative">
      {#if $aiEnabled}
        <div
          class="ai-description"
          transition:fly={{
            y: 20,
            duration: 420,
            opacity: 0,
            easing: quartOut
          }}
        >
          <span
            >Surf will now automatically add content to your space that matches your description.</span
          >
          <Icon name="sparkles.fill" size="22px" color="#29A6F3" />
        </div>
      {/if}
      <div class="input-wrapper">
        <div class="folder-rules">
          <Editor
            bind:this={editor}
            content={$userPrompt}
            on:update={handleEditorUpdate}
            placeholder="Describe what you want in your space. (optional)"
            tabindex="1"
            autofocus={false}
            on:keydown={(e) => {
              if (e.key === 'Tab') {
                e.stopPropagation()
                e.stopImmediatePropagation()
              }
            }}
          />
        </div>
      </div>

      <div class="template-prompts">
        <div class="prompt-pills mt-8 mb-4">
          {#each templatePrompts as template}
            <button
              class={`prompt-pill ${
                $userPrompt === `<p>${template.prompt}</p>`
                  ? 'bg-blue-200 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              } rounded-full px-4 py-2 text-sm font-medium hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              on:click={() => handleTemplatePromptClick(template)}
            >
              {template.prompt}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
  <div class="button-group">
    <button on:click={handleCloseModal} class="cancel-button">Cancel</button>
    <button on:click={handleSubmit} class="create-button">Create</button>
  </div>
</div>

<style lang="scss">
  .centered-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    width: 100%;
    background: #f6faff;
    background: color(display-p3 0.9661 0.9801 1);
  }

  h2 {
    margin: 0 0 2rem;
    font-size: 1.25rem;
    font-weight: 500;
    color: #28568f;
    opacity: 0.4;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .space-icon-wrapper {
    width: 16rem;
    height: 16rem;
    margin-bottom: 2rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 2rem;
  }

  .input-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    width: 28rem;
    margin-bottom: 1rem;
  }

  .folder-name {
    font-size: 1.25rem;
    background: transparent;
    font-weight: 500;
    min-width: 25rem;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    border: none;
    padding: 0.5rem;
    width: 100%;
    color: #28568f;
    transition: border-color 0.3s;
    text-align: center;

    &::placeholder {
      color: rgba(40, 86, 143, 0.4);
      text-align: center;
    }

    &:focus {
      outline: none;
    }
  }

  .folder-rules {
    font-size: 1.25rem;
    background: transparent;
    font-weight: 500;
    min-width: 25rem;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    border: none;
    padding: 0.5rem;
    width: 100%;
    color: #28568f;
    transition: border-color 0.3s;
    text-align: left;

    &::placeholder {
      color: rgba(40, 86, 143, 0.4);
      text-align: left;
    }

    &:focus {
      outline: none;
    }
  }

  .ai-description {
    position: absolute;
    bottom: -32px;
    right: 50%;
    transform: translateX(50%) rotate(0.75deg);
    display: flex;
    align-items: center;
    gap: 2rem;
    opacity: 0.6;
    width: 100%;
    max-width: 24rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: #28568f;
    text-align: left;
    padding: 0.5rem 0 0.5rem 1rem;
    background-color: #e1f0ff;
    border-radius: 8px;
    border: 0.5px solid rgba(41, 128, 185, 0.2);
    box-shadow:
      0 1px 2px rgba(186, 230, 253, 0.9),
      0 2px 4px rgba(186, 230, 253, 0.8),
      0 4px 8px rgba(186, 230, 253, 0.7),
      0 8px 16px rgba(186, 230, 253, 0.9);
    span {
      width: 80%;
    }
  }

  .button-group {
    display: flex;
    justify-content: center;
    gap: 1rem;
  }

  .cancel-button,
  .create-button {
    font-weight: 500;
    font-size: 1.125rem;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    padding: 1rem 1.5rem;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: background-color 0.3s;
  }

  .cancel-button {
    background-color: #fff;
    color: #28568f;
  }

  .cancel-button:hover {
    background-color: #d1edff;
    color: #173861;
  }

  .create-button {
    background-color: #47b1f3;
    color: #fff;
  }

  .create-button:hover {
    background-color: #29a6f3;
  }

  .template-prompts {
    width: 28rem;
    margin-top: 1rem;
  }

  .template-prompts h3 {
    font-size: 1rem;
    font-weight: 500;
    color: #28568f;
    margin-bottom: 0.5rem;
  }

  .prompt-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 0.75rem;
    max-width: 28rem;
    justify-content: flex-start;
  }

  .prompt-pill {
    background-color: #e1f0ff;
    color: #28568f;
    border: none;
    border-radius: 20px;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.3s;
    flex: 0 1 auto;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(50% - 0.25rem);

    &:hover {
      background-color: #c1e0ff;
    }
  }
</style>
