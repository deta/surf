/* eslint-disable @typescript-eslint/ban-types */
import type { Expand, HTMLDivAttributes, Transition, PrefixKeys } from '$lib/internal/index.js';
import type { Dialog as DialogPrimitive } from 'bits-ui';
import type { HTMLInputAttributes } from 'svelte/elements';
import type { Writable } from 'svelte/store';

//
// PROPS
//

export type LoadingProps = {
	/** Estimated loading progress */
	progress?: number;

	/**
	 * Whether to delegate rendering to a custom element.
	 *
	 * The contents within the `Loading` component should be marked
	 * as `aria-hidden` to prevent screen readers from reading the
	 * contents while loading.
	 */
	asChild?: boolean;
} & HTMLDivAttributes;

export type EmptyProps = {
	/**
	 * Whether to delegate rendering to a custom element.
	 *
	 * Only receives `attrs`, no `action`.
	 */
	asChild?: boolean;
} & HTMLDivAttributes;

export type SeparatorProps = {
	/**
	 * Whether this separator is always rendered, regardless
	 * of the filter.
	 */
	alwaysRender?: boolean;

	/**
	 * Whether to delegate rendering to a custom element.
	 */
	asChild?: boolean;
} & HTMLDivAttributes;

type BaseCommandProps = {
	/**
	 * Controlled state store for the command menu.
	 * Initialize state using the `createState` function.
	 */
	state?: Writable<State>;

	/**
	 * An accessible label for the command menu.
	 * Not visible & only used for screen readers.
	 */
	label?: string;

	/**
	 * Optionally set to `false` to turn off the automatic filtering
	 * and sorting. If `false`, you must conditionally render valid
	 * items yourself.
	 */
	shouldFilter?: boolean;

	/**
	 * A custom filter function for whether each command item should
	 * match the query. It should return a number between `0` and `1`,
	 * with `1` being a perfect match, and `0` being no match, resulting
	 * in the item being hidden entirely.
	 *
	 * By default, it will use the `command-score` package to score.
	 */
	filter?: (value: string, search: string) => number;

	/**
	 * Optionally provide or bind to the selected command menu item.
	 */
	value?: string;

	/**
	 * A function that is called when the selected command menu item
	 * changes. It receives the new value as an argument.
	 */
	onValueChange?: (value: string) => void;

	/**
	 * Optionally set to `true` to enable looping through the items
	 * when the user reaches the end of the list using the keyboard.
	 */
	loop?: boolean;
};

export type CommandProps = Expand<
	BaseCommandProps & {
		/**
		 * Optionally provide custom ids for the command menu
		 * elements. These ids should be unique and are only
		 * necessary in very specific cases. Use with caution.
		 */
		ids?: Partial<CommandIds>;
	}
> &
	HTMLDivAttributes & {
		onKeydown?: (e: KeyboardEvent) => void;
		asChild?: boolean;
	};

export type ListProps = {
	/**
	 * The list element
	 */
	el?: HTMLElement;

	/**
	 * Whether to delegate rendering to a custom element.
	 *
	 * Provides 2 slot props: `container` & `list`.
	 * Container only has an `attrs` property, while `list` has
	 * `attrs` & `action` to be applied to the respective elements.
	 *
	 * The `list` wraps the `sizer`, and the `sizer` wraps the `items`, and
	 * is responsible for measuring the height of the items and setting the
	 * CSS variable to the height of the items.
	 */
	asChild?: boolean;
} & HTMLDivAttributes;

export type InputProps = {
	/**
	 * The input element
	 */
	el?: HTMLInputElement;

	/**
	 * Whether to delegate rendering to a custom element.
	 */
	asChild?: boolean;
} & HTMLInputAttributes;

