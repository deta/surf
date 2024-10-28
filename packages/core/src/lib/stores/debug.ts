import { derived, writable } from 'svelte/store'

export const debugMode = writable(import.meta.env.DEV || false)
export const isDebugModeEnabled = derived(debugMode, ($debugMode) => $debugMode)
