<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { writable, type Writable } from 'svelte/store'

  import { Editor, type JSONContent } from '@horizon/editor'
  import '@horizon/editor/src/editor.scss'

  import type { CardEvents, CardText } from '../../../types'
  import { useLogScope } from '../../../utils/log'
  import { useDebounce } from '../../../utils/debounce'

  export let card: Writable<CardText>

  const dispatch = createEventDispatcher<CardEvents>()
  const log = useLogScope('TextCard')

  const value = writable($card.data.content)

  const debouncedSaveContent = useDebounce((value: JSONContent) => {
    log.debug('saving content', $card)
    dispatch('change', $card)
    $card.data.content = value
  }, 500)

  value.subscribe((value) => {
    debouncedSaveContent(value)
  })
</script>

<div class="text-card">
  <Editor bind:content={$value} placeholder="Jot something down…" autofocus={false} />
</div>

<style lang="scss">
  .text-card {
    width: 100%;
    height: 100%;
    position: relative;
    padding: 1rem;
    background: #fff;
  }
</style>
