<script lang="ts">
  import Unknown from './UnknownFileView.svelte'
  import type { Resource } from '../../../../service/resources'

  export let resource: Resource
  export let blob: Blob

  $: name = resource?.metadata?.name
  $: url = URL.createObjectURL(blob)
</script>

<object title={name} data={url} type="application/pdf">
  <Unknown {resource} {blob} />
</object>

<style lang="scss">
  object {
    width: 100%;
    height: 100%;
  }
</style>
