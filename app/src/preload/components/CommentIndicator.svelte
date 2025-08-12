<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@deta/icons'

  const dispatch = createEventDispatcher<{ click: void }>()

  const handleClick = () => {
    dispatch('click')
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div on:click={handleClick} role="button" tabindex="-1" class="comment-indicator">
  <Icon name="message" size="20px" />
</div>

<style>
  .comment-indicator {
    background: #ffffff;
    color: #333;
    border: 2px solid #d0d0d0;
    border-radius: 5px;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;

    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
    pointer-events: auto;
  }

  .comment-indicator:hover {
    background: #f0f0f0;
  }
</style>
