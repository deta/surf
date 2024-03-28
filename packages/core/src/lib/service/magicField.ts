import { get, writable, type Readable, type Writable, derived } from 'svelte/store'
import EventEmitter from 'events'
import type TypedEmitter from 'typed-emitter'

import type { CardPosition } from '../types'
import { useLogScope, type ScopedLogger } from '../utils/log'
import { rectsIntersect } from '@horizon/tela'
import { shortestDistanceBetweenRects } from '../../../../tela/dist/utils'
import type { DetectedWebApp } from '@horizon/web-parser'

export type ParticipantData = {
  type: string
  data: any
}

export type ParticipantEvents = {
  created: (participant: MagicFieldParticipant) => void
  enterField: (field: MagicField) => void
  connectField: (field: MagicField) => void
  requestData: (types: string[], callback: (data: ParticipantData) => void) => void
  leaveField: (field: MagicField) => void
  destroyed: () => void
}

export type FieldEvents = {
  created: (field: MagicField) => void
  participantEnter: (participant: MagicFieldParticipant) => void
  participantConnect: (participant: MagicFieldParticipant) => void
  receiveData: (type: string, data: any) => void
  participantLeave: (participant: MagicFieldParticipant) => void
  destroyed: () => void
}

export type RelativePositioning = 'left' | 'right' | 'top' | 'bottom' | 'center'

const EVENT_RESPONSE_TIMEOUT = 15000

export type MagicFieldParticipation = {
  fieldId: string
  // relativePosition: RelativePositioning
  distance: number
  supported: boolean | null
}

export class MagicFieldParticipant {
  id: string
  position: Writable<CardPosition>
  inField: Writable<MagicField | null>
  connectedField: Writable<MagicField | null>
  isInField: Readable<boolean>
  isConnectedToField: Readable<boolean>
  allowConnect: Writable<boolean>
  app: Writable<DetectedWebApp | null>

  fieldParticipation: Writable<MagicFieldParticipation | null>

  events: TypedEmitter<ParticipantEvents>
  log: ScopedLogger

  constructor(id: string, position: CardPosition) {
    this.id = id
    this.position = writable(position)

    this.fieldParticipation = writable(null)

    this.inField = writable(null)
    this.connectedField = writable(null)
    this.allowConnect = writable(true)
    this.app = writable(null)

    this.isInField = derived(this.inField, (inField) => !!inField)
    this.isConnectedToField = derived(this.connectedField, (connectedField) => !!connectedField)

    this.events = new EventEmitter() as TypedEmitter<ParticipantEvents>
    this.log = useLogScope(`MagicFieldParticipant ${id}`)

    this.events.on('enterField', (f) => {
      this.log.debug(`field entered: ${f.id}`)
      this.inField.set(f)
    })

    this.events.on('connectField', (f) => {
      this.log.debug(`field connected: ${f.id}`)
      this.connectedField.set(f)
    })

    this.events.on('leaveField', (f) => {
      this.log.debug(`field left: ${f.id}`)
      this.inField.set(null)
      this.connectedField.set(null)
      this.allowConnect.set(true)
    })
  }

  updatePosition(pos: CardPosition) {
    this.position.set(pos)
  }

  updateApp(app: DetectedWebApp) {
    this.app.set(app)
  }

  emit(
    event: keyof ParticipantEvents,
    ...args: Parameters<ParticipantEvents[keyof ParticipantEvents]>
  ) {
    this.events.emit(event, ...args)
  }

  onRequestData(handler: (types: string[], callback: (data: any) => void) => void) {
    this.events.on('requestData', handler)
  }

  onFieldEnter(handler: (field: MagicField) => void) {
    this.events.on('enterField', handler)
  }

  onFieldConnect(handler: (field: MagicField) => void) {
    this.events.on('connectField', handler)
  }

  onFieldLeave(handler: (field: MagicField) => void) {
    this.events.on('leaveField', handler)
  }

  //   requestData(type: string) {
  //     return new Promise((resolve) => {
  //       this.log.debug(`Requesting data of type ${type}`)

  //       const timeout = setTimeout(() => {
  //         this.log.warn(`Request for data of type ${type} timed out`)
  //         resolve(null)
  //       }, EVENT_RESPONSE_TIMEOUT)

  //       this.events.emit('requestData', type, (data) => {
  //         this.log.debug(`Received data of type ${type}`, data)
  //         clearTimeout(timeout)
  //         resolve(data)
  //       })
  //     })
  //   }

  allowConnectionToField(fieldId: string) {
    this.allowConnect.set(true)
  }

  updateFieldSupported(fieldId: string, value: boolean) {
    this?.fieldParticipation.update((p) => ({
      ...p!,
      supported: value
    }))
  }
}

