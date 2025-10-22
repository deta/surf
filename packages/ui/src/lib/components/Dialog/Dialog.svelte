<script lang="ts" context="module">
  import Dialog from './Dialog.svelte'
  import { mount, unmount } from "svelte"
  import { get, writable, type Writable } from 'svelte/store'

  /**
   * The dialog provides a simple API to open a dialog to prompt the user for an action / input etc.
   * Right now, by default, the only options is to open a dialog with a custom icon, message and a
   * list of actions the user can take.
   * TODO: (maxu): More docs / examples?
   */

  // NOTE: The naming schema of the types etc is stupid, but this is the standard, so we are going
  // with that to avoid further confusion.
  export interface DialogButton {
    title: string

    // The type defined whether the action is considered true / false
    type: 'reset' | 'submit'

    // The kind is used to visually style the action buttons
    kind?: 'reset' | 'submit' | 'danger' | 'muted'

    value?: string
  }
  export type CloseEventData = { closeType: boolean; submitValue?: string }
  export type CloseEvent = CustomEvent<CloseEventData>

  //export let DIALOG_OASIS_REF: Writable<OasisService | null> = writable(null)

  export function openDialog({
    icon,
    title,
    message,
    actions = [
      { title: 'Cancel', type: 'reset' },
      { title: 'OK', type: 'submit' }
    ]
  }: {
    icon?: string
    title?: string
    message: string
    actions?: DialogButton[]
  }): Promise<CloseEventData> {
    const promise = new Promise<CloseEventData>((res, rej) => {
      try {
        const dialog = mount(Dialog, {
          target: document.body,
          props: {
            icon,
            title,
            message,
            actions,
            //oasis: get(DIALOG_OASIS_REF) as OasisService
          },
          events: {
            close: (e) => {
              unmount(dialog)
              res({
                closeType: e.detail.closeType,
                submitValue: e.detail.submitValue
              })
            }
          }
        })

        //dialog.$on('close', (e: CloseEvent) => {
        //  dialog.$destroy()
        //  res({
        //    closeType: e.detail.closeType,
        //    submitValue: e.detail.submitValue
        //  })
        //})
      } catch (e) {
        rej(e)
      }
    })
    return promise
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { DynamicIcon } from '@deta/icons'

  export let icon: string | undefined
  export let title: string | undefined
  export let message: string
  export let actions: DialogButton[]

  //const viewManager = useTabsViewManager()
  const dispatch = createEventDispatcher<{
    close: CloseEventData
  }>()

  let dialogEl: HTMLDialogElement

  onMount(() => {
    dialogEl.showModal()

    //viewManager.changeOverlayState({
    //  dialogOpen: true
    //})
  })

  //onDestroy(() => {
  //  viewManager.changeOverlayState({
  //    dialogOpen: false
  //  })
  //})

  function handleCancel(e: Event) {
    dispatch('close', { closeType: false })
  }
  function handleSubmit(e: SubmitEvent) {
    dispatch('close', { closeType: true, submitValue: (e.submitter as HTMLButtonElement).value })
  }

  // TODO: (maxu): Nuke this succer again as soon as we support @starting-style (which should alre-
  // ady work, but doesnt for.. reasons).
  function intro(node: HTMLElement, opts: { clazz: string }) {
    node.classList.add(opts.clazz)
    setTimeout(() => node.classList.remove(opts.clazz), 5)
  }
</script>

<!-- HACK: The dialog element should handle this itself EIGENTLICH, but web standards seem to succ
again, as always and this doesnt actually happen. -->
<svelte:window
  on:keydown|capture={(e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopImmediatePropagation()
      handleCancel(e)
    }
  }}
/>

