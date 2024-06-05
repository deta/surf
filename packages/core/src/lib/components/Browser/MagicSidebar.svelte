<script lang="ts">
  import { Icon } from '@horizon/icons'
  import type { PageMagic, PageMagicResponse } from './types'
  import { useClipboard } from '../../utils/clipboard'
  import ChatMessage from './ChatMessage.svelte'
  import { useLogScope } from '../../utils/log'
  import { createEventDispatcher } from 'svelte'
  import { writable } from 'svelte/store'

  export let inputValue = ''
  export let magicPage: PageMagic

  const log = useLogScope('MagicSidebar')

  const dispatch = createEventDispatcher<{
    highlightText: { tabId: string; text: string }
    saveText: string
    chat: string
  }>()
  const { copy, copied } = useClipboard()

  const savedResponse = writable(false)

  const saveResponseOutput = async (response: PageMagicResponse) => {
    dispatch('saveText', response.content)

    savedResponse.set(true)
    setTimeout(() => {
      savedResponse.set(false)
    }, 2000)
  }

  const handleCitationClick = (citationId: string, idx: number) => {
    log.debug('Citation clicked', citationId)
    const citation = magicPage.responses[idx]?.citations[citationId]
    if (!citation) {
      log.error('Citation not found', citationId)
      return
    }

    dispatch('highlightText', { tabId: magicPage.tabId, text: citation.text })
  }

  const handleChatSubmit = async () => {
    if (!inputValue) return

    dispatch('chat', inputValue)
  }
</script>

<div class="wrapper">
  <div class="header">
    <div class="title">
      <Icon name="file-text-ai" size="28px" />
      <h1>Page Chat</h1>
    </div>

    <!-- <button
        class="sidebar-reload"
        on:click={() => summarizePage($activeTabMagic)}
        use:tooltip={{
          content: 'Refresh Page Summary',
          action: 'hover',
          position: 'left',
          animation: 'fade',
          delay: 500
        }}
      >
        <Icon name="reload" size="20px" />
      </button> -->
  </div>

  <div class="content">
    {#each magicPage.responses as response, idx (response.id)}
      {#if response.status === 'success'}
        <div class="output">
          <div class="output-header">
            <div class="input">
              {#if response.role === 'user'}
                <Icon name="message" />
              {:else}
                <Icon name="sparkles" />
              {/if}
              <p>{response.query}</p>
            </div>

            <div class="output-actions">
              <button on:click={() => copy(response.content)}>
                {#if $copied}
                  <Icon name="check" />
                {:else}
                  <Icon name="copy" />
                {/if}
              </button>

              <button on:click={() => saveResponseOutput(response)}>
                {#if $savedResponse}
                  <Icon name="check" />
                {:else}
                  <Icon name="quote" />
                {/if}
              </button>
            </div>
          </div>

          <ChatMessage
            content={response.content}
            on:citationClick={(e) => handleCitationClick(e.detail, idx)}
          />
        </div>
      {:else if response.status === 'pending'}
        <div class="status">
          <Icon name="spinner" />
          {#if response.role === 'user'}
            <p>{response.query}</p>
          {:else}
            <p>Generating Page Summary…</p>
          {/if}
        </div>
      {:else if response.status === 'error'}
        <div class="output">
          {response.content}
        </div>
      {/if}
    {/each}
  </div>

  <form on:submit|preventDefault={handleChatSubmit} class="chat">
    <input bind:value={inputValue} placeholder="Ask about the page…" />

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
  .wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: hidden;
    padding-top: 2rem;
    height: 100%;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    overflow: auto;
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
    opacity: 0.75;
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
    background: #f6f5ef;
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
    padding: 10px 100px 10px 10px;
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
</style>
