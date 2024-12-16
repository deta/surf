<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
</script>

<button class="youtube-button" on:click={() => dispatch('click')}>Ask Video</button>

<style>
  .youtube-button {
    background-color: rgba(255, 255, 255, 0.98);
    border: none;
    color: #000000;
    padding: 6px 11px;
    margin: 0 4px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 14px;
    margin: 4px 2px;

    border-radius: 8px;
    transition: background-color 0.3s;
  }

  .youtube-button:hover {
    background-color: #f2f2f2;
  }
</style>
