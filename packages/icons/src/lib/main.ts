import AdblockOff from './Icons/AdblockOff.svelte'
import AdblockOn from './Icons/AdblockOn.svelte'
import Add from './Icons/Add.svelte'
import Close from './Icons/Close.svelte'
import Copy from './Icons/Copy.svelte'
import Mute from './Icons/Muted.svelte'
import Unmute from './Icons/Unmute.svelte'
import Bold from './Icons/Bold.svelte'
import Italic from './Icons/Italic.svelte'
import Strike from './Icons/Strike.svelte'
import Code from './Icons/Code.svelte'
import H1 from './Icons/H1.svelte'
import H2 from './Icons/H2.svelte'
import Link from './Icons/Link.svelte'
import Paragraph from './Icons/Paragraph.svelte'
import List from './Icons/List.svelte'
import ListNumbered from './Icons/ListNumbered.svelte'
import ListCheck from './Icons/ListCheck.svelte'
import Quote from './Icons/Quote.svelte'
import CodeBlock from './Icons/CodeBlock.svelte'

export const icons = {
  adblockoff: AdblockOff,
  adblockon: AdblockOn,
  add: Add,
  close: Close,
  copy: Copy,
  mute: Mute,
  unmute: Unmute,
  bold: Bold,
  italic: Italic,
  strike: Strike,
  code: Code,
  h1: H1,
  h2: H2,
  h3: H2,
  link: Link,
  paragraph: Paragraph,
  list: List,
  'list-numbered': ListNumbered,
  'list-check': ListCheck,
  quote: Quote,
  'code-block': CodeBlock
}

export type Icons = keyof typeof icons

export { default as Icon } from './Icon.svelte'

export {
  AdblockOff,
  AdblockOn,
  Add,
  Close,
  Copy,
  Mute,
  Unmute,
  Bold,
  Italic,
  Strike,
  Code,
  H1,
  H2,
  Link,
  Paragraph,
  List,
  ListNumbered,
  ListCheck,
  Quote,
  CodeBlock
}
