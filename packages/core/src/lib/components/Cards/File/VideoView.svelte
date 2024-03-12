<script lang="ts">
  import type { Resource } from '../../../service/resources'
  import type { MagicFieldParticipant } from '../../../service/magicField'
  import { useLogScope } from '../../../utils/log'
  import { get } from 'svelte/store'

  const log = useLogScope('VideoViewCard')

  export let resource: Resource
  export let blob: Blob
  export let magicFieldParticipant: MagicFieldParticipant | null = null

  magicFieldParticipant?.onFieldEnter((field) => {
    if (!magicFieldParticipant) return
    if (!get(magicFieldParticipant.fieldParticipation)) return

    const isSupported = field.supportedResources.includes(resource.type)

    magicFieldParticipant.fieldParticipation.update((p) => ({
      ...p!,
      supported: isSupported
    }))
  })

  magicFieldParticipant?.onFieldConnect((field) => {
    log.debug('connected to field', field)
  })

  magicFieldParticipant?.onRequestData((types: string[], callback) => {
    log.debug('requestData', types)

    if (types.includes(resource.type)) {
      callback({ type: resource.type, data: resource.path })
    } else {
      callback(null)
    }
  })

  magicFieldParticipant?.onFieldLeave((field) => {
    log.debug('fieldLeave', field)
  })

  $: name = resource?.metadata?.name
  $: url = URL.createObjectURL(blob)
</script>

<!-- svelte-ignore a11y-media-has-caption -->
<video title={name} src={url} controls></video>

<style lang="scss">
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    user-select: none;
  }
</style>
