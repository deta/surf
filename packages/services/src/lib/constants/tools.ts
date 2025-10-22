import type { AITool } from '@deta/types'

export const AI_TOOLS = [
  {
    id: 'websearch',
    name: 'Web Search',
    icon: 'world',
    active: true,
    disabled: false
  },
  {
    id: 'surflet',
    name: 'App Generation',
    icon: 'code',
    active: true,
    disabled: false
  },
  {
    id: 'image-generation',
    name: 'Image Generation',
    icon: 'screenshot',
    active: false,
    disabled: true
  }
] as AITool[]
