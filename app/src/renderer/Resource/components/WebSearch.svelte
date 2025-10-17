<script lang="ts">
  import { onMount, tick, setContext } from 'svelte'
  import { writable, type Writable } from 'svelte/store'
  import { useLogScope } from '@deta/utils/io'
  import { getHostname } from '@deta/utils'
  import { DuckDuckGoAPI } from '@deta/web-parser'
  import HeadlessCitationItem from './HeadlessCitationItem.svelte'
  import { Icon } from '@deta/icons'
  import type { LinkClickHandler } from '@deta/editor/src/lib/extensions/Link/helpers/clickHandler'

  // NOTE: created by tiptap but not needed
  export const node: any = undefined
  export const editor: any = undefined
  export const uuid: string = ''

  export let updateAttributes: (attrs: Record<string, any>) => void
  export let onWebSearchCompleted: (
    results: Array<{ title: string; url: string }>,
    query: string
  ) => void
  export let onLinkClick: LinkClickHandler
  export let name: string = 'Web Search'
  export let query: string = ''
  export let results: Array<{ title: string; url: string }> = []
  export let done: string = 'false'
  export let limit: number = 5

  const log = useLogScope('WebSearch Component')
  const searchAPI = new DuckDuckGoAPI()

  type ErrorType = 'search_error' | 'initialization' | 'network'

  interface ErrorState {
    type: ErrorType
    message: string
    userMessage: string
    canRetry: boolean
  }

  const doneSearching: Writable<boolean> = writable(done === 'true')
  const searchResults: Writable<Array<{ title: string; url: string }>> = writable(results || [])
  const searchTitle: Writable<string> = writable(name.replace('user-content-', ''))
  const error: Writable<ErrorState | null> = writable(null)
  const isSearching: Writable<boolean> = writable(false)
  const isCollapsed: Writable<boolean> = writable(true)

  let isUpdatingAttributes: boolean = false

  const setError = (
    type: ErrorType,
    message: string,
    userMessage: string,
    canRetry: boolean = true
  ) => {
    log.error(`${type}: ${message}`)
    error.set({ type, message, userMessage, canRetry })
    isSearching.set(false)
  }

  const clearError = () => {
    error.set(null)
  }

  const getUserFriendlyErrorMessage = (type: ErrorType): string => {
    switch (type) {
      case 'search_error':
        return 'Unable to perform the search right now. Please try again in a moment.'
      case 'initialization':
        return 'Something went wrong while setting up. Please refresh and try again.'
      case 'network':
        return 'Connection issue detected. Please check your internet connection and try again.'
      default:
        return 'Something unexpected happened. Please try again.'
    }
  }

  const performSearch = async (searchQuery: string = query) => {
    if (!searchQuery?.trim()) {
      setError('search_error', 'Empty search query', 'Please provide a search query.', false)
      return
    }

    clearError()
    isSearching.set(true)

    try {
      log.debug('Performing search for:', searchQuery)
      const results = await searchAPI.search(searchQuery, limit)
      log.debug('Search results:', results)
      if (!results || results.length === 0) {
        setError(
          'search_error',
          'No results found',
          'No results were found for your search query.',
          true
        )
        return
      }

      log.debug('Search completed with', results.length, 'results')

      searchResults.set(results)
      doneSearching.set(true)
      if (onWebSearchCompleted) {
        onWebSearchCompleted(results, searchQuery)
      } else {
        log.warn('onWebSearchCompleted callback not provided!')
      }
      if (!isUpdatingAttributes && updateAttributes) {
        isUpdatingAttributes = true
        try {
          updateAttributes({
            done: 'true',
            results: results,
            name: $searchTitle,
            query: searchQuery
          })
        } catch (error) {
          log.error('Error updating attributes:', error)
        } finally {
          isUpdatingAttributes = false
        }
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Search failed'
      setError('search_error', errorMessage, getUserFriendlyErrorMessage('search_error'), true)
    } finally {
      isSearching.set(false)
    }
  }

  const retryOperation = async () => {
    if (!$error) return

    clearError()

    switch ($error.type) {
      case 'search_error':
        await performSearch()
        break
      case 'initialization':
        location.reload()
        break
      default:
        await performSearch()
    }
  }

  const toggleCollapse = () => {
    isCollapsed.update((value) => !value)
  }

  $: statusText = (() => {
    if ($isSearching) return 'Searching the web...'
    if ($error) return 'Error'
    if ($doneSearching && $searchResults.length > 0) {
      const hostnames = $searchResults.map((result) => {
        const hostname = getHostname(result.url)
        return hostname ? hostname.replace('www.', '') : result.url
      })
      return `Read though ${hostnames.join(', ')}`
    }
    if ($doneSearching && $searchResults.length === 0) return 'No results'
    return 'Web search'
  })()

  onMount(async () => {
    try {
      log.debug('mounted with props:', {
        query,
        results,
        done,
        limit,
        name
      })
      await tick()
      clearError()
      if (results && results.length > 0) {
        log.debug('Setting initial search results:', results)
        searchResults.set(results)
        doneSearching.set(true)
      } else if (query && !$doneSearching) {
        await performSearch(query)
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Initialization failed'
      setError('initialization', errorMessage, getUserFriendlyErrorMessage('initialization'), true)
    }
  })
</script>

{#if $error}
  <div class="websearch-error-container">
    <div class="websearch-error-content">
      <div class="websearch-error-icon">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 class="websearch-error-title">Search Error</h3>
      <p class="websearch-error-message">{$error.userMessage}</p>
      {#if $error.canRetry}
        <button class="websearch-retry-button" on:click={retryOperation}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          Try Again
        </button>
      {/if}
    </div>
  </div>
{:else}
  <div class="websearch-container" class:expanded={!$isCollapsed}>
    <div class="websearch-header" on:click={toggleCollapse}>
      <div class="websearch-simple-row">
        <span class="websearch-status-text" class:searching={$isSearching} class:error={$error}>
          {statusText}
        </span>
        <button class="websearch-collapse-button" class:rotated={!$isCollapsed}>
          <Icon name="chevron.right" />
        </button>
      </div>
    </div>

    <div class="websearch-content" class:collapsed={$isCollapsed}>
      <div class="websearch-query-section">
        <span class="websearch-query-text">"{query}"</span>
      </div>

      <!-- Citation items shown when expanded and results exist -->
      {#if $doneSearching && $searchResults.length > 0}
        <div class="websearch-citations">
          {#each $searchResults as result, index}
            <div class="citation" on:click={(e) => onLinkClick(e, result.url)}>
              <HeadlessCitationItem url={result.url} title={result.title} maxTitleLength={40} />
            </div>
          {/each}
        </div>
      {/if}

      {#if $doneSearching && $searchResults.length === 0}
        <div class="websearch-no-results">
          <div class="websearch-no-results-icon">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <p>No results found for <strong>"{query}"</strong></p>
          <button class="websearch-retry-button" on:click={() => performSearch()}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            Try Again
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  .websearch-container {
    overflow: hidden;
    transition: all 0.2s ease;
  }

  * {
    font-family: var(--default);
  }

  .websearch-container.expanded {
    border: 1px solid light-dark(rgba(0, 0, 0, 0.1), rgba(71, 85, 105, 0.4));
    border-radius: var(--t-3);
    background: light-dark(var(--white), var(--surface-elevated-dark, #1b2435));
    box-shadow: 0 2px 8px light-dark(rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.3));
  }

  .websearch-container.expanded:hover {
    box-shadow: 0 4px 16px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.4));
  }

  .websearch-header {
    padding: var(--t-1) 0;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .websearch-container.expanded .websearch-header {
    padding: var(--t-2) var(--t-3);
    background: light-dark(var(--accent-background), var(--accent-background-dark, #1e2639));
    border-bottom: 1px solid light-dark(rgba(0, 0, 0, 0.1), rgba(71, 85, 105, 0.4));
  }

  .websearch-container.expanded .websearch-header:hover {
    background: light-dark(rgba(109, 130, 255, 0.15), rgba(129, 146, 255, 0.2));
  }

  .websearch-simple-row {
    display: flex;
    align-items: center;
    gap: var(--t-2);
  }

  .websearch-container:not(.expanded) .websearch-simple-row {
    justify-content: flex-start;
    width: fit-content;
  }

  .websearch-container.expanded .websearch-simple-row {
    justify-content: space-between;
    width: 100%;
  }

  .websearch-status-text {
    font-family: var(--default);
    font-size: var(--t-13);
    font-weight: var(--medium);
    color: light-dark(var(--on-surface, #374151), var(--on-surface-dark, #cbd5f5));
    transition: color 0.2s ease;
  }

  .websearch-container.expanded .websearch-status-text {
    flex: 1;
  }

  .websearch-citations {
    padding: var(--t-2);
    display: flex;
    flex-wrap: wrap;
    gap: var(--t-1) var(--t-2);
    align-items: center;
  }

  .websearch-status-text.searching {
    background: linear-gradient(
        90deg,
        transparent 0%,
        transparent 40%,
        #aae5ff 45%,
        45%,
        transparent 50%,
        transparent 100%
      ),
      linear-gradient(
        90deg,
        transparent 0%,
        transparent 40%,
        #c7d7fe 45%,
        transparent 50%,
        transparent 100%
      ),
      linear-gradient(
        90deg,
        transparent 0%,
        transparent 40%,
        #aae5ff 45%,
        transparent 50%,
        transparent 100%
      ),
      linear-gradient(
        90deg,
        transparent 0%,
        transparent 40%,
        #aae5ff 45%,
        transparent 50%,
        transparent 100%
      ),
      linear-gradient(
        90deg,
        transparent 0%,
        transparent 40%,
        #aae5ff 45%,
        transparent 50%,
        transparent 100%
      ),
      linear-gradient(
        90deg,
        transparent 0%,
        transparent 40%,
        var(--accent) 45%,
        transparent 50%,
        transparent 100%
      ),
      var(--accent);
    background-size:
      200% 100%,
      200% 100%,
      200% 100%,
      200% 100%,
      200% 100%,
      200% 100%,
      100% 100%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: multiSlide 60s infinite linear;
  }

  .websearch-status-text.error {
    color: #dc2626;
  }

  .websearch-collapse-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--t-1);
    color: light-dark(var(--on-surface, #374151), var(--on-surface-dark, #cbd5f5));
    transition: all 0.2s ease;
    border-radius: var(--t-1);
  }

  .websearch-collapse-button:hover {
    background: light-dark(var(--accent-background), var(--accent-background-dark, #1e2639));
    color: light-dark(var(--accent), var(--accent-dark, #8192ff));
  }

  .websearch-collapse-button.rotated {
    transform: rotate(90deg);
  }

  .websearch-query-section {
    padding: var(--t-3) var(--t-4);
    border-bottom: 1px solid light-dark(rgba(0, 0, 0, 0.1), rgba(71, 85, 105, 0.4));
    display: flex;
    align-items: center;
    gap: var(--t-2);
    font-family: var(--default);
    font-size: var(--t-13);
  }

  .citation {
    cursor: default;
  }

  .websearch-query-text {
    color: light-dark(var(--on-surface-accent), var(--accent-dark, #8192ff));
    font-weight: var(--medium);
    background: light-dark(var(--accent-background), var(--accent-background-dark, #1e2639));
    padding: var(--t-1) var(--t-2);
    border-radius: var(--t-2);
  }

  .websearch-content {
    overflow: hidden;
    transition:
      max-height 0.3s ease,
      opacity 0.3s ease;
    max-height: 1000px;
    opacity: 1;
  }

  .websearch-content.collapsed {
    max-height: 0;
    opacity: 0;
  }

  .websearch-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem;
    text-align: center;
  }

  .websearch-loading p {
    color: var(--websearch-text-secondary) !important;
    margin: 0;
    font-size: 0.875rem;
  }

  .websearch-loading-spinner {
    width: 32px;
    height: 32px;
    margin-bottom: 0.75rem;
    border: 3px solid var(--websearch-border);
    border-top: 3px solid var(--websearch-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes multiSlide {
    0% {
      background-position:
        300% 0,
        310% 0,
        320% 0,
        330% 0,
        340% 0,
        350% 0,
        0 0;
    }

    66.7% {
      background-position:
        -6000% 0,
        -6000% 0,
        -6000% 0,
        -6000% 0,
        -6000% 0,
        -6000% 0,
        0 0;
    }

    100% {
      background-position:
        -6000% 0,
        -6000% 0,
        -6000% 0,
        -6000% 0,
        -6000% 0,
        -6000% 0,
        0 0;
    }
  }

  .websearch-no-results {
    padding: var(--t-8) var(--t-4);
    text-align: center;
    color: light-dark(var(--on-surface, #374151), var(--on-surface-dark, #cbd5f5));
  }

  .websearch-no-results-icon {
    color: light-dark(var(--on-surface-muted, #94a3b8), var(--on-surface-muted-dark, #94a3b8));
    margin-bottom: var(--t-3);
    opacity: var(--muted);
  }

  .websearch-no-results p {
    margin: 0 0 var(--t-4) 0;
    font-size: var(--t-13);
    font-family: var(--default);
  }

  .websearch-error-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 150px;
    padding: var(--t-4);
    background: light-dark(#fef2f2, rgba(220, 38, 38, 0.15));
    border: 1px solid light-dark(#fecaca, rgba(220, 38, 38, 0.4));
    border-radius: var(--t-3);
  }

  .websearch-error-content {
    text-align: center;
    max-width: 400px;
  }

  .websearch-error-icon {
    color: light-dark(#dc2626, #f87171);
    margin-bottom: var(--t-3);
    display: flex;
    justify-content: center;
  }

  .websearch-error-title {
    color: light-dark(#dc2626, #f87171);
    margin: 0 0 var(--t-1) 0;
    font-size: var(--t-4);
    font-weight: var(--bold);
    font-family: var(--default);
  }

  .websearch-error-message {
    color: light-dark(#7f1d1d, #fca5a5);
    margin: 0 0 var(--t-4) 0;
    line-height: 1.5;
    font-size: var(--t-13);
    font-family: var(--default);
  }

  .websearch-retry-button {
    background: light-dark(var(--accent), var(--accent-dark, #8192ff));
    color: light-dark(var(--white), var(--on-app-background-dark, #e5edff));
    border: none;
    padding: var(--t-2) var(--t-4);
    border-radius: var(--t-1);
    cursor: pointer;
    font-size: var(--t-12-6);
    font-weight: var(--medium);
    font-family: var(--default);
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: var(--t-1);
  }

  .websearch-retry-button:hover {
    background: light-dark(rgba(109, 130, 255, 0.8), rgba(129, 146, 255, 0.9));
    transform: translateY(-1px);
  }
</style>
