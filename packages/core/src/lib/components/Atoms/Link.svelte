<script lang="ts">
  import { Icon } from '@horizon/icons'

  export let url: string
  export let label: string
  export let color: string = '#281B53'
</script>

<div class="link">
  <a
    href={url}
    target="_blank"
    class="from"
    style="color: {color}; text-decoration: none;"
    {...$$restProps}>{label}</a
  >
  <div class="arrow">
    <Icon name="arrow" {color} />
  </div>
</div>

<style lang="scss">
  .link {
    display: flex;
    &:hover {
      .arrow {
        transform: translateX(0);
        opacity: 0.65;
      }
    }
    .arrow {
      position: relative;
      top: 1px;
      transform: translateX(-20%);
      opacity: 0;
      transition: all 120ms ease-out;
    }
    .from {
      font-weight: 500;
      text-decoration: none;
      color: #281b53;
    }
  }
</style>
