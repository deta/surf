import AdblockOff from './Icons/AdblockOff.svelte'
import AdblockOn from './Icons/AdblockOn.svelte'
import Add from './Icons/Add.svelte'
import Archive from './Icons/Archive.svelte'
import Arrow from './Icons/Arrow.svelte'
import ArrowBackUp from './Icons/ArrowBackUp.svelte'
import ChevronLeft from './Icons/ChevronLeft.svelte'
import ChevronRight from './Icons/ChevronRight.svelte'
import Close from './Icons/Close.svelte'
import Copy from './Icons/Copy.svelte'
import Download from './Icons/Download.svelte'
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
import Bookmark from './Icons/Bookmark.svelte'
import BookmarkFilled from './Icons/BookmarkFilled.svelte'
import SidebarLeft from './Icons/SidebarLeft.svelte'
import SidebarRight from './Icons/SidebarRight.svelte'
import SquareRotated from './Icons/SquareRotated.svelte'
import Home from './Icons/Home.svelte'
import Rectangle from './Icons/Rectangle.svelte'
import Spinner from './Icons/Spinner.svelte'
import Play from './Icons/Play.svelte'
import Check from './Icons/Check.svelte'
import Sparkles from './Icons/Sparkles.svelte'
import World from './Icons/World.svelte'
import Leave from './Icons/Leave.svelte'
import LayoutGridAdd from './Icons/LayoutGridAdd.svelte'
import ArrowLeft from './Icons/ArrowLeft.svelte'
import ArrowRight from './Icons/ArrowRight.svelte'
import Reload from './Icons/Reload.svelte'
import Trash from './Icons/Trash.svelte'
import Grid from './Icons/Grid.svelte'
import FileTextAi from './Icons/FileTextAI.svelte'
import Message from './Icons/Message.svelte'
import GripVertical from './Icons/GripVertical.svelte'
import Marker from './Icons/Marker.svelte'
import TextInsert from './Icons/TextInsert.svelte'

export const icons = {
  adblockoff: AdblockOff,
  adblockon: AdblockOn,
  add: Add,
  archive: Archive,
  arrow: Arrow,
  arrowbackup: ArrowBackUp,
  'chevron.left': ChevronLeft,
  'chevron.right': ChevronRight,
  close: Close,
  copy: Copy,
  download: Download,
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
  docs: Docs,
  bookmark: Bookmark,
  bookmarkFilled: BookmarkFilled,
  home: Home,
  'square.rotated': SquareRotated,
  rectangle: Rectangle,
  spinner: Spinner,
  'sidebar.left': SidebarLeft,
  'sidebar.right': SidebarRight,
  play: Play,
  check: Check,
  sparkles: Sparkles,
  world: World,
  leave: Leave,
  'layout-grid-add': LayoutGridAdd,
  'arrow.left': ArrowLeft,
  'arrow.right': ArrowRight,
  reload: Reload,
  trash: Trash,
  grid: Grid,
  'file-text-ai': FileTextAi,
  message: Message,
  'grip.vertical': GripVertical,
  marker: Marker,
  textInsert: TextInsert
}

export type Icons = keyof typeof icons

export { default as Icon } from './Icon.svelte'
export { default as IconConfirmation } from './IconConfirmation.svelte'

export {
  AdblockOff,
  AdblockOn,
  Add,
  ChevronLeft,
  ChevronRight,
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
  Docs,
  Bookmark,
  BookmarkFilled,
  Home,
  Spinner,
  SidebarLeft,
  SidebarRight,
  SquareRotated,
  Rectangle,
  Play,
  Check,
  Sparkles,
  World,
  Leave,
  LayoutGridAdd,
  ArrowLeft,
  ArrowRight,
  Reload,
  Trash,
  Grid,
  FileTextAi,
  Message,
  GripVertical,
  Marker,
  TextInsert
}
