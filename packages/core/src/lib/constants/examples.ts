import { random } from '../service/demoitems'

export const demoPages = [
  { id: random(), url: 'https://deta.surf' },
  {
    id: random(),
    url: 'https://deta.surf/cheatsheets/v0.0.1',
    active: true,
    pinned: true
  }
]

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
