<script lang="ts">
  import { Icon } from '@deta/icons'
  import { Button, NotebookCover } from '@deta/ui'
  import ColorPicker from './ColorPicker.svelte'
  import { Notebook, type NotebookCoverColor } from '@deta/services/notebooks'

  let {
    notebook = $bindable(),
    mode = 'edit',
    oncreate,
    oncancel
  }: {
    notebook?: Notebook
    mode?: 'edit' | 'create'
    oncreate?: () => void
    oncancel?: () => void
  } = $props()

  // Selectable colors for the notebook
  // See notebook.types.ts for explanation
  const colors: NotebookCoverColor[] = [
    [
      ['#636161', '#636161'],
      ['#424141', '#424141'],
      ['#fff', '#fff']
    ],
    [
      ['#ffffff', '#ffffff'],
      ['#edebeb', '#edebeb'],
      ['#404043', '#404043']
    ],
    [
      ['#FFDFBA', '#FFDFBA'],
      ['#e1c3a2', '#e1c3a2'],
      ['#71593f', '#71593f']
    ],
    [
      ['color(display-p3 0.33 0.59 1)', '#78a2ff'],
      ['color(display-p3 0.09 0.38 0.82)', '#5e85dc'],
      ['#fff', '#fff']
    ],
    [
      ['color(display-p3 0.92 0.21 0.11)', '#c92837'],
      ['color(display-p3 0.73 0.16 0.08)', '#ca3240'],
      ['#fff', '#fff']
    ],
    [
      ['color(display-p3 0.15 0.4 0.1)', '#2d783d'],
      ['color(display-p3 0.15 0.4 0.1)', '#2b703a'],
      ['#fff', '#fff']
    ],
    [
      ['color(display-p3 0.78 0.12 0.95)', '#9f31f8'],
      ['color(display-p3 0.59 0.02 0.59)', '#7220b3'],
      ['#fff', '#fff']
    ],
    [
      ['color(display-p3 0.96 0.56 0.15)', '#ff9e23'],
      ['color(display-p3 0.96 0.56 0.15)', '#eb8c10'],
      ['#fff', '#fff']
    ],
    [
      ['color(display-p3 1 0.81 0.08)', '#f9c922'],
      ['color(display-p3 0.88 0.67 0.05)', '#e1af1c'],
      ['color(display-p3 0.38 0.37 0.07)', '#85600b']
    ],
    [
      ['color(display-p3 0.69 1 0.05)', '#a6ff3a'],
      ['color(display-p3 0.69 1 0.05)', '#74c80e'],
      ['ccolor(display-p3 0.29 0.4 0.03)', '#2d7205']
    ]
  ]
  //let selectedColor: [string, string] = $state(['#4a7be8', '#fff'])

  const colorValue = $derived(
    notebook?.colorValue ?? [
      ['color(display-p3 0.24 0.67 0.98 / 0.74)', '#7ECEFF'],
      ['color(display-p3 0.13 0.55 0.86 / 0.82)', '#00A5EB'],
      '#fff'
    ]
  )

  const handleClose = () => {
    if (mode === 'create' && oncancel) {
      oncancel()
    } else {
      notebook = undefined
    }
  }

  const handleCreate = () => {
    if (oncreate) {
      oncreate()
    }
  }
</script>