<dialog bind:this={dialogEl} on:cancel={handleCancel} use:intro={{ clazz: 'starting' }}>
  <div class="icon-wrapper">
    <DynamicIcon name={icon ?? 'face'} size="100%"  />
  </div>
  <div class="details">
    {#if title}
      <h2>{@html title}</h2>
    {/if}
    <p>{@html message}</p>
  </div>
  <form
    method="dialog"
    on:submit|preventDefault={handleSubmit}
    on:reset|preventDefault={handleCancel}
  >
    {#each actions as action, i}
      <button
        tabindex={i}
        class={action.kind ?? action.type}
        type={action.type}
        value={action.value ?? action.title}>{action.title}</button
      >
    {/each}
  </form>
</dialog>

<style lang="scss">
  :global(dialog.starting) {
    scale: 0.9 !important;
    opacity: 0 !important;
    translate: 0 20px !important;

    &::backdrop {
      background: rgba(0, 0, 0, 0);
    }
  }
  dialog {
    font-size: 0.9rem;

    --dialog-background: light-dark(#ffffff, #1b2435);
    --dialog-border: light-dark(rgba(72, 86, 103, 0.15), rgba(71, 85, 105, 0.4));
    --dialog-shadow-primary: light-dark(rgba(50, 50, 93, 0.1), rgba(15, 23, 42, 0.35));
    --dialog-shadow-secondary: light-dark(rgba(0, 0, 0, 0.1), rgba(15, 23, 42, 0.55));

    width: 32ch;
    margin: auto auto;
    position: fixed;
    inset: 0;

    background: var(--dialog-background);
    border-radius: 1rem;
    -electron-corner-smoothing: 100%;
    border: 2px solid var(--dialog-border);
    box-shadow: 0 3px 4px 0 var(--dialog-shadow-primary), 0 2px 10px var(--dialog-shadow-secondary);

    &:focus-within {
      outline: none;
    }

    transition: scale, opacity, translate;
    transition-duration: 215ms;
    transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1);

    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25ch;

    &::backdrop {
      background: light-dark(rgba(80, 80, 80, 0.5), var(--overlay-modal-dark, rgba(15, 23, 42, 0.7)));
      transition:
        background 415ms,
        ease-out;
    }

    .icon-wrapper {
      max-width: 5.5ch;
      margin: 0 auto;
      margin-top: 0.25em;
      padding-block: 0.75em;

      color: light-dark(rgba(0, 0, 0, 0.75), rgba(255, 255, 255, 0.75));
    }
    .details {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25em;

      > h2 {
        margin: 0 auto;
        font-size: 1.1em;

        font-weight: 500;
        letter-spacing: 0.03px;
        text-align: center;
        text-wrap: pretty;
        color: light-dark(rgba(0, 0, 0, 0.9), rgba(255, 255, 255, 0.9));
      }
      > p {
        font-size: 0.9em;
        text-align: center;
        text-wrap: pretty;
        color: light-dark(rgba(0, 0, 0, 0.75), rgba(255, 255, 255, 0.75));
        max-width: 30ch;
        margin: 0 auto;
      }
    }

    form {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      margin-top: 0.75em;

      button {
        --background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.1));
        flex: 1;
        background: var(--background);
        border: 1px solid transparent;
        border-radius: calc(1rem - 0.5rem); // 1em;
        -electron-corner-smoothing: 100%;
        color: light-dark(rgba(0, 0, 0, 0.85), rgba(255, 255, 255, 0.9));

        min-height: 3.5ch;
        font-weight: 500;
        letter-spacing: 0.03px;
        font-size: 0.9em;

        /*&:focus-visible {
          outline: 1.5px solid #2497e9;
          outline-offset: 2px;
        }*/
        &:focus-visible {
          outline: none;
        }

        &:hover {
          background: color-mix(in oklab, var(--background) 92%, light-dark(black, white) 8%);
        }

        &:focus-visible,
        &:active {
          background: color-mix(in srgb, var(--background) 90%, light-dark(black, white) 10%);
        }
      }

      .submit {
        --background: light-dark(#2497e9, var(--accent-dark, #8192ff));
        color: light-dark(#ffffff, var(--on-app-background-dark, #e5edff));
      }
      .danger {
        --background: light-dark(#ff4d4f, var(--danger-dark, #f87171));
        color: light-dark(#ffffff, var(--on-app-background-dark, #e5edff));
      }
      .muted {
        color: light-dark(rgba(0, 0, 0, 0.6), rgba(255, 255, 255, 0.6));
      }
    }
  }
</style>
