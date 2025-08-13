import { KeyboardManager } from './keyboardManager'

export enum ShortcutPriority {
  Low = 0,
  Normal = 1,
  High = 2,
  Critical = 3
}

export interface ShortcutDefinition<T extends string> {
  action: T
  defaultCombo: string
  description: string
  priority: ShortcutPriority
}

export class ShortcutManager<T extends string> {
  private customShortcuts = new Map<T, string>()
  private handlers = new Map<T, () => boolean>()
  private unregisterCallbacks = new Map<T, () => void>()
  private keyboardManager: KeyboardManager
  private defaultShortcuts: Record<T, ShortcutDefinition<T>>

  constructor(
    keyboardManager: KeyboardManager,
    defaultShortcuts: Record<T, ShortcutDefinition<T>>
  ) {
    this.keyboardManager = keyboardManager
    this.defaultShortcuts = defaultShortcuts
  }

  // Get the current combo for a shortcut (custom or default)
  getShortcutCombo(action: T): string {
    return this.customShortcuts.get(action) ?? this.defaultShortcuts[action].defaultCombo
  }

  // Get the full shortcut definition including current combo
  getShortcutDefinition(action: T): ShortcutDefinition<T> & { currentCombo: string } {
    return {
      ...this.defaultShortcuts[action],
      currentCombo: this.getShortcutCombo(action)
    }
  }

  // Get all shortcuts and their current state
  getAllShortcuts(): Array<ShortcutDefinition<T> & { currentCombo: string }> {
    return Object.keys(this.defaultShortcuts).map((action) =>
      this.getShortcutDefinition(action as T)
    )
  }

  // Customize a shortcut
  setCustomShortcut(action: T, combo: string): void {
    this.customShortcuts.set(action, combo)
    this.updateShortcutRegistration(action)
  }

  // Reset a shortcut to its default
  resetShortcut(action: T): void {
    this.customShortcuts.delete(action)
    this.updateShortcutRegistration(action)
  }

  // Reset all shortcuts to defaults
  resetAllShortcuts(): void {
    this.customShortcuts.clear()
    Object.keys(this.defaultShortcuts).forEach((action) => {
      this.updateShortcutRegistration(action as T)
    })
  }

  // Register a handler for a shortcut action
  registerHandler(action: T, handler: () => boolean): () => void {
    this.handlers.set(action, handler)
    this.updateShortcutRegistration(action)

    // Return unregister function
    return () => {
      this.handlers.delete(action)
      this.unregisterFromKeyboardManager(action)
    }
  }

  private updateShortcutRegistration(action: T): void {
    // First, unregister existing shortcut if any
    this.unregisterFromKeyboardManager(action)

    const handler = this.handlers.get(action)
    if (!handler) return // No handler registered for this action

    const combo = this.getShortcutCombo(action)
    const { priority } = this.defaultShortcuts[action]

    // Register the new shortcut
    const unregister = this.keyboardManager.register(combo, handler, priority)
    this.unregisterCallbacks.set(action, unregister)
  }

  private unregisterFromKeyboardManager(action: T): void {
    const unregister = this.unregisterCallbacks.get(action)
    if (unregister) {
      unregister()
      this.unregisterCallbacks.delete(action)
    }
  }
}

// Singleton instance
let instance: ShortcutManager<string> | null = null

export function createShortcutManager<T extends string>(
  keyboardManager: KeyboardManager,
  defaultShortcuts: Record<T, ShortcutDefinition<T>>
): ShortcutManager<T> {
  if (!instance) {
    instance = new ShortcutManager(keyboardManager, defaultShortcuts)
  }

  return instance as ShortcutManager<T>
}

export function useShortcutsManager<T extends string>(): ShortcutManager<T> {
  if (!instance) {
    throw new Error('ShortcutManager not initialized. Please call createShortcutManager first.')
  }
  return instance as ShortcutManager<T>
}
