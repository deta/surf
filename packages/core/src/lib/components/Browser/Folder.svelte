<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { tooltip } from '@svelte-plugins/tooltips'

  export let folder
  export let activeFolderId

  const dispatch = createEventDispatcher()

  const handleClick = () => {
    console.log('SET FOLDER ACTIVE: ', folder.id)
    dispatch('select', folder.id)
  }
</script>

<div
  class="folder"
  class:active={folder.id === $activeFolderId}
  on:click={handleClick}
  aria-hidden="true"
>
  <div class="title">
    {folder.label}
  </div>
</div>

<style>
  .folder {
    display: flex;
    align-items: center;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    gap: 10px;
    position: relative;
    color: #7d7448;
    font-weight: 500;
    letter-spacing: 0.0025em;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    &:hover {
      background-color: #e0e0d1;
    }
  }

  .folder.active {
    color: #585130;
    background-color: #fff;
  }

  .icon-wrapper {
    width: 20px;
    height: 20px;
    display: block;
  }

  .title {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 1.1rem;
  }
</style>
