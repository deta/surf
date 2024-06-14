<script lang="ts">
  import ChatInput from '@horizon/core/src/lib/components/Drawer/ChatInput.svelte'
  import { createEventDispatcher, getContext } from 'svelte'
  import { useDrawer } from './drawer'

  export let droppedInputElements: any

  const drawer = useDrawer()
  const { viewState } = drawer

  const dispatch = createEventDispatcher()

  export let forceOpen: boolean

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

<div class="chat-input-wrapper" class:active={$viewState == 'chatInput' || forceOpen}>
  <ChatInput
    on:chatSend={forward}
    on:drop={forwardDrop}
    on:fileUpload={forwardFileUpload}
    {forceOpen}
    {droppedInputElements}
  />
</div>

<style lang="scss">
  .chat-input-wrapper {
    position: relative;
    z-index: 10;
    width: 4rem;
    view-transition-name: chat-transition;
    &.active {
      position: fixed;
      background: white;
      left: 50%;
      transform: translateX(-50%);
      padding: 0.5rem;
      border-radius: 14px;
      top: 1rem;
      height: auto;
      width: 40rem;
      box-shadow:
        0px 0px 0px 1px rgba(0, 0, 0, 0.2),
        0px 16.479px 41.197px 0px rgba(0, 0, 0, 0.46);
    }
  }
</style>
