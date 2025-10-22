<script lang="ts" context="module">
  import Notification from './Notification.svelte'

  export const NOTIFICATION_CONTENTS: Record<string, { title: string; body: string }> = {
    default_browser: {
      title: '🏄‍♂️ Having fun Surfing?',
      body: `If you like Surf, try setting it as your
main browser so it follows you around throughout your daily workflows.`
    },
    deanonymize_prompt: {
      title: '👍 Help use improve Surf!',
      body: `It seems like you are using Surf quite a lot!`
    },
    book_call: {
      title: `✨ You're on a roll!`,
      body: `We'd love to hear how you're using Surf, what your favorite features are, and where we should improve. <br>Would you be up for a short call?`
    }
  }

  export function showNotification({
    title,
    message,
    actions = []
  }: {
    title: string
    message: string
    actions?: DialogButton[]
  }): Promise<CloseEventData> {
    const promise = new Promise<CloseEventData>((res, rej) => {
      try {
        const dialog = new Notification({
          target: document.body,
          props: {
            title,
            message,
            actions
          }
        })

        dialog.$on('close', (e: CloseEvent) => {
          setTimeout(() => dialog.$destroy(), 500)
          res({
            closeType: e.detail.closeType,
            submitValue: e.detail.submitValue
          })
        })
      } catch (e) {
        rej(e)
      }
    })
    return promise
  }
</script>

<script lang="ts">
  import { Icon } from '@deta/icons'
  import { createEventDispatcher, tick } from 'svelte'
  import type { CloseEventData, DialogButton } from '../Dialog/Dialog.svelte'

  export let title: string
  export let message: string
  export let actions: DialogButton[]

  const dispatch = createEventDispatcher<{
    close: CloseEventData
  }>()

  $: open = false
  let outro = false

  function handleClose() {
    outro = true
  }

  function handleCancel(e: Event, value?: string) {
    handleClose()
    dispatch('close', { closeType: false, submitValue: value })
  }
  function handleSubmit(e: SubmitEvent, value?: string) {
    handleClose()
    dispatch('close', { closeType: true, submitValue: value }) // (e.submitter as HTMLButtonElement).value
  }

  // TODO: (maxu): Nuke this succer again as soon as we support @starting-style (which should alre-
  // ady work, but doesnt for.. reasons).
  function intro(node: HTMLElement, opts: { clazz: string }) {
    node.classList.add(opts.clazz)
    setTimeout(() => node.classList.remove(opts.clazz), 20)
  }
</script>

