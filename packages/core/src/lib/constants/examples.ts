import { random } from '../service/demoitems'
import type { SpaceData, WithRequired } from '../types'

export const demoPages = [
  { id: random(), url: 'https://deta.surf' },
  {
    id: random(),
    url: 'https://deta.surf/cheatsheets/v0.0.1',
    active: true,
    pinned: true
  }
]

export const builtInSpaces = [
  {
    folderName: 'Media',
    colors: ['#76E0FF', '#4EC9FB'],
    liveModeEnabled: true,
    smartFilterQuery: 'Images, Videos or Audio Files',
    sql_query:
      "SELECT id FROM resources WHERE (resource_type LIKE 'image/%' OR resource_type LIKE 'video/%' OR resource_type LIKE 'audio/%') AND deleted = 0;"
  },
  {
    folderName: 'Files',
    colors: ['#76E0FF', '#4EC9FB'],
    liveModeEnabled: true,
    smartFilterQuery: 'Images, Videos or Audio Files',
    sql_query:
      "SELECT DISTINCT id FROM resources WHERE (resource_type NOT LIKE 'application/vnd.space.%' AND resource_type NOT LIKE 'image/%' AND resource_type NOT LIKE 'video/%' AND resource_type NOT LIKE 'audio/%') AND deleted = 0;"
  },
  {
    folderName: 'Documents',
    colors: ['#76E0FF', '#4EC9FB'],
    liveModeEnabled: true,
    smartFilterQuery: 'All my Documents',
    sql_query:
      "SELECT DISTINCT r.id FROM resources r JOIN resource_metadata rm ON r.id = rm.resource_id WHERE ((rm.source_uri IS NOT NULL AND (rm.source_uri LIKE 'https://docs.google.com/%' OR rm.source_uri LIKE 'https://onedrive.live.com/edit%')) OR (r.resource_type LIKE 'application/vnd.space.document%')) AND r.deleted = 0 AND r.resource_type NOT LIKE 'application/vnd.space.history-entry';"
  },
  {
    folderName: 'Bookmarks',
    colors: ['#76E0FF', '#4EC9FB'],
    liveModeEnabled: true,
    smartFilterQuery: 'All my articles and links',
    sql_query:
      "SELECT r.id FROM resources r LEFT JOIN resource_tags rt1 ON r.id = rt1.resource_id AND rt1.tag_name = 'silent' AND rt1.tag_value = 'true' LEFT JOIN resource_tags rt2 ON r.id = rt2.resource_id AND rt2.tag_name = 'hideInEverything' AND rt2.tag_value = 'true' WHERE r.deleted = 0 AND (r.resource_type IN ('application/vnd.space.link', 'application/vnd.space.article') OR r.resource_type LIKE 'application/vnd.space.post%') AND rt1.resource_id IS NULL AND rt2.resource_id IS NULL ORDER BY r.created_at;"
  }
] as WithRequired<SpaceData, 'folderName' | 'colors'>[]

export const demoSpaces = [
  {
    name: 'Deta',
    urls: ['https://deta.surf', 'https://deta.surf/cheatsheets/v0.0.1']
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
