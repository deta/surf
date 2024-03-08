import type { HTMLAttributes } from 'svelte/elements';
import type { TransitionConfig } from 'svelte/transition';

export type Expand<T> = T extends object
	? T extends infer O
		? { [K in keyof O]: O[K] }
		: never
	: T;

export type ValueOf<T> = T[keyof T];

export type HTMLDivAttributes = HTMLAttributes<HTMLDivElement>;

export type Prettify<T> = {
	[K in keyof T]: T[K];
	// eslint-disable-next-line @typescript-eslint/ban-types
} & {};

export type RenameProperties<T, NewNames extends Partial<Record<keyof T, string>>> = Expand<{
	[K in keyof T as K extends keyof NewNames
		? NewNames[K] extends PropertyKey
			? NewNames[K]
			: K
		: K]: T[K];
}>;

export type PrefixKeys<T, Prefix extends string> = Expand<{
	[K in keyof T as `${Prefix}${Capitalize<string & K>}`]: T[K];
}>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Transition = (node: Element, params?: any) => TransitionConfig;

export type Arrayable<T> = T | T[];
