<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'

  import { floatyButtons } from '../../components/Atoms/floatyButtons'
  import FloatyButton from '../Atoms/FloatyButton.svelte'
  import { useTabsManager } from '../../service/tabs'
  import { conditionalArrayItem } from '@horizon/utils'

  const dispatch = createEventDispatcher<{
    'open-space-and-chat': { spaceId: string }
    'open-chat-with-tab': string
    openScreenshot: void
  }>()
  const tabsManager = useTabsManager()

  const scope = tabsManager.activeScopeId

  $: buttonConfigs = {
    buttons: [
      ...conditionalArrayItem($scope !== null, {
        component: FloatyButton,
        offsetX: -100,
        offsetY: -70,
        props: {
          text: 'Ask this Context',
          icon: '',
          onClick: () => {
            dispatch('open-space-and-chat', { spaceId: $scope as string })
          }
        }
      }),
      {
        component: FloatyButton,
        offsetX: 100,
        offsetY: -70,
        props: {
          text: 'Ask this Tab',
          icon: '',
          onClick: () => {
            const activeTabId = tabsManager.activeTabIdValue
            dispatch('open-chat-with-tab', activeTabId)
          }
        }
      },
      {
        component: FloatyButton,
        offsetX: 20,
        offsetY: -130,
        props: {
          text: 'Use Vision',
          icon: document.body.classList.contains('dark') ? 'vision.light' : 'vision',
          onClick: (e) => {
            dispatch('openScreenshot')
            return false
          }
        }
      }
    ],
    springConfig: {
      stiffness: 0.15,
      damping: 0.6
    }
  }
</script>

<div class="tty-header-wrapper">
  <div class="header-actions">
    <button class="header-btn" on:click={() => dispatch('create')}>
      <span>Create</span>
      <Icon name="plus.boxed" />
    </button>
    {#key $scope}
      <button
        class="header-btn"
        on:click|stopPropagation={() => dispatch('ask')}
        use:floatyButtons={buttonConfigs}
      >
        <Icon name="face.animated" size="34px" />
        <span>Ask</span>
      </button>
    {/key}
  </div>
</div>

<style lang="scss">
  .header-actions {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0.5rem 0.25rem 0.5rem;
    position: relative;
    border-bottom: 0.5px solid var(--border-color);
    &:after {
      content: '';
      position: absolute;
      display: block;
      width: 100%;
      height: 1px;
      bottom: -1.5px;
      left: 0;
      border-bottom: 1px solid white;
    }
    .header-btn {
      display: flex;
      padding: 0.5rem 0.75rem;
      justify-content: space-between;
      align-items: center;
      font-size: 1.125rem;
      gap: 0.25rem;
      border-radius: 11px;
      line-height: 1;
      color: var(--text);

      &:hover {
        color: var(--text-accent);
        filter: brightness(0.95);
        background: rgba(126, 168, 240, 0.15);
        background: color(display-p3 0.5294 0.6549 0.9176 / 0.15);
      }
    }
  }
</style>
