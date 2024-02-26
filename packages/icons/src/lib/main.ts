import AdblockOff from './Icons/AdblockOff.svelte'
import AdblockOn from './Icons/AdblockOn.svelte'
import Add from './Icons/Add.svelte'
import Arrow from './Icons/Arrow.svelte'
import ArrowBackUp from './Icons/ArrowBackUp.svelte'
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
import ArrowHorizontal from './Icons/ArrowHorizontal.svelte'
import ArrowDiagonalMinimize from './Icons/ArrowDiagonalMinimize.svelte'
import Search from './Icons/Search.svelte'
import Info from './Icons/Info.svelte'
import File from './Icons/File.svelte'
import Docs from './Icons/Docs.svelte'

export const icons = {
  adblockoff: AdblockOff,
  adblockon: AdblockOn,
  add: Add,
  arrow: Arrow,
  arrowbackup: ArrowBackUp,
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
  search: Search,
  quote: Quote,
  'code-block': CodeBlock,
  arrowHorizontal: ArrowHorizontal,
  arrowDiagonalMinimize: ArrowDiagonalMinimize,
  info: Info,
  file: File,
  docs: Docs
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
  CodeBlock,
  ArrowHorizontal,
  ArrowDiagonalMinimize,
  Search,
  Info,
  File,
  Docs
}
