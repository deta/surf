<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import Picker from 'emoji-picker-element/picker'
  import type { EmojiClickEvent } from 'emoji-picker-element/shared'
  import data from 'emoji-picker-element-data/en/emojibase/data.json?url'

  import { useLogScope } from '@horizon/utils'
  import { useConfig } from '@horizon/core/src/lib/service/config'

  let wrapper: HTMLDivElement

  const log = useLogScope('EmojiPicker')
  const config = useConfig()
  const dispatch = createEventDispatcher<{ select: string }>()

  const userConfigSettings = config.settings

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
  $: if ($userConfigSettings.app_style === 'light') {
    picker.classList.add('light')
    picker.classList.remove('dark')
  } else {
    picker.classList.remove('light')
    picker.classList.add('dark')
  }

  onMount(() => {
    picker.addEventListener('emoji-click', handleClick)
    picker.classList.add('no-drag')
    wrapper.appendChild(picker)
  })

  onDestroy(() => {
    picker.remove()
  })
</script>

<div bind:this={wrapper} data-vaul-no-drag class="no-drag"></div>

<style lang="scss">
</style>
