import Copy from './Copy.svelte';
import Close from './Close.svelte';
import Add from './Add.svelte';

export const icons = {
    'copy': Copy,
    'close': Close,
    'add': Add
}

export type Icons = keyof typeof icons

export { default as Icon } from './Icon.svelte'