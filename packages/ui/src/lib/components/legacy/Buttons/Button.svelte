<script lang="ts">
  let { onclick, type, disabled } = $props<{
    onclick: () => void
    type: 'button' | 'submit'
    disabled: boolean
  }>()
</script>

<button {type} {disabled} {onclick} style="font-family: 'SN Pro';">
  <slot></slot>
</button>

<style lang="scss">
  button {
    padding: 0.95rem 0.85rem;
    background-color: var(--color-brand);
    background-size: 200%;
    background-position: 40% 40%;
    color: white;
    border: none;
    border-radius: 0.825rem;

    font-size: 1.25rem;
    width: fit-content;
    min-width: 12rem;
    transition: background-color 0.2s;
    border: 0.194px solid rgba(0, 0, 0, 0.13);
    border: 0.194px solid color(display-p3 0 0 0 / 0.13);
    box-shadow:
      0px 2.633px 0.745px 0px #001c38,
      0px 1.689px 0.646px 0px rgba(0, 28, 56, 0.01),
      0px 0.944px 0.547px 0px rgba(0, 28, 56, 0.05),
      0px 0.397px 0.397px 0px rgba(0, 28, 56, 0.09),
      0px 0.099px 0.248px 0px rgba(0, 28, 56, 0.1);
    box-shadow:
      0px 2.633px 0.745px 0px color(display-p3 0.0275 0.1059 0.2118 / 0),
      0px 1.689px 0.646px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.01),
      0px 0.944px 0.547px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.05),
      0px 0.397px 0.397px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.09),
      0px 0.099px 0.248px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.1);
    text-shadow: 0px 1px 3px rgba(0, 0, 0, 0.12);
    transition:
      background-position 40s,
      transform 0.2s,
      box-shadow 0.2s;
    &:hover {
      background-color: var(--color-brand-dark);
      background-position: 80% 35%;
      cursor: default;
      transform: translateY(-2px) rotate(-0.7deg);
      box-shadow:
        0px 4px 1px 0px #001c38,
        0px 2px 1px 0px rgba(0, 28, 56, 0.02),
        0px 1px 1px 0px rgba(0, 28, 56, 0.06),
        0px 0.5px 0.5px 0px rgba(0, 28, 56, 0.1),
        0px 0.2px 0.3px 0px rgba(0, 28, 56, 0.12);
      box-shadow:
        0px 4px 1px 0px color(display-p3 0.0275 0.1059 0.2118 / 0),
        0px 2px 1px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.12),
        0px 1px 1px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.15),
        0px 0.5px 0.5px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.19),
        0px 0.2px 0.3px 0px color(display-p3 0.0275 0.1059 0.2118 / 0.3);
    }

    &:disabled {
      background-color: #ccc !important;
      cursor: not-allowed;
      opacity: 0.4;
      background-image: none;
      &:hover {
        background-position: initial;
        transform: none;
        box-shadow: none;
      }
    }

    &:active {
      transform: scale(0.98);
    }
  }
</style>
