<script lang="ts">
  import { onMount } from 'svelte'
  import { writable, type Writable } from 'svelte/store'

  import type { Card } from '../../../types/index'
  import { useLogScope } from '../../../utils/log'
  import type { Horizon } from '../../../service/horizon'
  import type { MagicField, MagicFieldParticipant } from '../../../service/magicField'
  import { TRANSCRIBER_MIME_TYPES } from '../../../constants/magicField'

  export let card: Writable<Card>
  export let horizon: Horizon

  $: participants = magicField?.participants

  const magicFieldService = horizon.magicFieldService

  const log = useLogScope('AudioTranscriber')

  let magicField: MagicField | null = null
  let connectedParticipant: Writable<MagicFieldParticipant | null> = writable(null)

  let transcribedText: string | null = null
  // NOTE: Demo only!! We obsly shouldnt set random props on cards like this lol
  $: $card.summarizedText = transcribedText
  let error: string | null = null

  let gettingData = false

  const getDataFromParticipant = async (id: string) => {
    if (!magicField) {
      log.error('No magic field found')
      return
    }

    log.debug('Getting data from participant', id)

    const data = await magicField.requestDataFromParticipant(id, TRANSCRIBER_MIME_TYPES)
    log.debug('received data:', data)

    return data?.data as string | null
  }

  const transcribeAudio = async (resourcePath: string) => {
    log.debug('Transcribing file:', resourcePath)

    // @ts-expect-error
    const response = await window.api.transcribeAudioFile(resourcePath)

    log.debug('transcriber response:', response)
    return response
  }

  const handleParticipantConnect = async (participant: MagicFieldParticipant) => {
    log.debug('Participant connected:', participant)

    connectedParticipant.set(participant)

    gettingData = true

    const data = await getDataFromParticipant(participant.id)
    gettingData = false
    if (!data) {
      log.error('No data received from participant')
      error = 'nothing to transcribe'
      return
    }

    const transcribed = await transcribeAudio(data)
    if (!transcribed) {
      log.error('No transcription data received')
      error = 'transcription failed'
      return
    }

    error = null
    transcribedText = transcribed
  }

  const handleRefresh = () => {
    if (!$connectedParticipant) {
      log.error('No connected participant')
      return
    }

    handleParticipantConnect($connectedParticipant)
  }

  onMount(() => {
    const magicCardParticipant = magicFieldService.getParticipant($card.id)
    if (!magicCardParticipant) {
      log.debug('Participant self not found')
      return
    }

    log.debug("Creating magic field with card's participant", magicCardParticipant)
    magicField = magicFieldService.createField(
      $card.id,
      TRANSCRIBER_MIME_TYPES,
      magicCardParticipant.position
    )

    magicField.onParticipantLeave((p) => {
      log.debug('participantEnter', p)
    })

    magicField.onParticipantConnect((p) => {
      log.debug('participantConnect', p)
      handleParticipantConnect(p)
    })

    magicField.onReceiveData(async (type, data) => {
      log.debug('receivedData', type, data)
      if (gettingData) return

      const transcribed = await transcribeAudio(data)
      if (!transcribed) {
        log.error('No transcription data received')
        error = 'transcription failed'
        return
      }

      error = null
      transcribedText = transcribed
    })

    magicField.onParticipantLeave((p) => {
      log.debug('participantLeave', p)
      connectedParticipant.set(null)
      //transcribedText = null
    })

    return () => {
      if (magicField) {
        magicFieldService.removeField(magicField.id)
      }
    }
  })
</script>

<div class="audio-transcriber magic-card">
  {#if $connectedParticipant || transcribedText}
    {#if transcribedText}
      <div class="transcription-content" style={!$connectedParticipant ? 'opacity: 0.43;' : ''}>
        <p>{transcribedText}</p>
      </div>
    {:else if error}
      <div class="error-message">
        <p>{error}</p>
        <button on:click={handleRefresh}>Try Again</button>
      </div>
    {:else}
      <div class="loading-message">
        <p>Loading...</p>
      </div>
    {/if}
  {:else}
    <div class="initial-state">
      <div class="title">🎙 Audio Transcriber 🎙</div>
      <div class="subtitle">Connect an audio card to transcribe.</div>
    </div>
  {/if}
</div>

<style lang="scss">
  .audio-transcriber {
    width: 100%;
    height: 100%;
    padding: 1rem;
    overflow: auto;
  }

  .initial-state {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    height: 100%;
    gap: 0.25rem;
  }

  .title {
    font-size: 1.25rem;
    font-weight: bold;
  }

  .subtitle {
    font-size: 1rem;
    font-weight: 300;
  }

  .transcription-content,
  .error-message,
  .loading-message {
    padding: 1rem;
    background: rgba(255, 255, 255, 0.33);
    border-radius: 4px;
    height: 100%;

    p {
      font-size: 1rem;
      font-weight: 300;
    }
  }
</style>
