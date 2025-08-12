<div class="box">
  <slot></slot>
</div>

<style lang="scss">
  .box {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem;
    border-radius: 8px;
    text-align: center;
    font-size: 1rem;
  }
</style>
