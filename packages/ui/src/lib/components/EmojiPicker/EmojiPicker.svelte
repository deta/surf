<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import Picker from 'emoji-picker-element/picker'
  import type { EmojiClickEvent } from 'emoji-picker-element/shared'
  import data from 'emoji-picker-element-data/en/emojibase/data.json?url'

  import { useLogScope, wait } from '@deta/utils'

  export let theme: 'light' | 'dark' = 'light'

  let wrapper: HTMLDivElement

  const log = useLogScope('EmojiPicker')
  const config = useConfig()
  const dispatch = createEventDispatcher<{ select: string }>()

  const picker = new Picker({
    dataSource: data
  })

  const handleClick = (event: EmojiClickEvent) => {
    const emoji = event.detail
    log.debug('Selected emoji', emoji)
    if (emoji.unicode) {
      dispatch('select', emoji.unicode)
    }
  }

  const focusInput = () => {
    const root = picker.shadowRoot as ShadowRoot | undefined
    if (!root) return

    const elem = root.querySelector('#search') as HTMLInputElement | null
    log.debug('Focusing input', elem)
    if (elem) {
      elem.focus()
    }
  }

  $: if (theme === 'light') {
    picker.classList.add('light')
    picker.classList.remove('dark')
  } else {
    picker.classList.remove('light')
    picker.classList.add('dark')
  }

  onMount(async () => {
    picker.addEventListener('emoji-click', handleClick)
    picker.classList.add('no-drag')
    wrapper.appendChild(picker)

    const root = picker.shadowRoot
    if (root) {
      const style = document.createElement('style')
      style.textContent = `
        .emoji, 
        .nav-button,
        button[role="tab"] {
          cursor: default !important;
        }
      `
      root.appendChild(style)
    }

    await wait(100)
    focusInput()
  })

  onDestroy(() => {
    picker.remove()
  })
</script>

<div bind:this={wrapper} data-vaul-no-drag class="no-drag"></div>

<style lang="scss">
</style>
