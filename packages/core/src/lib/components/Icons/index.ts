import Copy from './Copy.svelte';
import Close from './Close.svelte';

export const icons = {
    'copy': Copy,
    'close': Close,
}

export type Icons = keyof typeof icons

export { default as Icon } from './Icon.svelte'