const DEFAULT_FIELD_STRENGTH = 250

export class MagicField {
  id: string
  strength: number
  supportedResources: string[]
  position: Writable<CardPosition | null>

  fieldParticipation: Writable<MagicFieldParticipation | null>

  participants: Writable<MagicFieldParticipant[]>
  connected: Writable<MagicFieldParticipant[]>
  events: TypedEmitter<FieldEvents>
  log: ScopedLogger

  constructor(
    id: string,
    supportedResources: string[],
    position?: Writable<CardPosition | null>,
    strength: number = DEFAULT_FIELD_STRENGTH
  ) {
    this.id = id
    this.position = position ?? writable(null)
    this.strength = strength
    this.supportedResources = supportedResources

    this.fieldParticipation = writable(null)

    this.participants = writable([])
    this.connected = writable([])

    this.events = new EventEmitter() as TypedEmitter<FieldEvents>
    this.log = useLogScope(`MagicField:${id}`)

    this.events.on('participantEnter', (p) => {
      this.log.debug(`participant entered: ${p.id}`)
    })

    this.events.on('participantLeave', (p) => {
      this.log.debug(`participant left: ${p.id}`)
    })
  }

  updatePosition(pos: CardPosition) {
    this.position.set(pos)
  }

  getParticipants() {
    return get(this.participants)
  }

  getParticipant(id: string) {
    return this.getParticipants().find((p) => p.id === id)
  }

  emit(event: keyof FieldEvents, ...args: Parameters<FieldEvents[keyof FieldEvents]>) {
    this.events.emit(event, ...args)
  }

  requestDataFromParticipant(
    participantId: string,
    types: string[]
  ): Promise<ParticipantData | null> {
    return new Promise((resolve) => {
      this.log.debug(`Requesting data of type ${types} from participant ${participantId}`)

      const participant = this.getParticipant(participantId)
      if (!participant) {
        throw new Error(`Participant with id ${participantId} does not exist`)
      }

      const timeout = setTimeout(() => {
        this.log.warn(`Request for data of type ${types} timed out`)
        resolve(null)
      }, EVENT_RESPONSE_TIMEOUT)

      participant.events.emit('requestData', types, (data) => {
        this.log.debug(`Received data of type ${data.type}`, data.data)
        clearTimeout(timeout)
        resolve(data)
      })
    })
  }

  relativePositionToParticipant(id: string): RelativePositioning {
    const participant = this.getParticipant(id)
    if (!participant) {
      throw new Error(`Participant with id ${id} is not in the field`)
    }

    const fieldPos = get(this.position)
    if (!fieldPos) {
      throw new Error(`Field ${this.id} has no position`)
    }

    const participantPos = get(participant.position)
    if (!participantPos) {
      throw new Error(`Participant ${participant.id} has no position`)
    }

    const fieldEdges = getBoxEdges(fieldPos)
    const participantEdges = getBoxEdges(participantPos)

    // find which side of the field the participant is closest to and return that side
    const topDistance = Math.abs(fieldEdges.top - participantEdges.bottom)
    const rightDistance = Math.abs(fieldEdges.right - participantEdges.left)
    const bottomDistance = Math.abs(fieldEdges.bottom - participantEdges.top)
    const leftDistance = Math.abs(fieldEdges.left - participantEdges.right)

    const distances = {
      top: bottomDistance,
      right: leftDistance,
      bottom: topDistance,
      left: rightDistance
    } as Record<RelativePositioning, number>

    const closestSide = (Object.keys(distances) as RelativePositioning[]).reduce((a, b) =>
      distances[a] < distances[b] ? a : b
    ) as RelativePositioning

    return closestSide
  }

  receiveData(type: string, data: any) {
    this.log.debug(`Received data of type ${type}`)
    this.events.emit('receiveData', type, data)
  }

  onParticipantEnter(handler: (participant: MagicFieldParticipant) => void) {
    this.events.on('participantEnter', handler)
  }

  onParticipantConnect(handler: (participant: MagicFieldParticipant) => void) {
    this.events.on('participantConnect', handler)
  }

  onParticipantLeave(handler: (participant: MagicFieldParticipant) => void) {
    this.events.on('participantLeave', handler)
  }

  onReceiveData(handler: (type: string, data: any) => void) {
    this.events.on('receiveData', handler)
  }

  connect(id: string) {
    const participant = this.getParticipant(id)
    if (!participant) {
      throw new Error(`Participant with id ${id} is not in the field`)
    }

    this.connected.update((connected) => [...connected, participant])

    this.emit('participantConnect', participant)
    participant.emit('connectField', this)
  }
}

