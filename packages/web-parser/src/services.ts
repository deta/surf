import { ResourceTypes } from '@deta/types'
import type { WebService } from './types'

export const SERVICES: WebService[] = [
  {
    id: 'reddit',
    name: 'Reddit',
    matchHostname: /reddit.com/,
    url: 'https://reddit.com',
    supportedResources: [ResourceTypes.POST_REDDIT]
  },
  {
    id: 'twitter',
    name: 'Twitter',
    matchHostname: /twitter.com|x.com/,
    url: 'https://twitter.com',
    supportedResources: [ResourceTypes.POST_TWITTER],
    actions: [
      {
        id: 'get_bookmarks_from_twitter',
        name: 'Get Bookmarks',
        description: 'Get the bookmarks from Twitter',
        default: false,
        inputs: {},
        output: {
          type: ResourceTypes.POST_TWITTER,
          description: 'the bookmarks as links'
        }
      }
    ]
  },
  {
    id: 'notion',
    name: 'Notion',
    matchHostname: /notion.so/,
    url: 'https://notion.so',
    supportedResources: [ResourceTypes.DOCUMENT_NOTION],
    showBrowserAction: true,
    browserActionUrl: 'https://notion.new',
    browserActionTitle: 'New Page',
    actions: [
      {
        id: 'get_page_content_from_notion',
        name: 'Get Page',
        description: 'Get the content of the page form Notion',
        default: true,
        inputs: {},
        output: {
          type: ResourceTypes.DOCUMENT_NOTION,
          description: 'the page content'
        }
      },
      {
        id: 'update_page_content_in_notion',
        name: 'Update Page',
        description: 'Update the content of the page in Notion',
        default: false,
        inputs: {
          content: {
            type: 'string',
            description: 'the page content to insert into the page'
          }
        },
        output: null
      }
    ]
  },
  {
    id: 'slack',
    name: 'Slack',
    matchHostname: /slack.com/,
    url: 'https://app.slack.com/client/T038ZUQCL/C038ZUQDQ', // TODO!!: This shouldnt be our channel!
    supportedResources: [ResourceTypes.CHAT_MESSAGE_SLACK, ResourceTypes.CHAT_THREAD_SLACK]
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com',
    matchHostname: /^(?:www\.|m\.)?youtube\.com$|^youtu\.be$/i,
    supportedResources: [ResourceTypes.POST_YOUTUBE],
    actions: [
      {
        id: 'get_posts_from_youtube_playlist',
        name: 'Get Posts from Playlist',
        description: 'Get the posts from a YouTube playlist',
        default: false,
        inputs: {},
        output: {
          type: ResourceTypes.POST_YOUTUBE,
          description: 'the posts from the playlist'
        }
      }
    ]
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
    url: 'https://tldraw.com/new',
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://tldraw.com/new',
    browserActionTitle: 'New Sketch'
  },
  {
    id: 'google.docs',
    name: 'Google Docs',
    matchHostname: /docs.google.com/, // TODO : Right one?
    matchPathname: /\/document\/([^\s]+)/,
    url: 'https://docs.new',
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://docs.new',
    browserActionTitle: 'New Document'
  },
  {
    id: 'google.sheets',
    name: 'Google Sheets',
    matchHostname: /docs.google.com/, // TDOO: Right one?
    matchPathname: /\/spreadsheets\/([^\s]+)/,
    url: 'https://sheets.new',
    supportedResources: [ResourceTypes.TABLE_GOOGLE_SHEET, ResourceTypes.TABLE_COLUMN_GOOGLE_SHEET],
    showBrowserAction: true,
    browserActionUrl: 'https://sheets.new',
    browserActionTitle: 'New Sheet',
    actions: [
      {
        id: 'get_table_from_googlesheet',
        name: 'Get Table',
        description: 'Get the table content',
        default: true,
        inputs: {},
        output: {
          type: ResourceTypes.TABLE_GOOGLE_SHEET,
          description: 'the table content as CSV'
        }
      },
      {
        id: 'get_table_column_from_googlesheet',
        name: 'Get Table Column',
        description: 'Get the column content',
        default: false,
        inputs: {
          column: {
            type: 'text/plain',
            description: 'the name of the column to extract from the table'
          }
        },
        output: {
          type: ResourceTypes.TABLE_COLUMN_GOOGLE_SHEET,
          description: 'the table column'
        }
      },
      {
        id: 'set_table_in_googlesheet',
        name: 'Set Table',
        description: 'Sets the table contents',
        default: false,
        inputs: {
          table: {
            type: 'string',
            description: 'set the csv formatted table'
          }
        },
        output: null
      }
    ]
  },
  {
    id: 'google.slides',
    name: 'Google Slides',
    matchHostname: /docs.google.com/, // TODO: right one?
    url: 'https://slides.new',
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://slides.new',
    browserActionTitle: 'New Slides'
  },
  {
    id: 'google.keep',
    name: 'Google Keep',
    matchHostname: /keep.google.com/,
    url: 'https://keep.new',
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://keep.new',
    browserActionTitle: 'New Note'
  },
  {
    id: 'dropbox.paper',
    name: 'Dropbox Paper',
    matchHostname: /dropbox.com/,
    url: 'http://paper.new',
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'http://paper.new',
    browserActionTitle: 'New Paper'
  },
  {
    id: 'google.forms',
    name: 'Google Forms',
    matchHostname: /forms.google.com/,
    url: 'http://form.new',
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'http://form.new',
    browserActionTitle: 'New Form'
  },
  {
    id: 'craft',
    name: 'Craft Docs',
    matchHostname: /craft.com/,
    url: 'https://craft.new',
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
  {
    id: 'typeform',
    name: 'Typeform',
    matchHostname: /typeform.com/,
    supportedResources: [ResourceTypes.TABLE_TYPEFORM, ResourceTypes.TABLE_COLUMN_TYPEFORM],
    showBrowserAction: false,
    browserActionUrl: undefined,
    browserActionTitle: undefined,
    actions: [
      {
        id: 'get_table_from_typeform',
        name: 'Get Table',
        description: 'Get the table content as text from Typeform',
        default: true,
        inputs: {},
        output: {
          type: ResourceTypes.TABLE_TYPEFORM,
          description: 'the table content as CSV formatted text'
        }
      },
      {
        id: 'get_table_column_from_typeform',
        name: 'Get Table Column',
        description: 'Get the content of the column from typeform as text',
        default: false,
        inputs: {
          column: {
            type: 'string',
            description: 'the name of the column to extract from the table'
          }
        },
        output: {
          type: ResourceTypes.TABLE_COLUMN_TYPEFORM,
          description: 'the table column content as text'
        }
      }
    ]
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
    url: 'https://gist.github.com',
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://gist.new',
    browserActionTitle: 'New Gist'
  },
  {
    id: 'github',
    name: 'GitHub',
    matchHostname: /github.com/,
    url: 'https://github.com',
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://github.new',
    browserActionTitle: 'New Repository'
  },
  {
    id: 'github.codespace',
    name: 'GitHub Codespace',
    matchHostname: /codespace.github.com/,
    url: 'https://codespace.github.com',
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://codespace.new',
    browserActionTitle: 'New Codespace'
  },
  {
    id: 'codepen',
    name: 'Codepen',
    matchHostname: /codepen.com/,
    url: 'https://codepen.io/',
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://codepen.io/pen/',
    browserActionTitle: 'New Pen'
  },
  {
    id: 'deepnote',
    name: 'Deepnote',
    matchHostname: /deepnote.com/,
    url: 'https://deepnote.new',
    supportedResources: [],
    showBrowserAction: true,
    browserActionUrl: 'https://deepnote.new',
    browserActionTitle: 'New Project'
  },
  {
    id: 'repl',
    name: 'Repl.it',
    matchHostname: /repl.it/,
    url: 'https://repl.new',
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
    url: 'https://medium.com',
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
