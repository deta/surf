<script lang="ts">
  import ChatInput from '@horizon/core/src/lib/components/Drawer/ChatInput.svelte'

  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  function forward(payload: any) {
    dispatch('chatSend', payload.detail)
  }
</script>

<div class="chat-input-wrapper">
  <ChatInput on:chatSend={forward} />
</div>

<style lang="scss">
  .chat-input-wrapper {
    position: relative;
    z-index: 10;
    width: 100%;
    view-transition-name: chat-transition;
  }
</style>
