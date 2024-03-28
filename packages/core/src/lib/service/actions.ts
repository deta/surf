import type { HorizonAction } from '@horizon/types'
import { get, writable, type Writable } from 'svelte/store'
import { useLogScope } from '../utils/log'
import { getContext, setContext } from 'svelte'

export class ActionsService {
  static ContextKey = 'ActionsService'

  actions: Writable<HorizonAction[]>
  log: ReturnType<typeof useLogScope>

  constructor() {
    this.actions = writable([])
    this.log = useLogScope('ActionsService')
  }

  registerAction(action: HorizonAction) {
    this.log.debug('Registering action', action)
    this.actions.update((actions) => [...actions, action])
  }

  unregisterAction(id: string) {
    this.log.debug('Unregistering action', id)
    this.actions.update((actions) => actions.filter((a) => a.id !== id))
  }

  getActions() {
    return get(this.actions)
  }

  getAction(id: string) {
    return this.getActions().find((a) => a.id === id) ?? null
  }

  runAction(id: string, input: any) {
    const action = this.getAction(id)
    if (!action) {
      this.log.warn('Action not found', id)
      throw new Error('Action not found')
    }

    this.log.debug('Running action', action)

    return action.handle(input)
  }

  static provideActionsService() {
    const service = new ActionsService()
    setContext(ActionsService.ContextKey, service)

    return service
  }

  static useActionsService() {
    return getContext(ActionsService.ContextKey) as ActionsService
  }
}

export const provideActionsService = ActionsService.provideActionsService
export const useActionsService = ActionsService.useActionsService
