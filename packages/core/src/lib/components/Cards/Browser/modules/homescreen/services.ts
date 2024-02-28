// Import each service icon directly
import googleDocsIcon from '../../../../../../../public/assets/services/google.docs.png'
import googleKeepIcon from '../../../../../../../public/assets/services/google.keep.png'
import googleMeetIcon from '../../../../../../../public/assets/services/google.meet.png'
import googleSheetsIcon from '../../../../../../../public/assets/services/google.sheets.png'
import figmaIcon from '../../../../../../../public/assets/services/figma.png'
import dropboxPaperIcon from '../../../../../../../public/assets/services/dropboxpaper.png'
import codepenIcon from '../../../../../../../public/assets/services/codepen.png'
import notionIcon from '../../../../../../../public/assets/services/notion.png'
import placeholderIcon from '../../../../../../../public/assets/services/placeholder.png'
import asanaIcon from '../../../../../../../public/assets/services/asana.png'
import canvaIcon from '../../../../../../../public/assets/services/canva.png'
import craftIcon from '../../../../../../../public/assets/services/craft.png'
import deepnoteIcon from '../../../../../../../public/assets/services/deepnote.png'
import githubIcon from '../../../../../../../public/assets/services/github.png'
import googleFormsIcon from '../../../../../../../public/assets/services/google.forms.png'
import googleSlidesIcon from '../../../../../../../public/assets/services/google.slides.png'
import mediumIcon from '../../../../../../../public/assets/services/medium.png'
import replIcon from '../../../../../../../public/assets/services/replit.png'
import reqIcon from '../../../../../../../public/assets/services/req.png'
import trelloIcon from '../../../../../../../public/assets/services/trello.png'
import tldrawIcon from '../../../../../../../public/assets/services/tldraw.png'
import wordIcon from '../../../../../../../public/assets/services/word.png'
import excelIcon from '../../../../../../../public/assets/services/excel.png'
import powerpointIcon from '../../../../../../../public/assets/services/powerpoint.png'

export const services = [
  // Document Creation and Note Taking
  {
    service: 'notion',
    title: 'Notion',
    icon: notionIcon,
    url: 'https://notion.new',
    action: 'New Page'
  },
  {
    service: 'tldraw',
    title: 'tldraw',
    icon: tldrawIcon,
    url: 'https://tldraw.com/new',
    action: 'New Sketch'
  },
  {
    service: 'google.docs',
    title: 'Google Docs',
    icon: googleDocsIcon,
    url: 'https://docs.new',
    action: 'New Document'
  },
  {
    service: 'google.sheets',
    title: 'Google Sheets',
    icon: googleSheetsIcon,
    url: 'https://sheets.new',
    action: 'New Sheet'
  },
  {
    service: 'google.slides',
    title: 'Google Slides',
    icon: googleSlidesIcon,
    url: 'https://slides.new',
    action: 'New Slides'
  },
  {
    service: 'google.keep',
    title: 'Google Keep',
    icon: googleKeepIcon,
    url: 'https://keep.new',
    action: 'New Note'
  },
  {
    service: 'dropbox.paper',
    title: 'Dropbox Paper',
    icon: dropboxPaperIcon,
    url: 'http://paper.new',
    action: 'New Paper'
  },
  {
    service: 'google.forms',
    title: 'Google Forms',
    icon: googleFormsIcon,
    url: 'http://form.new',
    action: 'New Form'
  },
  {
    service: 'craft',
    title: 'Craft Docs',
    icon: craftIcon,
    url: 'https://craft.new',
    action: 'New Document'
  },
  {
    service: 'word',
    title: 'Word',
    icon: wordIcon,
    url: 'https://word.new',
    action: 'New Document'
  },
  {
    service: 'excel',
    title: 'Excel',
    icon: excelIcon,
    url: 'https://excel.new',
    action: 'New Sheet'
  },
  {
    service: 'powerpoint',
    title: 'Powerpoint',
    icon: powerpointIcon,
    url: 'https://powerpoint.new',
    action: 'New Slides'
  },

  // Design
  {
    service: 'figma',
    title: 'Figma',
    icon: figmaIcon,
    url: 'https://www.figma.new',
    action: 'New File'
  },
  {
    service: 'canva',
    title: 'Canva',
    icon: canvaIcon,
    url: 'https://design.new',
    action: 'New Design'
  },

  // Project and Task Management
  {
    service: 'asana',
    title: 'Asana',
    icon: asanaIcon,
    url: 'https://task.new',
    action: 'New Task'
  },
  {
    service: 'trello',
    title: 'Trello',
    icon: trelloIcon,
    url: 'https://trello.new',
    action: 'New Board'
  },
  {
    service: 'google.meet',
    title: 'Google Meet',
    icon: googleMeetIcon,
    url: 'https://meet.new',
    action: 'New Meeting'
  },

  // Development Tools
  {
    service: 'github.gists',
    title: 'GitHub Gists',
    icon: githubIcon,
    url: 'https://gist.new',
    action: 'New Gist'
  },
  {
    service: 'github',
    title: 'GitHub',
    icon: githubIcon,
    url: 'https://github.new',
    action: 'New Repository'
  },
  {
    service: 'github.codespace',
    title: 'GitHub Codespace',
    icon: githubIcon,
    url: 'https://codespace.new',
    action: 'New Codespace'
  },
  {
    service: 'codepen',
    title: 'Codepen',
    icon: codepenIcon,
    url: 'https://codepen.io/pen/',
    action: 'New Pen'
  },
  {
    service: 'deepnote',
    title: 'Deepnote',
    icon: deepnoteIcon,
    url: 'https://deepnote.new',
    action: 'New Project'
  },
  {
    service: 'repl',
    title: 'Repl.it',
    icon: replIcon,
    url: 'https://repl.new',
    action: 'New Repl'
  },

  // Other Services
  {
    service: 'medium',
    title: 'Medium',
    icon: mediumIcon,
    url: 'https://story.new',
    action: 'New Story'
  },
  {
    service: 'req',
    title: 'Req',
    icon: reqIcon,
    url: 'https://req.new',
    action: 'New Request'
  }
]
