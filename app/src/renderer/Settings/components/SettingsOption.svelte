<script lang="ts">
  import { Switch } from '@deta/ui'
  import { Icon, type Icons } from '@deta/icons'
  import { openDialog } from '@horizon/core/src/lib/components/Core/Dialog/Dialog.svelte'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher<{ update: boolean }>()

  export let value: boolean | undefined = undefined
  export let title: string
  export let description: string | undefined = undefined
  export let icon: Icons | undefined = undefined
  export let showConfirmDialog: ((newValue: boolean) => boolean) | undefined = undefined
  export let getDialogMessage:
    | ((newValue: boolean) => {
        title: string
        message: string
      })
    | undefined = undefined

  let localValue = value

  async function handleValueChange(newValue: boolean) {
    // reset local value to match parent value
    localValue = value

    if (!showConfirmDialog || !showConfirmDialog(newValue)) {
      value = newValue
      localValue = newValue
      dispatch('update', newValue)
      return
    }

    const { title, message } = getDialogMessage
      ? getDialogMessage(newValue)
      : { title: 'Are you Sure?', message: '' }
    const { closeType: confirmed } = await openDialog({
      title: title,
      message: message,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Confirm', type: 'submit' }
      ]
    })

    if (confirmed) {
      value = newValue
      localValue = newValue
      dispatch('update', newValue)
    } else {
      // reset the switch to original value if cancelled
      localValue = value
    }
  }
  // keep local value in sync when parent value changes
  $: localValue = value
</script>

<div class="setting">
  <section class="section">
    <div class="info">
      <div class="title">
        {#if icon}
          <Icon name={icon} size="20px" />
        {/if}

        <h2>{title}</h2>
      </div>

      <slot name="description">
        <p>{@html description}</p>
      </slot>
    </div>

    {#if value !== undefined}
      <Switch
        color="#ff4eed"
        bind:checked={localValue}
        on:update={(e) => handleValueChange(e.detail)}
      />
    {/if}
  </section>
  <slot />
</div>

<style lang="scss">
  .setting {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--color-background-dark);
    border-bottom: 1px solid var(--color-border);
    padding: 1.5rem;
    border-radius: 12px;
    width: 100%;

    & :global(.section) {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .info {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      .title {
        display: flex;
        align-items: center;
        gap: 0.5rem;

        h2 {
          font-size: 1.2rem;
          font-weight: 500;
          color: var(--color-text);
        }
      }

      p {
        font-size: 1.1rem;
        color: var(--color-text-muted);
      }
    }
  }
</style>
