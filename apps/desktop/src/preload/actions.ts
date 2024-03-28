import type { HorizonAction } from '@horizon/types'

const actionInputsToParameters: (inputs: HorizonAction['inputs']) => {} = (inputs) => {
  return {
    type: 'object',
    properties: inputs
  }
}

export const actionsToRunnableTools: (actions: HorizonAction[]) => any[] = (actions) => {
  let runnableTools: any[] = []

  for (const action of actions) {
    runnableTools.push({
      type: 'function',
      function: {
        name: action.id,
        function: action.handle,
        parameters: actionInputsToParameters(action.inputs)
      }
    })
  }
  return runnableTools
}
