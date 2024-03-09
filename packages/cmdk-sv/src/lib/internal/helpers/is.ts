export const isBrowser = typeof document !== 'undefined';

export function isHTMLElement(element: unknown): element is HTMLElement {
	return element instanceof HTMLElement;
}

export function isHTMLInputElement(element: unknown): element is HTMLInputElement {
	return element instanceof HTMLInputElement;
}

export function isUndefined(value: unknown): value is undefined {
	return value === undefined;
}
