import type {
	LoadingProps,
	CommandProps,
	EmptyProps,
	ItemProps,
	GroupProps,
	ListProps,
	InputProps,
	SeparatorProps,
	DialogProps
} from './types.js';

import Root from './components/Command.svelte';
import Dialog from './components/CommandDialog.svelte';
import Empty from './components/CommandEmpty.svelte';
import Group from './components/CommandGroup.svelte';
import Input from './components/CommandInput.svelte';
import Item from './components/CommandItem.svelte';
import List from './components/CommandList.svelte';
import Loading from './components/CommandLoading.svelte';
import Separator from './components/CommandSeparator.svelte';

export {
	// Components
	Root,
	Dialog,
	Empty,
	Group,
	Input,
	Item,
	List,
	Loading,
	Separator,
	//
	Root as CommandRoot,
	Dialog as CommandDialog,
	Empty as CommandEmpty,
	Group as CommandGroup,
	Input as CommandInput,
	Item as CommandItem,
	List as CommandList,
	Loading as CommandLoading,
	Separator as CommandSeparator
};

export type {
	LoadingProps,
	DialogProps,
	CommandProps,
	EmptyProps,
	ItemProps,
	GroupProps,
	ListProps,
	InputProps,
	SeparatorProps
};
