import type { FileKind } from 'human-filetypes/data'
import type { Icons } from './main'

export type IconImage = {
  type: 'image'
  data: string
}

export type IconEmoji = {
  type: 'emoji'
  data: string
}

export type IconColors = {
  type: 'colors'
  data: [string, string]
}

export type IconIcon = {
  type: 'icon'
  data: Icons
}

export type IconFile = {
  type: 'file'
  data: FileKind | 'code'
}

export type Icon = IconImage | IconEmoji | IconColors | IconIcon | IconFile
