export type MessagePortEventPrimary = { portId: string; payload: any }
export type MessagePortCallbackPrimary = (data: MessagePortEventPrimary) => void

export type MessagePortCallbackClient = (payload: any) => void
