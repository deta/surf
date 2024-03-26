<script lang="ts">
  import { onMount } from 'svelte'
  import { get, writable, type Writable } from 'svelte/store'

  import type { Card } from '../../../types/index'
  import { useLogScope } from '../../../utils/log'
  import type { Horizon } from '../../../service/horizon'
  import type { MagicField, MagicFieldParticipant } from '../../../service/magicField'
  import { Icon } from '@horizon/icons'
  import { useClipboard } from '../../../utils/clipboard'

  export let card: Writable<Card>
  export let horizon: Horizon

  const magicFieldService = horizon.magicFieldService

  const log = useLogScope('AITextCard')
  const { copied, copy } = useClipboard()

  let magicField: MagicField | null = null
  //$: magicFieldColorIdx = get(magicFieldService.fields).findIndex((f) => f.id === magicField?.id)
  let connectedParticipant: Writable<MagicFieldParticipant | null> = writable(null)

  $: participants = magicField?.participants

  let summarizedText: string | null = null
  // NOTE: Demo only!! We obsly shouldnt set random props on cards like this lol
  $: $card.summarizedText = summarizedText
  let error: string | null = null

  let gettingData = false

  const getDataFromParticipant = async (id: string) => {
    if (!magicField) {
      log.error('No magic field found')
      return
    }

    log.debug('Getting data from participant', id)

    const data = await magicField.requestDataFromParticipant(id, ['text/plain'])
    log.debug('received data:', data)

    return data?.data as string
  }

  const summarizeText = async (text: string) => {
    log.debug('Summarizing data:', text)

    // @ts-expect-error
    const response = await window.api.createAIChatCompletion(
      text,
      'You are a summarizer, summarize the text given to you. Only respond with the summarization.'
    )

    log.debug('Summarization response:', response)
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
      error = 'nothing found to summarize'
      return
    }

    const summarized = await summarizeText(data)
    if (!summarized) {
      log.error('No summarized data received')
      error = 'summarization failed'
      return
    }

    error = null
    summarizedText = summarized
  }

  const handleReload = () => {
    if (!$connectedParticipant) {
      log.error('No connected participant')
      return
    }

    handleParticipantConnect($connectedParticipant)
  }

  const handleDragStart = (e: DragEvent) => {
    if (!summarizedText) {
      log.error('No summarized text found')
      return
    }

    e.dataTransfer?.setData('text/plain', summarizedText)
    e.dataTransfer?.setData('text/html', summarizedText)
  }

  const handleCopy = () => {
    if (!summarizedText) {
      log.error('No summarized text found')
      return
    }

    copy(summarizedText)
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
      ['text/plain'],
      magicCardParticipant.position
    )

    magicField.onParticipantEnter((p) => {
      log.debug('participantEnter', p)
    })

    magicField.onParticipantLeave((p) => {
      log.debug('participantLeave', p)
    })

    magicField.onParticipantConnect((p) => {
      log.debug('participantConnect', p)
      handleParticipantConnect(p)
    })

    magicField.onReceiveData(async (type, data) => {
      log.debug('receivedData', type, data)
      if (gettingData) return

      const summarized = await summarizeText(data)
      if (!summarized) {
        log.error('No summarized data received')
        error = 'summarization failed'
        return
      }

      error = null
      summarizedText = summarized
    })

    magicField.onParticipantLeave((p) => {
      log.debug('participantLeave', p)
      connectedParticipant.set(null)
      //summarizedText = null
    })

    log.debug('Activating field')
    magicFieldService.activateField(magicField)

    console.warn('draggable stopped')
    return () => {
      if (magicField) {
        magicFieldService.removeField(magicField.id)
      }
    }
  })
</script>

<div class="ai-text-card magic-card">
  {#if $connectedParticipant || summarizedText}
    <div class="subtitle">
      <div style="display: flex;justify-content:space-between;">
        <!--<span>Connected to: {$connectedParticipant.id}</span
        >--><!--<button on:click={handleReload}
          >Reload</button
        >-->
      </div>
    </div>

    {#if summarizedText}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        on:dragstart={handleDragStart}
        class="summary"
        style={!$connectedParticipant ? 'opacity: 0.43;' : ''}
      >
        <p>{summarizedText}</p>

        <button class="copy" on:click={handleCopy}>
          {#if $copied}
            <Icon name="check" />
          {:else}
            <Icon name="copy" />
          {/if}
        </button>
      </div>
    {:else if error}
      <div class="init">
        <p>{error}</p>
        <button on:click={handleReload}>Try Again</button>
      </div>
    {:else}
      <div class="init">
        <p>Loading...</p>
      </div>
    {/if}
  {:else}
    <div class="init">
      <div class="title">✨ AI Summarizer ✨</div>
      {#if $participants && $participants.length > 0}
        <div class="subtitle">
          <!--Click the magic button to summarize the connected card.-->
          <!--<button on:click={handleReload}>Reload</button>-->
        </div>
      {:else}
        <div class="subtitle">Bring other cards close to this one to see magic happen</div>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  .ai-text-card {
    width: 100%;
    height: 100%;
    padding: 1rem;
    overflow: auto;
  }

  .init {
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

  .summary {
    padding: 1rem;
    background: rgba(255, 255, 255, 0.33);
    border-radius: 4px;
    height: 100%;
    position: relative;

    p {
      font-size: 1rem;
      font-weight: 300;
    }
  }

  .copy {
    position: absolute;
    bottom: 0.5rem;
    right: 0.5rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    opacity: 0.35;

    &:hover {
      opacity: 1;
    }
  }
</style>
