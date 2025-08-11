import googleDocsIcon from '@horizon/core/public/assets/services/google.docs.png'
import googleKeepIcon from '@horizon/core/public/assets/services/google.keep.png'
import googleMeetIcon from '@horizon/core/public/assets/services/google.meet.png'
import googleSheetsIcon from '@horizon/core/public/assets/services/google.sheets.png'
import figmaIcon from '@horizon/core/public/assets/services/figma.png'
import dropboxPaperIcon from '@horizon/core/public/assets/services/dropboxpaper.png'
import codepenIcon from '@horizon/core/public/assets/services/codepen.png'
import notionIcon from '@horizon/core/public/assets/services/notion.png'
import placeholderIcon from '@horizon/core/public/assets/services/placeholder.png'
import asanaIcon from '@horizon/core/public/assets/services/asana.png'
import canvaIcon from '@horizon/core/public/assets/services/canva.png'
import craftIcon from '@horizon/core/public/assets/services/craft.png'
import deepnoteIcon from '@horizon/core/public/assets/services/deepnote.png'
import githubIcon from '@horizon/core/public/assets/services/github.png'
import googleFormsIcon from '@horizon/core/public/assets/services/google.forms.png'
import googleSlidesIcon from '@horizon/core/public/assets/services/google.slides.png'
import mediumIcon from '@horizon/core/public/assets/services/medium.png'
import replIcon from '@horizon/core/public/assets/services/replit.png'
import reqIcon from '@horizon/core/public/assets/services/req.png'
import trelloIcon from '@horizon/core/public/assets/services/trello.png'
import tldrawIcon from '@horizon/core/public/assets/services/tldraw.png'
import wordIcon from '@horizon/core/public/assets/services/word.png'
import excelIcon from '@horizon/core/public/assets/services/excel.png'
import powerpointIcon from '@horizon/core/public/assets/services/powerpoint.png'
import slackIcon from '@horizon/core/public/assets/services/slack.svg'
import discordIcon from '@horizon/core/public/assets/services/discord.svg'
import youtubeIcon from '@horizon/core/public/assets/services/youtube.svg'
import twitterIcon from '@horizon/core/public/assets/services/twitter.svg'
import { SERVICES } from '@deta/web-parser'

export function getServiceIcon(id: (typeof SERVICES)[number]['id']) {
  switch (id) {
    case 'reddit':
      return placeholderIcon // TODO: Add reddit icon
    case 'twitter':
      return twitterIcon
    case 'notion':
      return notionIcon
    case 'slack':
      return slackIcon
    case 'youtube':
      return youtubeIcon
    case 'discord':
      return discordIcon
    case 'tldraw':
      return tldrawIcon
    case 'google.docs':
      return googleDocsIcon
    case 'google.sheets':
      return googleSheetsIcon
    case 'google.keep':
      return googleKeepIcon
    case 'google.meet':
      return googleMeetIcon
    case 'google.forms':
      return googleFormsIcon
    case 'google.slides':
      return googleSlidesIcon
    case 'figma':
      return figmaIcon
    case 'dropbox.paper':
      return dropboxPaperIcon
    case 'codepen':
      return codepenIcon
    case 'placeholder':
      return placeholderIcon
    case 'asana':
      return asanaIcon
    case 'canva':
      return canvaIcon
    case 'craft':
      return craftIcon
    case 'deepnote':
      return deepnoteIcon
    case 'github':
      return githubIcon
    case 'github.codespace':
      return githubIcon
    case 'github.gists':
      return githubIcon
    case 'medium':
      return mediumIcon
    case 'repl':
      return replIcon
    case 'req':
      return reqIcon
    case 'trello':
      return trelloIcon
    case 'word':
      return wordIcon
    case 'excel':
      return excelIcon
    case 'powerpoint':
      return powerpointIcon
    default:
      return placeholderIcon
  }
}

export function getServiceRanking(id: (typeof SERVICES)[number]['id']) {
  const raw = localStorage.getItem(`service-rankings`)
  const parsed = JSON.parse(raw ?? '{}') as Record<string, number> // FIX: This can fail!
  const ranking = parsed[id]
  return ranking ?? 0
}
export function updateServiceRanking(id: (typeof SERVICES)[number]['id'], newValue: number) {
  const raw = localStorage.getItem(`service-rankings`)
  const parsed = JSON.parse(raw ?? '{}') as Record<string, number> // FIX: This can fail!
  parsed[id] = newValue
  localStorage.setItem(`service-rankings`, JSON.stringify(parsed))
}
