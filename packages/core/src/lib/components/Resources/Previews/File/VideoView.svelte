<script lang="ts">
  import type { Resource } from '../../../../service/resources'
  import { useLogScope } from '@horizon/utils'

  export let resource: Resource
  export let blob: Blob

  $: name = resource?.metadata?.name
  $: url = URL.createObjectURL(blob)
</script>

<!-- svelte-ignore a11y-media-has-caption -->
<video title={name} src={url} controls>
  <source src={url} type={resource.type} />
  Your browser does not support the video tag.
</video>

<style lang="scss">
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    user-select: none;
  }
</style>
