import { Command as CommandPrimitive } from '@horizon/cmdk-sv'

import Root from './command.svelte'
import Dialog from './command-dialog.svelte'
import Empty from './command-empty.svelte'
import Group from './command-group.svelte'
import Item from './command-item.svelte'
import Input from './command-input.svelte'
import List from './command-list.svelte'
import Separator from './command-separator.svelte'
import Shortcut from './command-shortcut.svelte'
import Description from './command-description.svelte'

const Loading = CommandPrimitive.Loading

export {
  Root,
  Dialog,
  Empty,
  Group,
  Item,
  Input,
  List,
  Separator,
  Shortcut,
  Loading,
  Description,
  //
  Root as Command,
  Dialog as CommandDialog,
  Empty as CommandEmpty,
  Group as CommandGroup,
  Item as CommandItem,
  Input as CommandInput,
  List as CommandList,
  Separator as CommandSeparator,
  Shortcut as CommandShortcut,
  Loading as CommandLoading,
  Description as CommandDescription
}
