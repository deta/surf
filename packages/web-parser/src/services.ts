import { ResourceTypes } from '@horizon/types'
import { WebService } from './types'

export const SERVICES: WebService[] = [
  {
    id: 'reddit',
    name: 'Reddit',
    matchHostname: /reddit.com/,
    supportedResources: [ResourceTypes.POST_REDDIT]
  },
  {
    id: 'twitter',
    name: 'Twitter',
    matchHostname: /twitter.com/,
    url: 'https://twitter.com',
    supportedResources: [ResourceTypes.POST_TWITTER]
  },
  {
    id: 'notion',
    name: 'Notion',
    matchHostname: /notion.so/,
    url: 'https://notion.new',
    supportedResources: [ResourceTypes.DOCUMENT_NOTION],
    showBrowserAction: true,
    browserActionUrl: 'https://notion.new',
    browserActionTitle: 'New Page'
  },
  {
    id: 'slack',
    name: 'Slack',
    matchHostname: /slack.com/,
    url: 'https://app.slack.com/client/T038ZUQCL/C038ZUQDQ', // TODO!!: This should be our channel!
    supportedResources: [ResourceTypes.CHAT_MESSAGE_SLACK, ResourceTypes.CHAT_THREAD_SLACK]
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com',
    matchHostname: /^(?:www\.|m\.)?youtube\.com$|^youtu\.be$/i,
    supportedResources: [ResourceTypes.POST_YOUTUBE]
  },

  {
    id: 'discord',
    name: 'Discord',
    matchHostname: /discord.com/,
    url: 'https://discord.com/channels/@me',
    supportedResources: []
  },

  // From BrowserCard
  {
    id: 'tldraw',
    name: 'tldraw',
    matchHostname: /tldraw.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://tldraw.com/new',
    browserActionTitle: 'New Sketch'
  },
  {
    id: 'google.docs',
    name: 'Google Docs',
    matchHostname: /docs.google.com/, // TODO: Right one?
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://docs.new',
    browserActionTitle: 'New Document'
  },
  {
    id: 'google.sheets',
    name: 'Google Sheets',
    matchHostname: /sheets.google.com/, // TDOO: Right one?
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://sheets.new',
    browserActionTitle: 'New Sheet'
  },
  {
    id: 'google.slides',
    name: 'Google Slides',
    matchHostname: /slides.google.com/, // TODO: right one?
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://slides.new',
    browserActionTitle: 'New Slides'
  },
  {
    id: 'google.keep',
    name: 'Google Keep',
    matchHostname: /keep.google.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://keep.new',
    browserActionTitle: 'New Note'
  },
  {
    id: 'dropbox.paper',
    name: 'Dropbox Paper',
    matchHostname: /dropbox.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'http://paper.new',
    browserActionTitle: 'New Paper'
  },
  {
    id: 'google.forms',
    name: 'Google Forms',
    matchHostname: /forms.google.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'http://form.new',
    browserActionTitle: 'New Form'
  },
  {
    id: 'craft',
    name: 'Craft Docs',
    matchHostname: /craft.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://craft.new',
    browserActionTitle: 'New Document'
  },
  {
    id: 'word',
    name: 'Word',
    matchHostname: /word.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://word.new',
    browserActionTitle: 'New Document'
  },
  {
    id: 'excel',
    name: 'Excel',
    matchHostname: /excel.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://excel.new',
    browserActionTitle: 'New Sheet'
  },
  {
    id: 'powerpoint',
    name: 'Powerpoint',
    matchHostname: /powerpoint.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://powerpoint.new',
    browserActionTitle: 'New Slides'
  },

  // Design
  {
    id: 'figma',
    name: 'Figma',
    matchHostname: /figma.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://www.figma.new',
    browserActionTitle: 'New File'
  },
  {
    id: 'canva',
    name: 'Canva',
    matchHostname: /canva.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://design.new',
    browserActionTitle: 'New Design'
  },

  // Project and Task Management
  {
    id: 'asana',
    name: 'Asana',
    matchHostname: /asana.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://task.new',
    browserActionTitle: 'New Task'
  },
  {
    id: 'trello',
    name: 'Trello',
    matchHostname: /trello.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://trello.new',
    browserActionTitle: 'New Board'
  },
  {
    id: 'google.meet',
    name: 'Google Meet',
    matchHostname: /meet.google.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://meet.new',
    browserActionTitle: 'New Meeting'
  },

  // Development Tools
  {
    id: 'github.gists',
    name: 'GitHub Gists',
    matchHostname: /gist.github.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://gist.new',
    browserActionTitle: 'New Gist'
  },
  {
    id: 'github',
    name: 'GitHub',
    matchHostname: /github.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://github.new',
    browserActionTitle: 'New Repository'
  },
  {
    id: 'github.codespace',
    name: 'GitHub Codespace',
    matchHostname: /codespace.github.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://codespace.new',
    browserActionTitle: 'New Codespace'
  },
  {
    id: 'codepen',
    name: 'Codepen',
    matchHostname: /codepen.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://codepen.io/pen/',
    browserActionTitle: 'New Pen'
  },
  {
    id: 'deepnote',
    name: 'Deepnote',
    matchHostname: /deepnote.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://deepnote.new',
    browserActionTitle: 'New Project'
  },
  {
    id: 'repl',
    name: 'Repl.it',
    matchHostname: /repl.it/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://repl.new',
    browserActionTitle: 'New Repl'
  },

  // Other Services
  {
    id: 'medium',
    name: 'Medium',
    matchHostname: /medium.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://story.new',
    browserActionTitle: 'New Story'
  },
  {
    id: 'req',
    name: 'Req',
    matchHostname: /req.com/,
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://req.new',
    browserActionTitle: 'New Request'
  }
]
