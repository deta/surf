<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { Resource } from '../../../../service/resources'
  import { getFileType } from '@deta/utils'

  export let resource: Resource
  export let blob: Blob

  const name = resource?.metadata?.name
  const url = URL.createObjectURL(blob)

  onDestroy(() => {
    URL.revokeObjectURL(url)
  })
</script>

<div class="wrapper">
  <div class="title">
    {name} - {getFileType(resource.type)}
  </div>

  <div class="audio">
    <audio title={name} src={url} controls></audio>
  </div>
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1em;
  }

  .title {
    font-size: 1.25em;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .title {
      display: none;
    }
  }

  .audio {
    width: 100%;

    audio {
      margin: auto;
      width: 100%;
      max-width: 950px;
    }
  }
</style>
