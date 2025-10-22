<script lang="ts">
  import { Dropdown, type DropdownItem } from '@deta/ui'

  let {
    disabled = false,
    onFileSelect,
    onMentionSelect,
    side = 'bottom',
    align = 'start',
  }: {
    disabled?: boolean
    onFileSelect: () => void
    onMentionSelect?: () => void,
    side?: 'top' | 'right' | 'bottom' | 'left',
    align?: 'start' | 'center' | 'end',
  } = $props()

  const items = [
    {
      id: 'add-file',
      label: 'Import Local File (PDFs, Images)',
      icon: 'folder.open',
      action: onFileSelect
    },
    { type: 'separator' },
    {
      id: 'mentions',
      label: 'Mention Tabs, Notebooks & Sources',
      icon: 'note',
      description:
        'Type @ to mention your tabs, notebooks or saved sources and use them in the context.',
      action: onMentionSelect
    }
  ] as DropdownItem[]
</script>

<Dropdown {items} triggerText="Add Context" triggerIcon="add" {side} {align} {disabled} />
