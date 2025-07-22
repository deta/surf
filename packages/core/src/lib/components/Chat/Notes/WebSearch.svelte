<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { writable, type Writable } from 'svelte/store'
  import { useLogScope } from '@horizon/utils'
  import { DuckDuckGoAPI } from '@horizon/web-parser'

  // NOTE: created by tiptap but not needed
  export const node: any = undefined
  export const editor: any = undefined
  export const uuid: string = ''

  export let updateAttributes: (attrs: Record<string, any>) => void
  export let onWebSearchCompleted: (
    results: Array<{ title: string; url: string }>,
    query: string
  ) => void
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
    if ($isSearching) return 'Searching...'
    if ($error) return 'Error'
    if ($doneSearching && $searchResults.length > 0) {
      return `${$searchResults.length} result${$searchResults.length !== 1 ? 's' : ''}`
    }
    if ($doneSearching && $searchResults.length === 0) return 'No results'
    return 'Ready'
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
  <div class="websearch-container">
    <div class="websearch-header">
      <div class="websearch-title-section">
        <div class="websearch-title-row">
          <div class="websearch-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <h3 class="websearch-title">{$searchTitle}</h3>
          <div class="websearch-status">
            {#if $isSearching}
              <div class="websearch-loading-spinner-small"></div>
            {/if}
            <span class="websearch-status-text" class:searching={$isSearching} class:error={$error}>
              {statusText}
            </span>
          </div>
          <button
            class="websearch-collapse-button"
            class:rotated={!$isCollapsed}
            on:click={toggleCollapse}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
        <div class="websearch-query">
          <span class="websearch-query-label">Query:</span>
          <span class="websearch-query-text">"{query}"</span>
        </div>
      </div>
    </div>

    <div class="websearch-content" class:collapsed={$isCollapsed}>
      {#if $isSearching}
        <div class="websearch-loading">
          <div class="websearch-loading-spinner"></div>
          <p>Searching for <strong>"{query}"</strong>...</p>
        </div>
      {:else if $doneSearching && $searchResults.length > 0}
        <div class="websearch-results">
          <div class="websearch-results-header">
            <h4>Found {$searchResults.length} result{$searchResults.length !== 1 ? 's' : ''}</h4>
          </div>
          <div class="websearch-results-list">
            {#each $searchResults as result, index}
              <div class="websearch-result-item">
                <div class="websearch-result-number">{index + 1}</div>
                <div class="websearch-result-content">
                  <h5 class="websearch-result-title">
                    <a href={result.url} target="_blank" rel="noopener noreferrer">
                      {result.title}
                    </a>
                  </h5>
                  <p class="websearch-result-url">{result.url}</p>
                </div>
                <div class="websearch-result-actions">
                  <button
                    class="websearch-visit-button"
                    on:click={() => window.open(result.url, '_blank')}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15,3 21,3 21,9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Visit
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else if $doneSearching && $searchResults.length === 0}
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

<style>
  .websearch-container {
    border: 1px solid #e1e5e9;
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .websearch-container:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }

  .websearch-header {
    padding: 0.875rem 1rem;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-bottom: 1px solid #e1e5e9;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .websearch-header:hover {
    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  }

  .websearch-title-section {
    flex: 1;
  }

  .websearch-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .websearch-icon {
    color: #3b82f6;
    display: flex;
    align-items: center;
  }

  .websearch-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    flex: 1;
  }

  .websearch-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-right: 0.5rem;
  }

  .websearch-status-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: #64748b;
    transition: color 0.2s ease;
  }

  .websearch-status-text.searching {
    color: #3b82f6;
  }

  .websearch-status-text.error {
    color: #ef4444;
  }

  .websearch-loading-spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid #f1f5f9;
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .websearch-collapse-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    color: #64748b;
    transition: all 0.2s ease;
    border-radius: 6px;
  }

  .websearch-collapse-button:hover {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .websearch-collapse-button.rotated {
    transform: rotate(180deg);
  }

  .websearch-query {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .websearch-query-label {
    color: #64748b;
    font-weight: 500;
  }

  .websearch-query-text {
    color: #1e293b;
    font-weight: 500;
    background: rgba(59, 130, 246, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
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
    color: #64748b;
    margin: 0;
    font-size: 0.875rem;
  }

  .websearch-loading-spinner {
    width: 32px;
    height: 32px;
    margin-bottom: 0.75rem;
    border: 3px solid #f1f5f9;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .websearch-results {
    padding: 1rem;
  }

  .websearch-results-header {
    margin-bottom: 0.875rem;
  }

  .websearch-results-header h4 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
  }

  .websearch-results-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .websearch-result-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .websearch-result-item:hover {
    background: #f1f5f9;
    border-color: #3b82f6;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .websearch-result-number {
    background: #3b82f6;
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .websearch-result-content {
    flex: 1;
    min-width: 0;
  }

  .websearch-result-title {
    margin: 0 0 0.375rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.4;
  }

  .websearch-result-title a {
    color: #3b82f6;
    text-decoration: none;
  }

  .websearch-result-title a:hover {
    text-decoration: underline;
  }

  .websearch-result-url {
    margin: 0;
    font-size: 0.75rem;
    color: #64748b;
    word-break: break-all;
  }

  .websearch-result-actions {
    flex-shrink: 0;
  }

  .websearch-visit-button {
    background: #ffffff;
    color: #3b82f6;
    border: 1px solid #3b82f6;
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .websearch-visit-button:hover {
    background: #3b82f6;
    color: white;
  }

  .websearch-no-results {
    padding: 2rem 1.5rem;
    text-align: center;
    color: #64748b;
  }

  .websearch-no-results-icon {
    color: #94a3b8;
    margin-bottom: 0.75rem;
    opacity: 0.6;
  }

  .websearch-no-results p {
    margin: 0 0 1rem 0;
    font-size: 0.875rem;
  }

  .websearch-error-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 150px;
    padding: 1.5rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 12px;
  }

  .websearch-error-content {
    text-align: center;
    max-width: 400px;
  }

  .websearch-error-icon {
    color: #ef4444;
    margin-bottom: 0.75rem;
    display: flex;
    justify-content: center;
  }

  .websearch-error-title {
    color: #dc2626;
    margin: 0 0 0.375rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .websearch-error-message {
    color: #7f1d1d;
    margin: 0 0 1rem 0;
    line-height: 1.5;
    font-size: 0.875rem;
  }

  .websearch-retry-button {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .websearch-retry-button:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }
</style>
