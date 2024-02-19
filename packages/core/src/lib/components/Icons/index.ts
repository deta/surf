import AdblockOff from './AdblockOff.svelte'
import AdblockOn from './AdblockOn.svelte'
import Add from './Add.svelte'
import Close from './Close.svelte'
import Copy from './Copy.svelte'
import Mute from './Muted.svelte'
import Unmute from './Unmute.svelte'

export const icons = {
  adblockoff: AdblockOff,
  adblockon: AdblockOn,
  add: Add,
  close: Close,
  copy: Copy,
  mute: Mute,
  unmute: Unmute
}

export type Icons = keyof typeof icons

export { default as Icon } from './Icon.svelte'
