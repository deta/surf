/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module 'svelte-autosize' {
  import type { Action } from 'svelte/action'

  export default Action<HTMLElement>
}
