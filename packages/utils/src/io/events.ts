import EventEmitter from 'events'
import type { default as TypedEmitter, EventMap } from 'typed-emitter'

export abstract class EventEmitterBase<T extends EventMap> {
  private eventEmitter: TypedEmitter<T> = new EventEmitter() as TypedEmitter<T>

  on<E extends keyof T>(event: E, listener: T[E]): () => void {
    this.eventEmitter.on(event, listener)

    return () => {
      this.eventEmitter.off(event, listener)
    }
  }

  emit<E extends keyof T>(event: E, ...args: Parameters<T[E]>) {
    this.eventEmitter.emit(event, ...args)
  }

  listeners<E extends keyof T>(event: E) {
    return this.eventEmitter.listeners(event)
  }

  eventNames() {
    return this.eventEmitter.eventNames()
  }
}
