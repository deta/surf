<div class="drawer-content">
  <slot>
    <div class="drawer-content-empty">
      <div>
        <h2>No results found</h2>
        <p>Try searching for something else</p>
      </div>
    </div>
  </slot>
</div>

<style lang="scss">
  .drawer-content {
    flex: 1;
    padding: 1rem;
    padding-top: 0;
    overflow: auto;
    height: 100%;

    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .drawer-content-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    margin-top: -4rem;
    color: var(--color-text-muted);
    text-align: center;

    h2 {
      font-size: 1.2rem;
      font-weight: 500;
    }

    p {
      font-size: 1rem;
    }
  }
</style>
