<script lang="ts">
  import ChatInput from '@horizon/core/src/lib/components/Drawer/ChatInput.svelte'
  import { createEventDispatcher } from 'svelte'

  export let droppedInputElements

  const dispatch = createEventDispatcher()

  function forward(payload: any) {
    dispatch('chatSend', payload.detail)
  }

  function forwardDrop(payload: any) {
    dispatch('dropForwarded', payload.detail)
  }

  function forwardFileUpload(payload: any) {
    dispatch('dropFileUpload', payload.detail)
  }
</script>

<div class="chat-input-wrapper">
  <ChatInput
    on:chatSend={forward}
    on:drop={forwardDrop}
    on:fileUpload={forwardFileUpload}
    {droppedInputElements}
  />
</div>

<style lang="scss">
  .chat-input-wrapper {
    position: relative;
    z-index: 10;
    width: 100%;
    view-transition-name: chat-transition;
  }
</style>
