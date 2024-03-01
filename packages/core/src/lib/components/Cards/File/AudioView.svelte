<script lang="ts">
  import type { Resource } from '../../../service/resources'

  export let resource: Resource
  export let blob: Blob

  $: name = resource?.metadata?.name
  $: url = URL.createObjectURL(blob)
</script>

<audio title={name} src={url} controls></audio>

<style lang="scss">
  audio {
    width: 100%;
    height: 100%;
  }
</style>
