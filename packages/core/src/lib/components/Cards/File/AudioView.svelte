<script lang="ts">
  import type { Resource } from '../../../service/resources'
  import type { ResourceManager, ResourceNote } from '../../../service/resources'
  import type { MagicField, MagicFieldParticipant } from '../../../service/magicField'
  import type { Horizon } from '../../../service/horizon'
  import { useLogScope } from '../../../utils/log'
  import { get } from 'svelte/store'

  const log = useLogScope('AudioViewCard')

  export let resource: Resource
  export let blob: Blob
  export let magicFieldParticipant: MagicFieldParticipant | null = null

  magicFieldParticipant?.onFieldEnter((field) => {
    if (!magicFieldParticipant) return
    if (!get(magicFieldParticipant.fieldParticipation)) return

    const isSupported = field.supportedResource === 'text/resource-path'

    magicFieldParticipant.fieldParticipation.update((p) => ({
      ...p!,
      supported: isSupported
    }))
  })

  magicFieldParticipant?.onFieldConnect((field) => {
    log.debug('connected to field', field)
  })

  magicFieldParticipant?.onRequestData((type: string, callback) => {
    log.debug('requestData', type)

    if (type === 'text/resource-path') {
      callback(resource.path)
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

<audio title={name} src={url} controls></audio>

<style lang="scss">
  audio {
    width: 100%;
    height: 100%;
  }
</style>
