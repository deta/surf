import { random } from './demoitems'

export const demoPages = [
  { id: random(), url: 'https://deta.surf' },
  {
    id: random(),
    url: 'https://deta.notion.site/Cheatsheet-August-9-d97cea3be250465c8003ba6567b2ab7a?pvs=4',
    active: true,
    pinned: true
  }
]

export const demoSpaces = [
  {
    name: 'Deta',
    urls: [
      'https://deta.surf',
      'https://deta.notion.site/Cheatsheet-August-9-d97cea3be250465c8003ba6567b2ab7a?pvs=4'
    ]
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
