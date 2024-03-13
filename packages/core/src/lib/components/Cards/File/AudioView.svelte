<script lang="ts">
  import type { Resource } from '../../../service/resources'
  import type { MagicFieldParticipant } from '../../../service/magicField'
  import { useLogScope } from '../../../utils/log'
  import { get } from 'svelte/store'
  import { onMount } from 'svelte'

  const log = useLogScope('AudioViewCard')

  export let resource: Resource
  export let blob: Blob
  export let magicFieldParticipant: MagicFieldParticipant | null = null

  magicFieldParticipant?.onFieldEnter((field) => {
    if (!magicFieldParticipant) return
    if (!get(magicFieldParticipant.fieldParticipation)) return

    const isSupported = field.supportedResources.includes(resource.type)
    magicFieldParticipant?.updateFieldSupported(field.id, isSupported)
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

  onMount(() => {
    // on mount we need to check if we are already in a field
    const fieldStore = magicFieldParticipant?.inField
    const field = fieldStore ? get(fieldStore) : null
    if (field) {
      const isSupported = field.supportedResources.includes('text/plain')
      magicFieldParticipant?.updateFieldSupported(field.id, isSupported)
    }
  })
</script>

<audio title={name} src={url} controls></audio>

<style lang="scss">
  audio {
    width: 100%;
    height: 100%;
  }
</style>
