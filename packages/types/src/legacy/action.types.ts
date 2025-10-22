export type ActionTrigger = 'schedule'
export type ScheduleActionInterval = 'rate' | 'cron'

export interface ActionBase {
  id: string
  name: string
  description: string
  trigger: ActionTrigger
  path?: string
  micro_name: string
  enabled: boolean
}

export interface ScheduleActionBase extends ActionBase {
  interval: string
  interval_type: ScheduleActionInterval
  interval_start?: string
  next_run: string
}

export interface ScheduleAction extends ScheduleActionBase {
  default_interval?: string
  default_interval_type?: ScheduleActionInterval
}

export type ScheduleActionUpdatePayload = Partial<
  Pick<ScheduleActionBase, 'enabled' | 'interval' | 'interval_type' | 'interval_start'>
>

export type Action = ScheduleAction
