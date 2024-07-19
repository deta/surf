<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { writable } from 'svelte/store'
  import { fly } from 'svelte/transition'
  import { tooltip } from '@svelte-plugins/tooltips'

  import { Icon } from '@horizon/icons'
  import { ResourceTypes, type ResourceDataPost } from '@horizon/types'

  import type {
    AIChatMessageSource,
    AIChatMessageParsed,
    PageMagic,
    PageMagicResponse,
    PageHighlight
  } from './types'
  import ChatMessage from './ChatMessage.svelte'
  import { useClipboard } from '../../utils/clipboard'
  import { useLogScope } from '../../utils/log'
  import { ResourceManager, type ResourceLink } from '../../service/resources'
  import { PromptIDs } from '../../service/prompts'

  export let inputValue = ''
  export let magicPage: PageMagic

  const log = useLogScope('MagicSidebar')

  const dispatch = createEventDispatcher<{
    highlightText: { tabId: string; text: string }
    highlightWebviewText: { resourceId: string; answerText: string; sourceHash?: string }
    seekToTimestamp: { resourceId: string; timestamp: number }
    clearChat: {}
    navigate: { url: string }
    saveText: string
    chat: string
    prompt: PromptIDs
  }>()
  const { copy, copied } = useClipboard()

  const savedResponse = writable(false)

  const saveResponseOutput = async (response: PageMagicResponse) => {
    const div = document.createElement('div')
    div.innerHTML = response.content
    const text = div.textContent || div.innerText || ''

    dispatch('saveText', text)

    savedResponse.set(true)
    setTimeout(() => {
      savedResponse.set(false)
    }, 2000)
  }

  const populateRenderAndChunkIds = (sources: AIChatMessageSource[] | undefined) => {
    if (!sources) return
    sources.forEach((source, idx) => {
      source.render_id = (idx + 1).toString()
      source.all_chunk_ids = [source.id]
    })
    return sources
  }

  const handleCitationClick = async (
    sourceId: string,
    answerText: string,
    message: AIChatMessageParsed,
    sourceHash?: string
  ) => {
    log.debug('Citation clicked', sourceId, message)
    const source = (message.sources ?? []).find((s) => s.id === sourceId)
    if (!source) return
    let resourceManager = new ResourceManager(null)

    const resource = await resourceManager.getResource(source.resource_id)
    if (!resource) return

    if (
      resource.type === ResourceTypes.LINK ||
      resource.type === ResourceTypes.ARTICLE ||
      resource.type.startsWith(ResourceTypes.POST)
    ) {
      if (resource.type === ResourceTypes.POST_YOUTUBE && source.metadata?.timestamp) {
        const timestamp = source.metadata.timestamp
        dispatch('seekToTimestamp', { resourceId: resource.id, timestamp: timestamp })
      } else {
        dispatch('highlightWebviewText', {
          resourceId: resource.id,
          answerText: answerText,
          sourceHash: sourceHash
        })
      }
    }
  }

  const handleChatSubmit = async () => {
    if (!inputValue) return

    dispatch('chat', inputValue)
  }

  const handlePromptClick = async (promptType: PromptIDs) => {
    log.debug('Prompt clicked', promptType)

    dispatch('prompt', promptType)
  }

  // HACK: Right now the saved chat doesn't store the query we provide, it only stores the raw message content. For system messages we don't want to display our long prompts.
  const sanitizeQuery = (raw: string) => {
    const query = raw.toLowerCase()
    if (query.includes('summary')) {
      return 'Page Summary'
    } else if (query.includes('table of content')) {
      return 'Table of Contents'
    } else if (query.includes('translate')) {
      return 'Translate Page'
    } else {
      return raw
    }
  }
</script>

