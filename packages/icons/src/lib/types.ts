import type { FileKind } from 'human-filetypes/data'
import type { Icons } from './main'

export enum IconTypes {
  IMAGE = 'image',
  ICON = 'icon',
  ICON_FILE = 'icon-file',
  FAVICON = 'favicon',
  EMOJI = 'emoji',
  COLORS = 'colors'
}

export type IconColors = {
  type: IconTypes.COLORS
  data: string[]
}

export type IconIcon = {
  type: IconTypes.ICON
  data: Icons
}

export type IconFile = {
  type: IconTypes.ICON_FILE
  data: FileKind | 'code'
}

export type IconImage = {
  type: IconTypes.IMAGE
  data: string
}

export type IconFavicon = {
  type: IconTypes.FAVICON
  data: string
}

export type IconEmoji = {
  type: IconTypes.EMOJI
  data: string
}

export type IconData = IconColors | IconIcon | IconImage | IconEmoji | IconFile | IconFavicon
