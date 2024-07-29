import { getContext, setContext, tick } from 'svelte';
import { commandScore } from '$lib/internal/command-score.js';
import type { CommandProps, Context, Group, State, StateStore } from './types.js';
import { get, writable } from 'svelte/store';
import {
	omit,
	generateId,
	toWritableStores,
	isHTMLElement,
	isUndefined,
	kbd,
	removeUndefined
} from '$lib/internal/index.js';

const NAME = 'Command';
const STATE_NAME = 'CommandState';
const GROUP_NAME = 'CommandGroup';

export const LIST_SELECTOR = `[data-cmdk-list-sizer]`;
export const GROUP_SELECTOR = `[data-cmdk-group]`;
export const GROUP_ITEMS_SELECTOR = `[data-cmdk-group-items]`;
export const GROUP_HEADING_SELECTOR = `[data-cmdk-group-heading]`;
export const ITEM_SELECTOR = `[data-cmdk-item]`;
export const VALID_ITEM_SELECTOR = `${ITEM_SELECTOR}:not([aria-disabled="true"])`;
export const VALUE_ATTR = `data-value`;

export const defaultFilter: (value: string, search: string) => number = (value, search) =>
	commandScore(value, search);

export function getCtx() {
	return getContext<Context>(NAME);
}

export function getState() {
	return getContext<StateStore>(STATE_NAME);
}

export function createGroup(alwaysRender: boolean | undefined) {
	const id = generateId();

	setContext<Group>(GROUP_NAME, {
		id,
		alwaysRender: isUndefined(alwaysRender) ? false : alwaysRender
	});
	return { id };
}

export function getGroup() {
	const context = getContext<Group>(GROUP_NAME);
	if (!context) return undefined;
	return context;
}

export function createState(initialValues?: Partial<State>) {
	const defaultState: State = {
		search: '',
		value: '',
		filtered: {
			count: 0,
			items: new Map(),
			groups: new Set()
		}
	};
	const state = writable<State>(
		initialValues ? { ...defaultState, ...removeUndefined(initialValues) } : defaultState
	);
	return state;
}

const defaults = {
	label: 'Command menu',
	shouldFilter: true,
	loop: false,
	onValueChange: undefined,
	value: undefined,
	filter: defaultFilter,
	ids: {
		root: generateId(),
		list: generateId(),
		label: generateId(),
		input: generateId()
	}
} satisfies CommandProps;