<div class="flex flex-col gap-4 overflow-hidden p-4 h-full">
  <div class="header">
    <div class="title">
      <Icon name="message" size="28px" />
      <h1>Chat</h1>
    </div>

    {#if !magicPage.running && magicPage.responses.length >= 1}
      <button
        on:click={() => {
          magicPage.responses = []
          dispatch('clearChat', {})
        }}
      >
        Clear
      </button>
    {/if}
  </div>

  <div class="content">
    {#each magicPage.responses as response, idx}
      {#if response.status === 'success'}
        <div class="output">
          <div class="output-header">
            <div class="input">
              <div class="icon">
                {#if response.role === 'user'}
                  <Icon name="user" size="20px" />
                {:else}
                  <Icon name="sparkles" size="20px" />
                {/if}
              </div>
              <p class="query">
                {#if response.role === 'user'}
                  {response.query}
                {:else}
                  {sanitizeQuery(response.query)}
                {/if}
              </p>
            </div>

            <div class="output-actions">
              <button
                on:click={() => copy(response.content)}
                use:tooltip={{
                  content: 'Copy to Clipboard',
                  action: 'hover',
                  position: 'left',
                  animation: 'fade',
                  delay: 500
                }}
              >
                {#if $copied}
                  <Icon name="check" />
                {:else}
                  <Icon name="copy" />
                {/if}
              </button>

              <button
                on:click={() => saveResponseOutput(response)}
                use:tooltip={{
                  content: 'Save to Oasis',
                  action: 'hover',
                  position: 'left',
                  animation: 'fade',
                  delay: 500
                }}
              >
                {#if $savedResponse}
                  <Icon name="check" />
                {:else}
                  <Icon name="leave" />
                {/if}
              </button>
            </div>
          </div>

          <ChatMessage
            content={response.content}
            sources={populateRenderAndChunkIds(response.sources)}
            on:citationClick={(e) =>
              handleCitationClick(
                e.detail.citationID,
                e.detail.text,
                response,
                e.detail.sourceHash
              )}
            showSourcesAtEnd={true}
          />
        </div>
      {:else if response.status === 'pending'}
        <div class="output">
          <div class="output-header">
            <div class="input">
              <Icon name="spinner" />
              <p>{response.query}</p>
              <!-- {#if response.role === 'user'}
                <p>{response.query}</p>
              {:else}
                <p>Generating Page Summary…</p>
              {/if} -->
            </div>
          </div>
        </div>
      {:else if response.status === 'error'}
        <div class="output">
          {response.content}
        </div>
      {/if}
    {/each}
  </div>

  <!--
  {#if !magicPage.running}
    <div class="prompts" transition:fly={{ y: 120 }}>
      <button on:click={() => handlePromptClick(PromptIDs.PAGE_SUMMARIZER)}>
        Summarize Page
      </button>
      <button on:click={() => handlePromptClick(PromptIDs.PAGE_TOC)}> Table of Contents </button>
      <button on:click={() => handlePromptClick(PromptIDs.PAGE_TRANSLATOR)}>
        Translate Page
      </button>
    </div>
  {/if}
  -->

  <form on:submit|preventDefault={handleChatSubmit} class="chat">
    <input bind:value={inputValue} placeholder="Ask your tabs…" />

    <button disabled={magicPage.responses.length > 1 && magicPage.running} class="" type="submit">
      {#if magicPage.responses.length > 1 && magicPage.running}
        <Icon name="spinner" />
      {:else}
        <Icon name="arrow.right" />
      {/if}
    </button>
  </form>
</div>

<style lang="scss">
  .content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    overflow: auto;
    padding-bottom: 4rem;
  }

  .chat {
    padding: 0.5rem;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .chat button {
    appearance: none;
    border: none;
    background: #f73b95;
    color: #fff;
    border-radius: 8px;
    padding: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    button {
      flex-shrink: 0;
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      background: #fff;
      color: #353535;
      cursor: pointer;
      font-size: 1rem;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      transition: background 0.2s;

      &:hover {
        background: #f6f5ef;
      }
    }
  }

  .title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #2b2715;
    white-space: nowrap;

    h1 {
      font-size: 1.5rem;
      font-weight: 500;
    }
  }

  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-radius: 8px;
    color: #3f3f3f;

    p {
      flex: 1;
      font-size: 1rem;
      font-weight: 500;
      color: #3f3f3f;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .output-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .input {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
    opacity: 0.75;
  }

  .icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .query {
    flex: 1;
    // truncate with ellipses after two lines
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .output-actions {
    display: flex;
    align-items: center;
    gap: 10px;

    button {
      appearance: none;
      border: none;
      background: none;
      cursor: pointer;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 1 !important;
      }
    }
  }

  .output {
    padding: 15px;
    background: rgb(255, 255, 255);
    border-radius: 8px;
    font-size: 1.1rem;
    color: #3f3f3f;
    display: flex;
    flex-direction: column;
    gap: 10px;

    &:hover .output-actions button {
      opacity: 0.5;
    }
  }

  .output-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  input {
    width: 100%;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 5px;
    font-size: 1rem;
    background-color: #fff;
    color: #3f3f3f;

    &:hover {
      background: #eeece0;
    }

    &:focus {
      outline: none;
      border-color: #f73b95;
      color: #000;
      background-color: #ffffff;
    }
  }

  .prompts {
    position: absolute;
    bottom: 4.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 15px 0;
    overflow-x: auto;
    // linear gradient from bottom background color to transparent top
    background: linear-gradient(180deg, transparent, #eeece0);

    button {
      flex-shrink: 0;
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      background: #fff;
      color: #353535;
      cursor: pointer;
      font-size: 1rem;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      transition: background 0.2s;

      &:hover {
        background: #f6f5ef;
      }
    }
  }

  :global(.chat-message-content h2) {
    font-size: 1.4rem;
    margin-top: 0.5rem !important;
    margin-bottom: 0.5rem !important;
  }
</style>
