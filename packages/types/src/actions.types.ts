export type HorizonActionInput = {
  type: string
  description: string
}

export type HorizonActionOutput = {
  type: string
  description: string
}

export type HorizonActionType = 'app' | 'system'

export type HorizonActionHandler<T> = (args: T) => Promise<any>

export type HorizonAction<T = any> = {
  handle: HorizonActionHandler<T>
  /** action id should be unique and snake case */
  id: string
  /** human readable name of the action */
  name: string
  /** description of what the action does */
  description: string
  /** what type of action / where the action came from  */
  type: HorizonActionType
  /** app id if the action is from an app */
  app?: string

  inputs: Record<string, HorizonActionInput>
  output: HorizonActionOutput
}
