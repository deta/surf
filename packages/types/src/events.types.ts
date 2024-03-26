export enum TelemetryEventTypes {
  CreateHorizon = 'Create Horizon',
  DeleteHorizon = 'Delete Horizon',
  ActivateHorizon = 'Activate Horizon',
  AddCard = 'Add Card',
  DeleteCard = 'Delete Card',
  DuplicateCard = 'Duplicate Card',
  UpdateCard = 'Update Card',
  SetDefaultBrowser = 'Set Default Browser',
  VisorSearch = 'Visor Search',
  OasisOpen = 'Open Oasis',
  OasisSearch = 'Search Oasis',
  OasisDrag = 'Drag from Oasis',
  OasisOpenResourceDetails = 'Open Oasis Resource Details',
  CreateResource = 'Create Resource',
  DeleteResource = 'Delete Resource'
}

export interface ElectronAppInfo {
  version: string
  platform: string
}
