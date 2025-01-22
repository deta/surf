import { useLogScope } from '@horizon/utils'

/** Right now, its just used for the "mail" notifications on the stack. But ideally other notifications
 * can also be ran through this. */
export class NotificationService {
  static self: NotificationService
  log: ReturnType<typeof useLogScope>

  constructor() {
    this.log = useLogScope('Notification')
  }

  /** Check if conditions are met to notify the user to set Surf as their
   * default browser. */
  async tryNotifySetDefaultBrowser() {
    this.log.warn('tring to notify set default browser')

    if ((await window.api.isDefaultBrowser()) === true) return
    this.log.warn('not default! checking conditions')
  }

  static provide() {
    const service = new NotificationService()
    NotificationService.self = service
    return NotificationService.self
  }

  static use() {
    if (!NotificationService.self) {
      console.error('Notification service doesnt exist! This shouldt happen!')
    }
    return NotificationService.self
  }
}

export const provideNotifications = NotificationService.provide
export const useNotifications = NotificationService.use
