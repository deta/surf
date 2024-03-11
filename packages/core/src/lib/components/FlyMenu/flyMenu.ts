import type { Writable } from 'svelte/store'
import type { Card } from '../../types'
import { SERVICES } from '@horizon/web-parser'
import { getServiceRanking } from '../../utils/services'

export const DEFAULT_FLY_ACTIONS = {
  // Card management

  // Magic cards

  // Horizon management
  NEW_HORIZON: {},
  DELETE_HORIZON: {},

  OPEN_OVERVIEW: {},
  OPEN_VISOR: {},
  OPEN_OASIS: {}

  // Multi selected
  //OPEN_IN_FOCUS_VIEW: {},
  //DELETE_CARDS: {},
}

export function buildOptionList() {
  // TODO: Get active app options
  // TODO: Magic card options
}

export function buildAppList() {
  const services = SERVICES.map((s) => ({ name: s.name, rank: getServiceRanking(s.id) })).filter(
    (e) => e.rank > 0
  )
  const sorted = services.sort((a, b) => b.rank - a.rank)

  return [
    ...sorted.slice(0, 4).map((e) => ({
      icon: '',
      value: `${e.name}`,
      type: 'app'
    }))
  ]
}

// TDOO: Multi selevtion actions
export function buildDefaultList() {
  return [
    { icon: '🃏', value: 'Browser', type: 'card' },
    { icon: '🃏', value: 'Text', type: 'card' },

    ...buildAppList(),
    // { icon: '', value: 'Slack', type: 'app' },
    // { icon: '', value: 'Notion', type: 'app' },
    // { icon: '', value: 'Discord', type: 'app' },
    // { icon: '', value: 'YouTube', type: 'app' },
    // { icon: '', value: 'Twitter', type: 'app' },

    { icon: '🔮', value: 'Summarize', type: 'magic-card' },
    { icon: '🔮', value: 'Transcribe', type: 'magic-card' },

    // { icon: '⚡️', value: 'Open Overview', type: 'action' },
    // { icon: '⚡️', value: 'Open Visor', type: 'action' },
    // { icon: '⚡️', value: 'Open Focus Mode', type: 'action' },
    { icon: '⚡️', value: 'New Horizon', type: 'action' },
    { icon: '⚡️', value: 'Delete Horizon', type: 'action' }
  ]
}

export function buildMultiCardList() {
  return [
    { icon: '⚡️', value: 'Focus Cards', type: 'action' },
    { icon: '⚡️', value: 'Unpin Cards', type: 'action' }
  ]
}

export function buildCardList(card: Writable<Card>) {
  return [
    { icon: '⚡️', value: 'Focus Card', type: 'action' },
    { icon: '⚡️', value: 'Unpin Card', type: 'action' }
    //...buildDefaultList()
  ]
}

export interface IFlyMenuItem {
  icon: string
  value: string
  type: 'app' | 'action' | 'card' | 'magic-card'
}