export const getBoxEdges = (position: CardPosition) => {
  return {
    top: position.y,
    right: position.x + position.width,
    bottom: position.y + position.height,
    left: position.x
  }
}

export class MagicFieldService {
  participants: Writable<MagicFieldParticipant[]>
  fields: Writable<MagicField[]>

  participantSubscribers: Map<string, () => void>
  fieldSubscribers: Map<string, () => void>

  log: ScopedLogger

  defaultFieldStrength = DEFAULT_FIELD_STRENGTH

  constructor() {
    this.participants = writable([])
    this.fields = writable([])
    this.participantSubscribers = new Map()
    this.fieldSubscribers = new Map()

    this.log = useLogScope('MagicFieldService')
  }

  private findParticipantsInField(field: MagicField, participants: MagicFieldParticipant[]) {
    const distanceThreshold = field.strength
    const fieldPos = get(field.position)
    if (fieldPos === null) {
      this.log.warn(`Field ${field.id} has no position`, fieldPos)
      return []
    }

    const fieldEdges = getBoxEdges(fieldPos)

    // this.log.debug(`Finding participants in field ${field.id} with edges`, fieldEdges)

    // Find all participants within distance (distanceThreshold) of the field. Use participant edges to determine if they are within the field.
    return participants.filter((p) => {
      if (p.id === field.id) return false

      const participantPos = get(p.position)
      if (!participantPos) return false

      const isWithin = rectsIntersect(
        {
          x: participantPos.x,
          y: participantPos.y,
          w: participantPos.width,
          h: participantPos.height
        },
        {
          x: fieldPos.x,
          y: fieldPos.y,
          w: fieldPos.width,
          h: fieldPos.height
        }
      )

      if (isWithin) {
        this.log.debug(`Participant ${p.id} is within field ${field.id}`)
        p.fieldParticipation.update((fp) => ({
          fieldId: field.id,
          // relativePosition: 'center',
          distance: 0,
          supported: fp?.supported ?? null
        }))
        field.fieldParticipation.set({
          fieldId: field.id,
          // relativePosition: 'center',
          distance: 0,
          supported: null
        })

        return true
      }

      // const participantEdges = getBoxEdges(participantPos)
      // this.log.debug(`Checking participant ${p.id} with edges`, participantEdges)

      // find which side of the field the participant is closest to and return that side
      // const topDistance = Math.abs(fieldEdges.top - participantEdges.bottom)
      // const rightDistance = Math.abs(fieldEdges.right - participantEdges.left)
      // const bottomDistance = Math.abs(fieldEdges.bottom - participantEdges.top)
      // const leftDistance = Math.abs(fieldEdges.left - participantEdges.right)

      // const distances = {
      //   top: bottomDistance,
      //   right: leftDistance,
      //   bottom: topDistance,
      //   left: rightDistance
      // } as Record<RelativePositioning, number>

      // const closestSide = (Object.keys(distances) as RelativePositioning[]).reduce((a, b) =>
      //   distances[a] < distances[b] ? a : b
      // ) as RelativePositioning

      const distance = shortestDistanceBetweenRects(participantPos, fieldPos)
      const closeEnough = distance <= distanceThreshold

      const fieldParticipant = get(p.fieldParticipation)
      const isSameField = fieldParticipant?.fieldId === field.id

      // check if this field is closer than the one the participant is currently in (if any)
      const isClosestField =
        !fieldParticipant || isSameField || distance < fieldParticipant.distance

      if (closeEnough) {
        // if we are not the closest field we do nothing
        if (!isClosestField) {
          return false
        }

        p.fieldParticipation.update((fp) => ({
          fieldId: field.id,
          // relativePosition: closestSide,
          distance: distance,
          supported: fp?.supported ?? null
        }))
        field.fieldParticipation.set({
          fieldId: field.id,
          // relativePosition: closestSide,
          distance: distance,
          supported: null
        })

        return true
      }

      p.fieldParticipation.update((fp) => {
        if (fp?.fieldId === field.id) {
          return null
        }

        return fp
      })

      //p.fieldParticipation.set(null)
      field.fieldParticipation.set(null)

      return false
    })
  }

