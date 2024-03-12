<script lang="ts">
  import { createEventDispatcher, onMount, getContext } from 'svelte'

  import { useDebounce } from '../utils/debounce'
  import { useDrawer } from '../drawer'

  import { Icon } from '@horizon/icons'

  const drawer = useDrawer()
  const { searchValue } = drawer
  const dispatch = createEventDispatcher<{ enter: void }>()

  const search = () => {
    console.log('searchValue changed, triggering search')
    drawer.search({ value: $searchValue })
  }

  const debouncedSearch = useDebounce(search, 300)

  let inputRef: HTMLInputElement
  let isFocused = false
  let position = { x: 0, y: 0 }
  let opacity = 0

  const viewState: any = getContext('drawer.viewState')

  $: if ($viewState !== 'search') {
    opacity = 0
    isFocused = false
    searchValue.set('')
  }

  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
    }
  })

  const handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation()
    // check if key is searchable (alphanumeric, backspace, delete, etc.)
    if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
      debouncedSearch()
    } else if (event.key === 'Enter') {
      dispatch('enter')
    } else if (event.key === 'Escape') {
      document.startViewTransition(async () => {
        viewState.set('default')
      })
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (!inputRef || isFocused) return

    const rect = inputRef.getBoundingClientRect()
    position.x = event.clientX - rect.left
    position.y = event.clientY - rect.top
    opacity = 1 // Ensure the spotlight effect is visible on mouse move
  }

  function handleFocus() {
    isFocused = true
    opacity = 1
    inputRef.focus()
    document.startViewTransition(async () => {
      viewState.set('search')
    })
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="input-container" class:isFocussed={isFocused}>
  <div class="input-field-container" class:isFocussed={isFocused} on:click={handleFocus}>
    <!-- <div class="toolbar" class:active={isFocused}>
      <div class="toolbar-row">
        <div class="suggestion" class:hidden={$viewState !== 'search'}>
          <span>Notion</span>
        </div>
        <div class="suggestion" class:hidden={$viewState !== 'search'}>
          <span>Discord</span>
        </div>
        <div class="suggestion" class:hidden={$viewState !== 'search'}>
          <span>Slack</span>
        </div>
      </div>
    </div> -->

    <div class="icon-input">
      <div class="icon">
        <Icon name="search" color="#AAA7B1" size="28px" />
      </div>
      <input
        bind:this={inputRef}
        bind:value={$searchValue}
        type="message"
        name="message"
        placeholder="Search"
        class:active={$viewState == 'search'}
        on:keydown={handleKeyDown}
        on:focus={handleFocus}
      />
    </div>
  </div>
</div>

<style lang="scss">
  :global(html)::view-transition-old(input-field-container-transition),
  :global(html)::view-transition-new(input-field-container-transition) {
    width: 100%;
    height: 100%;
  }

  .input-container {
    position: relative;
    display: flex;
    align-items: center;
    font-size: 1.25rem;
    height: 100%;
    cursor: default;
    &.isFocussed {
      // margin-top: 1rem;
    }
  }
  .input-field-container {
    display: flex;
    justify-content: center;
    flex-direction: column;
    position: relative;
    padding: 0.5rem 0 0.25rem 0;
    border: 1px solid #e5e5e5;
    background-color: #fff;
    overflow: hidden;
    width: 100%;
    height: 100%;
    transition:
      border-color 0.3s,
      box-shadow 0.3s;
    box-shadow:
      0px 1px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 1px 0px rgba(0, 0, 0, 0.25);
    border-radius: 0.65rem;
    view-transition-name: input-field-container-transition;
    &.isFocussed {
      width: 100%;
      height: 100%;
      // box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
    }
    .icon-input {
      display: flex;
      justify-content: start;
      align-items: center;
      padding: 0.5rem 0;
    }
    .toolbar {
      width: 0;
      view-transition-name: toolbar-transition;
      &.active {
        width: 100%;
      }
      .toolbar-row {
        display: flex;
        .suggestion {
          position: relative;
          display: flex;
          justify-content: start;
          align-items: center;
          transition: all 240ms ease-out;
          font-size: 1rem;
          font-weight: 400;
          gap: 0.25rem;
          color: #353534;
          padding: 0.5rem 0.75rem 0.5rem 0.5rem;
          opacity: 0.6;
          margin: 0.25rem;
          width: fit-content;
          border-radius: 6px;
          // view-transition-name: add-files-transition;
          &:hover {
            background: rgba(61, 56, 78, 0.1);
          }
          &.hidden {
            transform: translateY(10%);
            opacity: 0;
            height: 0;
            padding: 0;
            margin: 0;
            transition: all 240ms ease-out;
          }
        }
      }
    }
  }

  input {
    position: absolute;
    height: 100%;
    width: 100%;
    cursor: text;
    font-size: 1.125rem;
    font-weight: 500;
    border: 0;
    border-radius: 0.65rem;
    color: #aeaeae;
    color: #353534;
    opacity: 0.8;
    padding-left: 0;
    padding-bottom: 0.25rem;
    opacity: 0;
    width: 100%;
    view-transition-name: search-input-transition;
    cursor: default !important;
    position: absolute;
    height: 50px;
    padding-left: 3rem;
    opacity: 1;
  }
  input:focus {
    outline: none;
  }
  .icon {
    position: relative;
    bottom: 0;
    left: 0.85rem;
    z-index: 5;
    transition: all 240ms ease-out;
    transform: translateX(0);
    pointer-events: none;
    z-index: 10;
    view-transition-name: search-icon-transition;
  }
</style>
