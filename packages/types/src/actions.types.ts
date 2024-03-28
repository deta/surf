export type HorizonActionInput = {
  type: string
  name: string
  description: string
}

export type HorizonActionOutput = {
  type: string
  description: string
}

export type HorizonAction = {
  function: Function
  name: string
  description: string
  type: string
  app?: string
  inputs: HorizonActionInput[]
  output: HorizonActionOutput
}