<div class="dialog-backdrop" onclick={handleClose}></div>
<dialog open>
  <header>
    {#if mode === 'edit'}
      <Button square size="md" onclick={handleClose}>
        <Icon name="close" size="1.085rem" />
      </Button>
    {:else if mode === 'create'}
      <Button onclick={handleClose}>Cancel</Button>
      <Button onclick={handleCreate} class="create-button">Create</Button>
    {/if}
  </header>

  <section class="main">
    <NotebookCover
      {notebook}
      height="40ch"
      fontSize="1.7rem"
      readonly={false}
      --round-base="24px"
      --round-diff="-18px"
    />
    <span
      ><!--<Icon name="info" size="0.975em" />-->
      <!--<small>You can draw scribbles on the cover or drop images onto it.</small></span>-->
    </span>
  </section>

  <div class="body">
    <section>
      <header><span class="typo-title-sm">Color</span></header>
      <ColorPicker
        colors={colors.map((e) => [e[0][0], e[0][1]])}
        selected={notebook.colorValue[0][0]}
        onpick={(c) => {
          const color = colors.find((e) => e[0][0] === c[0])
          notebook.updateData({
            customization: {
              ...notebook.data.customization,
              coverColor: [[color[0][0], color[0][1]], [color[1][0], color[1][1]], color[2]]
            }
          })
        }}
      />
    </section>
    <section>
      <header><span class="typo-title-sm">Scribbles <!--and Stickers--></span></header>
      <p>You can add scribbles on the cover to make this notebook your own.</p>
      {#if notebook?.data?.customization?.coverScribble && notebook?.data?.customization?.coverScribble.length > 0}
        <div class="ctrls">
          <button
            onclick={() => {
              notebook.updateData({
                customization: {
                  ...notebook.data.customization,
                  coverScribble: []
                }
              })
            }}>Clear Scribbles</button
          >
          <!--<button>Clear Stickers</button>-->
        </div>
      {/if}
    </section>
    <!--<section>
      <header><span class="typo-title-sm">Material</span></header>
    </section>
    <section>
      <header><span class="typo-title-sm">Background Image</span></header>
    </section>-->
    <!--<section>
      <header>
        <span class=""
          >Tipp: You can scribble on the cover or drop images as stickers to make it your own.</span
        >
      </header>
    </section>-->
  </div>
</dialog>

<style lang="scss">
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.3));
    backdrop-filter: blur(1px);
  }
  dialog {
    position: fixed;
    z-index: 10001;
    inset: 0;

    margin: 0 auto;
    margin-top: 10%;
    width: 100%;
    max-width: 70ch;

    background: light-dark(#fff, #1a2438);
    border: 1px solid light-dark(rgba(0, 0, 0, 0.175), rgba(71, 85, 105, 0.4));
    box-shadow: light-dark(0 2px 10px rgba(0, 0, 0, 0.05), 0 2px 10px rgba(0, 0, 0, 0.3));
    border-radius: 20px;
    padding: 1rem;

    display: flex;
    gap: 2rem;

    > .body {
      display: flex;
      flex-direction: column;
      justify-content: end;
      gap: 2rem;
      padding-block: 0.25rem;
    }

    > header {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-left: 0.5rem;
      margin-bottom: 0rem;

      font-size: 1.23rem;
      font-weight: 500;
      opacity: 0.9;
    }

    section {
      //margin-block: 1rem;
      //padding-inline: 0.5rem;
      //padding-inline: 2rem;
      display: flex;
      flex-direction: column;
      justify-content: start;

      > header {
        margin-bottom: 0.25rem;

        > span {
          opacity: 0.75;
          font-size: 0.9rem;
          font-weight: 500;
        }
      }

      > p {
        font-size: 0.9rem;
        opacity: 0.5;
        color: light-dark(rgba(0, 0, 0, 0.7), rgba(255, 255, 255, 0.7));
      }

      &.main {
        position: relative;
        width: fit-content;
        display: flex;
        flex-direction: column;
        align-items: start;

        > span {
          display: flex;
          align-items: start;
          gap: 0.5ch;
          max-width: 28ch;
          text-align: center;
          opacity: 0.5;
        }
      }
    }
  }
  .ctrls {
    width: 100%;
    //display: flex;
    //justify-content: space-between;
    //justify-content: center;
    //padding-inline: 2rem;
    //padding-block: 0.5rem;
    //padding-bottom: 0;
    margin-top: 0.5rem;

    transition: background, color;
    transition-timing-function: ease-out;
    transition-duration: 123ms;

    button {
      text-box: trim-both cap alphabetic;
      background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05));
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: light-dark(rgba(0, 0, 0, 0.3), rgba(255, 255, 255, 0.3));
      padding: 0.5rem;

      &:hover {
        color: light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.5));
        background: light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.1));
      }
    }
  }

  :global(.create-button[data-button-root]) {
    background: light-dark(#8c9dff, #6075f1);
    color: #fff;
    border-radius: 12px;
    padding: 0.25rem 0.33rem 0.25rem 0.5rem;
    min-width: 4.5rem;
    display: flex;
    justify-content: center;
    align-items: center;

    &:hover:not(&:disabled) {
      background: light-dark(#7d8ff3, #7d8ff3);
      color: #fff;
    }

    span.keycap {
      background: rgba(255, 255, 255, 0.265);
      color: #fff;
    }
  }
</style>
