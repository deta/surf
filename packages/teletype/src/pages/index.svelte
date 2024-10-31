<script lang="ts">
  import { useTeletype } from '@/components/Teletype'
  import { Icons } from '@/components/Icons'
  import Test from '@/components/Test.svelte'
  import type { NotificationType } from '@/components/Teletype/types'

  const teletype = useTeletype()

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  teletype.useActions([
    {
      id: 'actions',
      name: 'Multiple Actions',
      section: 'Navigation',
      actionText: 'Open',
      icon: Icons.DOCS,
      handler: () => alert('Default action'),
      actionPanel: [
        {
          icon: Icons.DOCS,
          id: 'action1',
          name: 'Option 1',
          handler: () => alert('Child Action 1'),
        },
        {
          icon: Icons.TERMINAL,
          id: 'action0',
          name: 'Option 2',
          handler: () => alert('Child Action 2'),
        },
      ],
    },
    {
      id: 'docs',
      name: 'View Documentation',
      section: 'Navigation',
      actionText: 'Open App',
      breadcrumb: 'Docs',
      shortcut: 'd',
      icon: Icons.DOCS,
      handler: () => alert('Docs'),
    },
    {
      id: 'loading',
      name: 'Loading',
      section: 'Debug',
      actionText: 'Start Loading',
      icon: Icons.TERMINAL,
      handler: async (_, teletype) => {
        teletype.setLoading(true)

        await delay(2000)

        teletype.setLoading(false)

        teletype.showSuccess('Loading complete!')
      },
    },
    {
      id: 'search_docs',
      name: 'Search Documentation',
      section: 'Help',
      breadcrumb: 'Search Docs',
      keywords: ['API', 'Docs'],
      shortcut: 's',
      actionText: 'Open Command',
      icon: Icons.DOC_SEARCH,
      placeholder: 'Search the documentation',
      childActions: [
        {
          id: 'overview',
          name: 'Overview',
          icon: Icons.DOCS,
          childActions: [
            {
              id: 'action13',
              name: 'Action 3',
              handler: () => alert('Overview'),
            },
            {
              id: 'action1',
              name: 'Action 1',
              handler: () => alert('Overview'),
            },
            {
              id: 'action2',
              name: 'Action 2',
              handler: () => alert('Get started'),
            },
          ],
        },
        {
          id: 'started',
          name: 'Get started',
          icon: Icons.HOME,
          handler: () => alert('Get started'),
        },
      ],
    },
    {
      id: 'help',
      name: 'Contact Support',
      section: 'Help',
      shortcut: 'h',
      keywords: ['Email', 'Team'],
      icon: Icons.SUPPORT,
      handler: () => alert('Support'),
    },
    {
      id: 'prevent',
      name: 'Prevent Close',
      section: 'Debug',
      handler: (_action, teletype) => {
        teletype.showInfo('Preventing Close')

        return {
          preventClose: true,
        }
      },
    },
    {
      id: 'test-component',
      name: 'Component',
      view: 'Modal',
      section: 'Debug',
      component: Test,
    },
    {
      id: 'join-beta',
      name: 'Join Beta',
      activationKey: 'Nxhhyz6ASF8emikzhqcGXtc3dz',
      icon: Icons.TERMINAL,
      section: 'Hidden',
      hidden: true,
      handler: (_action, teletype) => {
        teletype.showSuccess('Joined Beta Program!')
      },
    },
  ])

  const notify = () => {
    const types = ['success', 'error', 'info', 'plain']
    teletype.showNotification({
      text: 'Action ran successfully!',
      actionText: 'Details',
      removeAfter: undefined,
      type: types[Math.floor(Math.random() * types.length)] as NotificationType,
      onClick: (_, teletype) => teletype.showAction('test-component'),
    })
  }
</script>

<main class="canvas-wrapper">
  <div class="settings" on:click={notify}>Trigger Notification</div>
</main>

<style>
  .canvas-wrapper {
    width: 100%;
    height: 100%;
    background-image: radial-gradient(#ddd 1px, transparent 0),
      radial-gradient(#ddd 1px, transparent 0);
    background-position: 0 0, 25px 25px;
    background-size: 25px 25px;
    padding: 4rem;
  }

  .settings {
    position: fixed;
    top: 1rem;
    right: 1rem;
    cursor: pointer;
  }
</style>
