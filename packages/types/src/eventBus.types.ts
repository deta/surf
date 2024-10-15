export enum ResourceProcessingStatusType {
  Started = 'Started',
  Failed = 'Failed',
  Finished = 'Finished'
}

export enum EventBusMessageType {
  ResourceProcessingMessage = 'ResourceProcessingMessage'
}

export type ResourceProcessingStatus =
  | { type: ResourceProcessingStatusType.Started }
  | { type: ResourceProcessingStatusType.Failed; message: string }
  | { type: ResourceProcessingStatusType.Finished }

export type EventBusMessage = {
  type: EventBusMessageType.ResourceProcessingMessage
  resource_id: string
  status: ResourceProcessingStatus
}