export function createCommand(props: CommandProps) {
	const ids = {
		root: generateId(),
		list: generateId(),
		label: generateId(),
		input: generateId(),
		...props.ids
	};

	const withDefaults = {
		...defaults,
		...removeUndefined(props)
	} satisfies CommandProps;

	const state =
		props.state ??
		createState({
			value: withDefaults.value
		});

	const allItems = writable<Set<string>>(new Set()); // [...itemIds]
	const allGroups = writable<Map<string, Set<string>>>(new Map()); // groupId → [...itemIds]
	const allIds = writable<Map<string, string>>(new Map()); // id → value
	const commandEl = writable<HTMLDivElement | null>(null);

	const options = toWritableStores(omit(withDefaults, 'value', 'ids'));
	const { shouldFilter, loop, filter, label } = options;

	const context: Context = {
		value: (id, value) => {
			if (value !== get(allIds).get(id)) {
				allIds.update(($allIds) => {
					$allIds.set(id, value);
					return $allIds;
				});
				state.update(($state) => {
					$state.filtered.items.set(id, score(value, $state.search));
					const sortedState = sort($state, get(shouldFilter));
					return sortedState;
				});
			}
		},
		// Track item lifecycle (add/remove)
		item: (id, groupId) => {
			allItems.update(($allItems) => $allItems.add(id));

			// Track this item within the group
			if (groupId) {
				allGroups.update(($allGroups) => {
					if (!$allGroups.has(groupId)) {
						$allGroups.set(groupId, new Set([id]));
					} else {
						$allGroups.get(groupId)?.add(id);
					}
					return $allGroups;
				});
			}

			state.update(($state) => {
				const $shouldFilter = get(shouldFilter);
				const filteredState = filterItems($state, $shouldFilter);
				const sortedState = sort(filteredState, $shouldFilter);

				if (!sortedState.value) {
					const value = selectFirstItem();
					sortedState.value = value ?? '';
				}
				return sortedState;
			});

			return () => {
				allIds.update(($allIds) => {
					$allIds.delete(id);
					return $allIds;
				});
				allItems.update(($allItems) => {
					$allItems.delete(id);
					return $allItems;
				});
				state.update(($state) => {
					$state.filtered.items.delete(id);
					const selectedItem = getSelectedItem();

					const filteredState = filterItems($state);

					if (selectedItem?.getAttribute('id') === id) {
						filteredState.value = selectFirstItem() ?? '';
					}

					return $state;
				});
			};
		},
		group: (id) => {
			allGroups.update(($allGroups) => {
				if (!$allGroups.has(id)) {
					$allGroups.set(id, new Set());
				}
				return $allGroups;
			});
			return () => {
				allIds.update(($allIds) => {
					$allIds.delete(id);
					return $allIds;
				});
				allGroups.update(($allGroups) => {
					$allGroups.delete(id);
					return $allGroups;
				});
			};
		},
		filter: () => {
			return get(shouldFilter);
		},
		label: get(label) || props['aria-label'] || '',
		commandEl,
		ids,
		updateState
	};

	function updateState<K extends keyof State>(key: K, value: State[K], preventScroll?: boolean) {
		const $shouldFilter = get(shouldFilter);
		state.update((curr) => {
			if (Object.is(curr[key], value)) return curr;
			curr[key] = value;

			if (key === 'search') {
				const filteredState = filterItems(curr, $shouldFilter);
				curr = filteredState;
				const sortedState = sort(curr, $shouldFilter);
				curr = sortedState;
				tick().then(() =>
					state.update((curr) => {
						curr.value = selectFirstItem() ?? '';
						return curr;
					})
				);
			} else if (key === 'value') {
				props.onValueChange?.(curr.value);
				if (!preventScroll) {
					tick().then(() => scrollSelectedIntoView());
				}
			}
			return curr;
		});
	}

	function filterItems(state: State, shouldFilterVal?: boolean): State {
		const $shouldFilter = shouldFilterVal ?? get(shouldFilter);
		const $allItems = get(allItems);
		const $allIds = get(allIds);
		if (!state.search || !$shouldFilter) {
			state.filtered.count = $allItems.size;
			return state;
		}

		state.filtered.groups = new Set();
		let itemCount = 0;

		// check which items should be included
		for (const id of $allItems) {
			const value = $allIds.get(id);
			const rank = score(value, state.search);
			state.filtered.items.set(id, rank);
			if (rank > 0) {
				itemCount++;
			}
		}

		// Check which groups have at least 1 item shown
		for (const [groupId, group] of get(allGroups)) {
			for (const itemId of group) {
				const rank = state.filtered.items.get(itemId);
				if (rank && rank > 0) {
					state.filtered.groups.add(groupId);
				}
			}
		}

		state.filtered.count = itemCount;
		return state;
	}

	function sort(state: State, shouldFilterVal?: boolean) {
		const $shouldFilter = shouldFilterVal ?? get(shouldFilter);
		if (!state.search || !$shouldFilter) {
			return state;
		}

		const scores = state.filtered.items;

		// sort groups
		const groups: [string, number][] = [];
		const $allGroups = get(allGroups);

		state.filtered.groups.forEach((value) => {
			const items = $allGroups.get(value);
			if (!items) return;
			// get max score of the group's items
			let max = 0;
			items.forEach((item) => {
				const score = scores.get(item);
				if (isUndefined(score)) return;
				max = Math.max(score, max);
			});
			groups.push([value, max]);
		});

		// Sort items within groups to bottom
		// sort items outside of groups
		// sort groups to bottom (pushed all non-grouped items to the top)
		const rootEl = document.getElementById(ids.root);
		if (!rootEl) return state;
		const list = rootEl.querySelector(LIST_SELECTOR);

		// Sort the items
		getValidItems(rootEl)
			.sort((a, b) => {
				const valueA = a.getAttribute(VALUE_ATTR) ?? '';
				const valueB = b.getAttribute(VALUE_ATTR) ?? '';
				return (scores.get(valueA) ?? 0) - (scores.get(valueB) ?? 0);
			})
			.forEach((item) => {
				const group = item.closest(GROUP_ITEMS_SELECTOR);
				const closest = item.closest(`${GROUP_ITEMS_SELECTOR} > *`);
				if (isHTMLElement(group)) {
					if (item.parentElement === group) {
						group.appendChild(item);
					} else {
						if (!isHTMLElement(closest)) return;
						group.appendChild(closest);
					}
				} else {
					if (!isHTMLElement(list)) return;
					if (item.parentElement === list) {
						list.appendChild(item);
					} else {
						if (!isHTMLElement(closest)) return;
						list.appendChild(closest);
					}
				}
			});

		groups
			.sort((a, b) => b[1] - a[1])
			.forEach((group) => {
				const el = rootEl.querySelector(`${GROUP_SELECTOR}[${VALUE_ATTR}="${group[0]}"]`);
				if (!isHTMLElement(el)) return;
				el.parentElement?.appendChild(el);
			});
		return state;
	}

	function selectFirstItem() {
		const item = getValidItems().find((item) => !item.ariaDisabled);
		if (!item) return;
		const value = item.getAttribute(VALUE_ATTR);
		if (!value) return;
		return value;
	}

	function score(value: string | undefined, search: string) {
		const lowerCaseAndTrimmedValue = value?.toLowerCase().trim();
		const filterFn = get(filter);
		if (!filterFn) {
			return lowerCaseAndTrimmedValue ? defaultFilter(lowerCaseAndTrimmedValue, search) : 0;
		}
		return lowerCaseAndTrimmedValue ? filterFn(lowerCaseAndTrimmedValue, search) : 0;
	}

	function scrollSelectedIntoView() {
		const item = getSelectedItem();
		if (!item) {
			return;
		}
		if (item.parentElement?.firstChild === item) {
			tick().then(() =>
				item.closest(GROUP_SELECTOR)?.querySelector(GROUP_HEADING_SELECTOR)?.scrollIntoView({
					block: 'nearest'
				})
			);
		}
		tick().then(() => item.scrollIntoView({ block: 'nearest' }));
	}

	function getValidItems(rootElement?: HTMLElement) {
		const rootEl = rootElement ?? document.getElementById(ids.root);
		if (!rootEl) return [];
		return Array.from(rootEl.querySelectorAll(VALID_ITEM_SELECTOR)).filter(
			(el): el is HTMLElement => isHTMLElement(el)
		);
	}

	function getSelectedItem(rootElement?: HTMLElement) {
		const rootEl = rootElement ?? document.getElementById(ids.root);
		if (!rootEl) return;
		const selectedEl = rootEl.querySelector(`${VALID_ITEM_SELECTOR}[aria-selected="true"]`);
		if (!isHTMLElement(selectedEl)) return null;
		return selectedEl;
	}

	function updateSelectedToIndex(index: number) {
		const rootEl = document.getElementById(ids.root);
		if (!rootEl) return;
		const items = getValidItems(rootEl);
		const item = items[index];
		if (!item) return;
	}

	function updateSelectedByChange(change: 1 | -1) {
		const selected = getSelectedItem();
		const items = getValidItems();
		const index = items.findIndex((item) => item === selected);

		// get item at this index
		let newSelected = items[index + change];

		if (get(loop)) {
			if (index + change < 0) {
				newSelected = items[items.length - 1];
			} else if (index + change === items.length) {
				newSelected = items[0];
			} else {
				newSelected = items[index + change];
			}
		}

		if (newSelected) {
			updateState('value', newSelected.getAttribute(VALUE_ATTR) ?? '');
		}
	}

	function updateSelectedToGroup(change: 1 | -1) {
		const selected = getSelectedItem();
		let group = selected?.closest(GROUP_SELECTOR);
		let item: HTMLElement | undefined | null = undefined;

		while (group && !item) {
			group =
				change > 0
					? findNextSibling(group, GROUP_SELECTOR)
					: findPreviousSibling(group, GROUP_SELECTOR);
			item = group?.querySelector(VALID_ITEM_SELECTOR);
		}

		if (item) {
			updateState('value', item.getAttribute(VALUE_ATTR) ?? '');
		} else {
			updateSelectedByChange(change);
		}
	}

	function last() {
		return updateSelectedToIndex(getValidItems().length - 1);
	}

	function next(e: KeyboardEvent) {
		e.preventDefault();

		if (e.metaKey) {
			last();
		} else if (e.altKey) {
			updateSelectedToGroup(1);
		} else {
			updateSelectedByChange(1);
		}
	}

	function prev(e: KeyboardEvent) {
		e.preventDefault();

		if (e.metaKey) {
			updateSelectedToIndex(0);
		} else if (e.altKey) {
			updateSelectedToGroup(-1);
		} else {
			updateSelectedByChange(-1);
		}
	}

	function handleRootKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case kbd.ARROW_DOWN:
				next(e);
				break;
			case kbd.ARROW_UP:
				prev(e);
				break;
			case kbd.HOME:
				// first item
				e.preventDefault();
				updateSelectedToIndex(0);
				break;
			case kbd.END:
				// last item
				e.preventDefault();
				last();
				break;
			case kbd.ENTER: {
				e.preventDefault();
				const item = getSelectedItem();
				if (item) {
					item.click();
				}
			}
		}
	}

	setContext(NAME, context);

	const stateStore = {
		subscribe: state.subscribe,
		update: state.update,
		set: state.set,
		updateState
	};

	setContext(STATE_NAME, stateStore);

	return {
		state: stateStore,
		handleRootKeydown,
		commandEl,
		ids
	};
}

function findNextSibling(el: Element, selector: string) {
	let sibling = el.nextElementSibling;

	while (sibling) {
		if (sibling.matches(selector)) return sibling;
		sibling = sibling.nextElementSibling;
	}
}

function findPreviousSibling(el: Element, selector: string) {
	let sibling = el.previousElementSibling;

	while (sibling) {
		if (sibling.matches(selector)) return sibling;
		sibling = sibling.previousElementSibling;
	}
}