<div class="notification-wrapper" use:intro={{ clazz: 'starting' }} class:outro>
  <article
    class="noti"
    class:closed={!open}
    class:open
    style="view-transition-name: active-notifcation-mail;"
    on:mouseenter={() => {
      if (open) return
      document.startViewTransition(async () => {
        open = true
        await tick()
      })
    }}
  >
    {#if !open}
      <svg class="fold" viewBox="0 0 100 100">
        <polygon points="0,0 50,50 100,0" />
      </svg>
      <!--<svg class="logo" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M18.0001 0C27.9411 0 36 8.05888 36 18C36 27.9411 27.9411 36 18.0001 36C8.05888 36 0 27.9411 0 18C0 8.05888 8.05888 0 18.0001 0Z"
        fill="#F73B95"
        style="fill:#F73B95;fill:color(display-p3 0.9686 0.2314 0.5843);fill-opacity:1;"
      ></path>
      <path
        d="M18.0441 3.51465C26.0917 3.51465 32.6155 10.0385 32.6155 18.0861C32.6155 26.1337 26.0917 32.6575 18.0441 32.6575C9.99655 32.6575 3.47266 26.1337 3.47266 18.0861C3.47266 10.0385 9.99655 3.51465 18.0441 3.51465Z"
        fill="#BD399C"
        style="fill:#BD399C;fill:color(display-p3 0.7412 0.2235 0.6118);fill-opacity:1;"
      ></path>
      <path
        d="M18.0423 7.37207C23.9596 7.37207 28.7566 12.1689 28.7566 18.0864C28.7566 24.0038 23.9596 28.8006 18.0423 28.8006C12.125 28.8006 7.32812 24.0038 7.32812 18.0864C7.32812 12.1689 12.125 7.37207 18.0423 7.37207Z"
        fill="#93388E"
        style="fill:#93388E;fill:color(display-p3 0.5765 0.2196 0.5569);fill-opacity:1;"
      ></path>
      <path
        d="M17.9576 10.6279C21.9812 10.6279 25.2432 13.8898 25.2432 17.9136C25.2432 21.9373 21.9812 25.1993 17.9576 25.1993C13.9339 25.1993 10.6719 21.9373 10.6719 17.9136C10.6719 13.8898 13.9339 10.6279 17.9576 10.6279Z"
        fill="#6030A2"
        style="fill:#6030A2;fill:color(display-p3 0.3765 0.1882 0.6353);fill-opacity:1;"
      ></path>
    </svg>-->
      <!--<svg class="noti" viewBox="0 0 10 10">
    <circle cx="5" cy="5" r="5" fill="red" />
    <circle cx="5" cy="5" r="2.7" fill="white" />
  </svg>-->
    {/if}
    <header>
      <span>{@html title}</span>
      <!-- old: cancel: handleCancel(e, undefined) -->
      <button
        on:click={(e) => {
          if (!open) return
          document.startViewTransition(async () => {
            open = false
            await tick()
          })
        }}
      >
        <Icon name="close" size="1em" />
      </button>
    </header>
    <div class="content">
      {@html message}
    </div>
    <footer>
      <form on:submit|preventDefault on:reset|preventDefault>
        {#each actions as action, i}
          <button
            tabindex={i}
            class={action.kind ?? action.type}
            type={action.type}
            value={action.value ?? action.title}
            on:click={(e) =>
              action.type === 'submit'
                ? handleSubmit(e, action.value)
                : handleCancel(e, action.value)}>{action.title}</button
          >
        {/each}
      </form>
    </footer>
  </article>
</div>

<style lang="scss">
  @use '@deta/ui/styles/utils' as utils;

  :global(::view-transition-image-pair(active-notifcation-mail)) {
    animation-duration: 123ms;
    animation-timing-function: ease-in-out;
  }
  :global(::view-transition-old(active-notifcation-mail)) {
    height: 100%;
  }
  :global(::view-transition-new(active-notifcation-mail)) {
    height: 100%;
  }

  // Base wrapper
  .notification-wrapper {
    position: fixed;
    z-index: 99999999999999;
    top: 3.75rem;
    right: 0.75rem;
    transform-origin: top right;

    transition:
      transform 245ms cubic-bezier(0.19, 1, 0.22, 1),
      opacity 215ms cubic-bezier(0.19, 1, 0.22, 1);
    transform: translate(var(--x, 0px), var(--y, 0));

    // Vertical tabs overrides
    :global(body:has(#app-contents.verticalTabs)) & {
      top: unset;
      right: unset;
      bottom: 6rem;
      left: 1.6rem;
      transform-origin: bottom left;
      &:has(.closed) {
        scale: 0.8;
      }
      &.outro {
        --x: -120%;
      }
    }

    // Outro motion hack
    &.outro {
      --x: 120%;
    }
    &:has(.closed) {
      scale: 0.7;
    }
  }

  // Starting styles hack
  :global(.notification-wrapper.starting) {
    opacity: 0;
    --y: -3.75rem !important;
  }
  :global(body:has(#app-contents.verticalTabs) .notification-wrapper.starting) {
    opacity: 0;
    --y: 7rem !important;
  }

  :global(
      body:has(#app-contents.horizontalTabs .sidebar-meta.mouseInside #stuff-stack.wasMouseInside)
        .notification-wrapper
    ),
  :global(body:has(#app-contents.horizontalTabs .pending-wrapper) .notification-wrapper) {
    --x: 130%;
  }
  :global(body:has(#app-contents.verticalTabs .sidebar-meta.mouseInside) .notification-wrapper),
  :global(body:has(#app-contents.verticalTabs .pending-wrapper) .notification-wrapper) {
    --x: -160%;
  }

  article {
    @include utils.light-dark-custom(
      'background-fill-mix',
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1),
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1)
    );

    position: relative;
    max-width: 32ch;
    overflow: hidden;
    opacity: 1;
    user-select: none;
    color: var(--contrast-color);

    &.closed {
      @include utils.light-dark-custom(
        'background',
        #fbf5ef,
        #223,
        color-mix(in srgb, var(--base-color), 75% var(--background-fill-mix)),
        color-mix(in srgb, var(--base-color), 55% var(--background-fill-mix))
      );
      @include utils.light-dark-custom(
        'stroke',
        #ccc,
        #557,
        color-mix(in srgb, var(--base-color), 25% var(--background-fill-mix)),
        color-mix(in srgb, var(--base-color), 0% var(--background-fill-mix))
      );

      width: 64px;
      height: 50px;
      border: 1.5px solid var(--stroke);
      border-radius: 6px;
      box-shadow: 1px 2px 8px rgba(0, 0, 0, 0.2);
      background: var(--background);

      .fold {
        position: absolute;
        inset: 0;
        > polygon {
          fill: var(--background);
          stroke: var(--stroke);
          stroke-width: 2.5px;
        }
        filter: drop-shadow(1px 1px 3px rgb(0 0 0 / 0.1));
      }
      .noti {
        position: absolute;
        top: 0;
        right: 0;
        width: 18px;
        height: 18px;
        transform: translate(50%, -50%);
      }

      header {
        display: none;
      }
      .content {
        display: none;
      }
      footer {
        display: none;
      }
    }

    &.open {
      --radius: 16px;
      @include utils.squircle($fill: var(--fill), $radius: var(--radius), $smooth: 0.33);
      @include utils.light-dark-custom(
        'fill',
        #fbf5ef,
        rgba(0, 0, 0, 1),
        color-mix(in srgb, var(--base-color), 55% var(--background-fill-mix))
      );
      @include utils.light-dark-custom(
        'squircle-outline-color',
        rgba(0, 0, 0, 0.08),
        rgba(255, 255, 255, 0.18),
        color-mix(in srgb, var(--base-color), 40% rgba(190, 190, 190, 0.75))
      );

      --squircle-shadow: 0px 2px 2px -1px var(--black-05);
      --squircle-outline-width: 2.25px;
    }

    header {
      height: 2.75em;
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      padding-block: 0.25em;
      padding-top: calc(0.25em + 3px); // Manual extra padding as squircle has inset border
      padding-inline: 0.5em;

      border-bottom: 1.5px solid rgba(0, 0, 0, 0.1);

      span {
        align-self: center;
        font-weight: 500;
        letter-spacing: 0.0125rem;
        font-size: 0.99em;
        flex-grow: 1;
        flex-shrink: 1;
        line-height: 1;
        padding-block: 0.25em;
        padding-left: 0.25em;
        margin-block: 0.25em;
      }
      button {
        aspect-ratio: 1 / 1;
        padding: 0.25em;
        display: flex;
        justify-content: center;
        align-items: center;
        opacity: 0.7;
        flex-shrink: 1;

        transition: color 85ms ease-out;

        --fill: transparent;
        --radius: 11px;
        @include utils.squircle(
          $fill: var(--fill),
          $radius: 4px,
          $radius-top-right: var(--radius),
          $smooth: 0.33
        );
        --squircle-outline-color: transparent;
        --squircle-outline-width: 0px;

        &:hover {
          @include utils.light-dark-custom(
            'fill',
            var(--black-09),
            var(--white-33),
            color-mix(in srgb, var(--base-color), 40% rgba(190, 190, 190, 0.75)),
            color-mix(in srgb, var(--base-color), 40% rgba(190, 190, 190, 0.75))
          );
          opacity: 1;
        }
      }
    }
    .content {
      //color: #444;
      opacity: 0.85;
      margin-block: 0.5em;
      padding-inline: 1em;

      font-weight: 450;
      font-size: 0.9em;
      letter-spacing: 0.01px;
      text-wrap: pretty;
    }
    footer {
      margin-block: 0.5em;
      padding-inline: 0.5em;

      form {
        display: flex;
        gap: 0.3em;

        > :first-child {
          @include utils.squircle(
            $fill: var(--fill),
            $radius: 5px,
            $radius-bottom-left: var(--radius),
            $smooth: 0.33
          );
        }
        > :last-child {
          @include utils.squircle(
            $fill: var(--fill),
            $radius: 5px,
            $radius-bottom-right: var(--radius),
            $smooth: 0.33
          );
        }
      }

      button {
        @include utils.light-dark-custom('color', #fff, #fff, var(--base-color), var(--base-color));
        @include utils.light-dark-custom(
          'fill',
          #54b1ef,
          #54b1ef,
          var(--contrast-color),
          var(--contrast-color)
        );

        &.muted {
          @include utils.light-dark-custom(
            'color',
            rgba(0 0 0 / 55%),
            #fff,
            var(--contrast-color),
            var(--contrast-color)
          );
          @include utils.light-dark-custom(
            'fill',
            rgba(0 0 0 / 10%),
            rgba(255 255 255 / 35%),
            color-mix(in srgb, var(--base-color), 40% rgba(190, 190, 190, 0.75)),
            color-mix(in srgb, var(--base-color), 40% rgba(190, 190, 190, 0.75))
          );
        }

        width: 100%;
        font-weight: 500;
        color: var(--color);
        line-height: 1;
        letter-spacing: 0.0125rem;
        font-size: 0.99em;
        padding: 0.5em 1em;
        transition: color 85ms ease-out;

        --radius: 11px;
        @include utils.squircle($fill: var(--fill), $radius: 5px, $smooth: 0.33);
        --squircle-outline-width: 0;
        --squircle-outline-color: transparent;

        &:hover {
          @include utils.light-dark-custom(
            'fill',
            #1c92d2,
            #1c92d2,
            color-mix(in srgb, var(--contrast-color), 15% #eee),
            color-mix(in srgb, var(--contrast-color), 15% #222)
          );

          @include utils.light-dark-custom(
            'color',
            #fff,
            #fff,
            var(--base-color),
            var(--base-color)
          );

          &.muted {
            @include utils.light-dark-custom(
              'color',
              rgba(0 0 0 / 55%),
              #fff,
              var(--contrast-color),
              var(--contrast-color)
            );
            @include utils.light-dark-custom(
              'fill',
              rgba(0 0 0 / 15%),
              rgba(255 255 255 / 45%),
              color-mix(in srgb, var(--base-color), 50% rgba(190, 190, 190, 0.75)),
              color-mix(in srgb, var(--base-color), 60% rgba(190, 190, 190, 0.75))
            );
          }
        }
      }
    }
  }
</style>