  private updateFieldParticipants(field: MagicField, participants: MagicFieldParticipant[]) {
    const existingParticipants = field.getParticipants()

    // Update the field's participants list
    field.participants.set(participants)

    // Remove participants that are no longer in the field
    const removedParticipants = existingParticipants.filter((p) => !participants.includes(p))
    removedParticipants.forEach((p) => {
      // this.log.debug(`Participant ${p.id} has left field ${field.id}`)
      // notify participant that they have left the field
      p.emit('leaveField', field)

      // notify field that participant has left
      field.emit('participantLeave', p)
    })

    // Add participants that are new to the field

    const newParticipants = participants.filter((p) => !existingParticipants.includes(p))
    newParticipants.forEach((p) => {
      // this.log.debug(`Participant ${p.id} has entered field ${field.id}, sending events`)
      // notify participant that they have entered the field
      p.emit('enterField', field)

      // notify field that participant has entered
      field.emit('participantEnter', p)
    })

    field.connected.update((connected) => {
      return connected.filter((c) => participants.includes(c))
    })

    // TODO: improve this
    const fieldParticipant = this.getParticipant(field.id)
    if (!fieldParticipant) return

    if (participants.length > 0) {
      fieldParticipant?.inField.set(field)
    } else {
      fieldParticipant?.inField.set(null)
    }
  }

  private recalculateFieldParticipants() {
    // this.log.debug('Recalculating field participants')
    const fields = get(this.fields)

    if (fields.length === 0) {
      this.log.debug('No fields to recalculate')
      return
    }

    const participants = get(this.participants)

    fields.forEach((field) => {
      // this.log.debug(`Recalculating participants for field`, field)
      const fieldParticipants = this.findParticipantsInField(field, participants)
      // this.log.debug(`Found participants in field`, fieldParticipants)
      this.updateFieldParticipants(field, fieldParticipants)
    })
  }

  createParticipant(id: string, position: CardPosition) {
    const existingParticipant = this.getParticipant(id)
    if (existingParticipant) {
      throw new Error(`Participant with id ${id} already exists`)
    }

    this.log.debug(`Creating participant with id ${id}`)
    const participant = new MagicFieldParticipant(id, position)

    if (this.getFields().length > 0) {
      const unsubscribe = participant.position.subscribe((pos) => {
        this.recalculateFieldParticipants()
      })
      this.participantSubscribers.set(id, unsubscribe)
    }

    this.participants.update((participants) => [...participants, participant])

    participant.emit('created', participant)
    this.recalculateFieldParticipants()

    return participant
  }

  getParticipant(id: string) {
    return get(this.participants).find((p) => p.id === id)
  }

  getParticipants() {
    return get(this.participants)
  }

  removeParticipant(id: string) {
    const participant = this.getParticipant(id)
    if (!participant) {
      throw new Error(`Participant with id ${id} does not exist`)
    }

    this.log.debug(`Removing participant with id ${id}`)
    const unsubscribe = this.participantSubscribers.get(id)
    if (unsubscribe) {
      unsubscribe()
    }

    const field = get(participant.inField)
    if (field) {
      participant.emit('leaveField', field)
      field.emit('participantLeave', participant)
    }

    participant.emit('destroyed')
    this.participants.update((participants) => participants.filter((p) => p.id !== id))
  }

  createField(id: string, supportedResources: string[], position?: Writable<CardPosition | null>) {
    const existingField = this.getField(id)
    if (existingField) {
      throw new Error(`Field with id ${id} already exists`)
    }

    this.log.debug(`Creating field with id ${id} and position`, position ? get(position) : null)
    const field = new MagicField(id, supportedResources, position)

    // const unsubscribe = field.position.subscribe(() => {
    //     this.recalculateFieldParticipants()
    // })

    // this.fieldSubscribers.set(id, unsubscribe)

    // this.recalculateFieldParticipants()

    field.emit('created', field)
    return field
  }

  activateField(field: MagicField) {
    this.log.debug(`Activating field with id ${field.id}`)

    this.fields.update((fields) => [...fields, field])

    const participants = this.getParticipants()
    if (participants.length > 0) {
      participants.forEach((p) => {
        const unsubscribe = p.position.subscribe(() => {
          this.recalculateFieldParticipants()
        })
        this.participantSubscribers.set(field.id, unsubscribe)
      })
    }

    this.recalculateFieldParticipants()
  }

  getField(id: string) {
    return get(this.fields).find((f) => f.id === id)
  }

  getFields() {
    return get(this.fields)
  }

  removeField(id: string) {
    const field = this.getField(id)
    if (!field) {
      throw new Error(`Field with id ${id} does not exist`)
    }

    this.log.debug(`Removing field with id ${id}`)
    const unsubscribe = this.fieldSubscribers.get(id)
    if (unsubscribe) {
      unsubscribe()
    }

    const participants = field.getParticipants()
    participants.forEach((p) => {
      p.emit('leaveField', field)
      p.fieldParticipation.set(null)
    })

    field.emit('destroyed')
    this.fields.update((fields) => fields.filter((f) => f.id !== id))

    if (this.getFields().length === 0) {
      this.participantSubscribers.forEach((unsubscribe) => {
        unsubscribe()
      })
    }
  }
}
