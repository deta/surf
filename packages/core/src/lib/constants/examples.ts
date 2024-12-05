import { random } from '../service/demoitems'
import type { SpaceData, WithRequired } from '../types'

// export const demoPages = [
//   { id: random(), url: 'https://deta.surf' },
//   {
//     id: random(),
//     url: 'https://deta.surf/cheatsheets/v0.0.1',
//     active: true,
//     pinned: true
//   }
// ]

export const builtInSpaces = [
  {
    folderName: 'Files',
    colors: ['#3EAD4A', '#2CAB3A'],
    liveModeEnabled: true,
    smartFilterQuery: 'Files and Media (Images, Videos, Audio)',
    sql_query:
      "SELECT id FROM resources WHERE (resource_type LIKE 'image/%' OR resource_type LIKE 'video/%' OR resource_type LIKE 'audio/%') AND deleted = 0 AND resource_type NOT LIKE 'application/vnd.space.%';"
  },
  {
    folderName: 'Documents',
    colors: ['#6B4EFB', '#5534F7'],
    liveModeEnabled: true,
    smartFilterQuery: 'All my Documents',
    sql_query:
      "SELECT DISTINCT r.id FROM resources r JOIN resource_metadata rm ON r.id = rm.resource_id WHERE ((rm.source_uri IS NOT NULL AND (rm.source_uri LIKE 'https://docs.google.com/%' OR rm.source_uri LIKE 'https://onedrive.live.com/edit%')) OR (r.resource_type LIKE 'application/vnd.space.document%')) AND r.deleted = 0 AND r.resource_type NOT LIKE 'application/vnd.space.history-entry';"
  },
  {
    folderName: 'Bookmarks',
    colors: ['#F74545', '#f22727'],
    liveModeEnabled: true,
    smartFilterQuery: 'All my articles and links',
    sql_query: `SELECT r.id
        FROM resources r
        WHERE r.deleted = 0
        AND (r.resource_type IN ('application/vnd.space.link', 'application/vnd.space.article')
             OR r.resource_type LIKE 'application/vnd.space.post%')
        AND NOT EXISTS (
            SELECT 1
            FROM resource_tags rt
            WHERE rt.resource_id = r.id
            AND rt.tag_name = 'silent'
            AND rt.tag_value = 'true'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM resource_tags rt
            WHERE rt.resource_id = r.id
            AND rt.tag_name = 'hideInEverything'
            AND rt.tag_value = 'true'
        )
        ORDER BY r.created_at;`
  }
] as WithRequired<SpaceData, 'folderName' | 'colors'>[]

export const onboardingSpace = {
  name: 'Alan Kay',
  query: "Why hasn't the computer revolution happened yet and how is this tied to simplicity?",
  urls: [
    'https://de.wikipedia.org/wiki/Xerox_PARC',
    'https://www.youtube.com/watch?v=NdSD07U5uBs',
    'https://www.youtube.com/watch?v=oKg1hTOQXoY',
    'https://de.wikipedia.org/wiki/Alan_Kay'
  ]
}

export interface OnboardingTab {
  title: string
  url: string
}

export const onboardingPDF: string = 'https://tinlizzie.org/VPRIPapers/Kay_How.pdf'

export const onboardingYoutube: string = 'https://www.youtube.com/watch?v=VKpaK670U7s'

export const onboardingTabs: string[] = ['https://en.wikipedia.org/wiki/PlayStation_(console)']

export const onboardingResources: OnboardingTab[] = [
  {
    title: 'Vannevar Bush',
    url: 'https://en.wikipedia.org/wiki/Vannevar_Bush'
  },
  {
    title: 'The Dream Machine',
    url: 'https://www.goodreads.com/book/show/722412.The_Dream_Machine'
  }
]

export const liveSpaces = [
  {
    name: 'Hackernews',
    rss: 'https://news.ycombinator.com/rss',
    active: true
  },
  {
    name: 'The Verge Youtube',
    rss: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCddiUEpeqJcYeBxX1IVBKvQ',
    active: false
  }
]
