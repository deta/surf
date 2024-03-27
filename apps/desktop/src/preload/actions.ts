import type { HorizonAction, HorizonActionInput } from '@horizon/types'

const actionInputsToParameters: (inputs: HorizonActionInput[]) => {} = (inputs) => {
  let properties: { [key: string]: any } = {}
  for (const input of inputs) {
    properties[input.name] = {
      type: input.type,
      description: input.description
    }
  }
  return {
    type: 'object',
    properties
  }
}

export const actionsToRunnableTools: (actions: HorizonAction[]) => any[] = (actions) => {
  let runnableTools: any[] = []

  for (const action of actions) {
    runnableTools.push({
      type: 'function',
      function: {
        name: action.name,
        function: action.function,
        parameters: actionInputsToParameters(action.inputs)
      }
    })
  }
  return runnableTools
}