export type GroupProps = {
	/**
	 * Optional heading to render for the group
	 */
	heading?: string;

	/**
	 * If heading isn't provided, you must provide a unique
	 * value for the group.
	 */
	value?: string;

	/**
	 * Whether or not this group is always rendered,
	 * regardless of filtering.
	 */
	alwaysRender?: boolean;

	/**
	 * Whether to delegate rendering to custom elements.
	 *
	 * Provides 3 slot props: `container`, `heading`, and `group`.
	 * Container has `attrs` & `action`, while `heading` & `group`
	 * only have `attrs` to be applied to the respective elements.
	 */
	asChild?: boolean;
} & HTMLDivAttributes;

export type ItemProps = {
	/**
	 * Whether this item is disabled.
	 */
	disabled?: boolean;

	/**
	 * A function called when this item is selected, either
	 * via click or keyboard selection.
	 */
	onSelect?: (value: string) => void;

	/**
	 * A unique value for this item.
	 * If not provided, it will be inferred from the rendered
	 * `textContent`. If your `textContent` is dynamic, you must
	 * provide a stable unique `value`.
	 */
	value?: string;

	/**
	 * Whether or not this item is always rendered,
	 * regardless of filtering.
	 */
	alwaysRender?: boolean;

	/**
	 * Whether to delegate rendering to a custom element.
	 * Will pass the `attrs` & `action` to be applied to the custom element.
	 */
	asChild?: boolean;

	/**
	 * Optionally override the default `id` generated for this item.
	 * NOTE: This must be unique across all items and is only necessary
	 * in very specific cases.
	 */
	id?: string;
} & HTMLDivAttributes;

type TransitionProps =
	| 'transition'
	| 'transitionConfig'
	| 'inTransition'
	| 'inTransitionConfig'
	| 'outTransition'
	| 'outTransitionConfig';

export type OverlayProps<
	T extends Transition = Transition,
	In extends Transition = Transition,
	Out extends Transition = Transition
> = PrefixKeys<Pick<DialogPrimitive.OverlayProps<T, In, Out>, TransitionProps>, 'overlay'> & {
	overlayClasses?: string;
};

export type ContentProps<
	T extends Transition = Transition,
	In extends Transition = Transition,
	Out extends Transition = Transition
> = PrefixKeys<Pick<DialogPrimitive.ContentProps<T, In, Out>, TransitionProps>, 'content'> & {
	contentClasses?: string;
};

export type DialogProps<
	ContentT extends Transition = Transition,
	ContentIn extends Transition = Transition,
	ContentOut extends Transition = Transition,
	OverlayT extends Transition = Transition,
	OverlayIn extends Transition = Transition,
	OverlayOut extends Transition = Transition
> = CommandProps &
	DialogPrimitive.Props &
	OverlayProps<OverlayT, OverlayIn, OverlayOut> &
	ContentProps<ContentT, ContentIn, ContentOut>;

//
// Events
//

export type InputEvents = {
	keydown: KeyboardEvent;
	blur: FocusEvent;
	input: Event;
	focus: FocusEvent;
	change: Event;
};

//
// Internal
//
export type CommandOptionStores = {
	[K in keyof Omit<Required<BaseCommandProps>, 'value'>]: Writable<CommandProps[K]>;
};

export type State = {
	/** The value of the search query */
	search: string;
	/** The value of the selected command menu item */
	value: string;
	/** The filtered items */
	filtered: {
		/** The count of all visible items. */
		count: number;
		/** Map from visible item id to its search store. */
		items: Map<string, number>;
		/** Set of groups with at least one visible item. */
		groups: Set<string>;
	};
};

export type CommandIds = Record<'root' | 'label' | 'input' | 'list', string>;

export type Context = {
	value: (id: string, value: string) => void;
	item: (id: string, groupId: string | undefined) => () => void;
	group: (id: string) => () => void;
	filter: () => boolean;
	label: string;
	commandEl: Writable<HTMLElement | null>;
	ids: CommandIds;
	updateState: UpdateState;
};

type UpdateState = <K extends keyof State>(
	key: K,
	value: State[K],
	preventScroll?: boolean
) => void;

export type ConextStore = Writable<Context>;

export type StateStore = Writable<State> & {
	updateState: UpdateState;
};

export type Group = {
	id: string;
	alwaysRender: boolean;
};
