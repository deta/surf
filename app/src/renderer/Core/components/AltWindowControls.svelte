<script>
  import { Icon } from '@deta/icons'
  import { Button } from '@deta/ui'

  const handleMinimize = () => {
    window.api.controlWindow('minimize')
  }
  const handleMaximize = () => {
    window.api.controlWindow('toggle-maximize')
  }
  const handleClose = () => {
    window.api.controlWindow('close')
  }
</script>

<div>
  <Button size="md" square onclick={handleMinimize}>
    <Icon name="minus" size="1.1em" />
  </Button>
  <Button size="md" square onclick={handleMaximize}>
    <Icon name="rectangle" size="1.1em" />
  </Button>
  <Button size="md" square onclick={handleClose}>
    <Icon name="close" size="1.1em" />
  </Button>
</div>

<style lang="scss">
  div {
    flex-shrink: 0;
    flex-grow: 0;
    width: fit-content;
    display: flex;
    align-items: center;
    padding-block: 0.33rem;
    padding-right: 2px;
    height: -webkit-fill-available;
    view-transition-name: alt-window-controls;

    > :global(*) {
      app-region: no-drag;
    }
  }
</style>
