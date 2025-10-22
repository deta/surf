import { isMac } from '@deta/utils'
import { ShortcutPriority } from './shortcutsManager'

interface KeyboardShortcut {
  id: string
  combo: string
  handler: () => boolean
  priority: ShortcutPriority
}

function splitKeyCombo(combo: string): string[] {
  const parts = combo.split('+')
  const modifiers: string[] = []
  let key = ''

  // Handle the case where the actual key is '+' (e.g., "Cmd++")
  // This results in an empty string at the end of the split array
  if (parts[parts.length - 1] === '' && parts.length > 1) {
    // The key is '+', so remove the last empty string
    parts.pop()
    key = '+'

    // All remaining non-empty parts are modifiers
    modifiers.push(...parts.filter((p) => p !== ''))
  } else {
    // Normal case: last part is the key, rest are modifiers
    key = parts[parts.length - 1]
    modifiers.push(...parts.slice(0, -1).filter((p) => p !== ''))
  }

  return [...modifiers, key]
}

export class KeyboardManager {
  private shortcuts: KeyboardShortcut[] = []
  private idCounter = 0

  private generateId(): string {
    return `shortcut_${this.idCounter++}`
  }

  private parseKeyCombo(combo: string): { key: string; modifiers: string[] } {
    const parts = splitKeyCombo(combo)
    const key = parts.pop()!.toLowerCase()
    const modifiers = parts
      .map((mod) => mod.toLowerCase())
      .map((mod) => {
        if (mod !== 'cmdorctrl') return mod
        if (isMac()) return 'meta'
        else return 'ctrl'
      })
    return { key, modifiers }
  }

  private matchesCombo(event: KeyboardEvent, combo: string): boolean {
    const { key, modifiers } = this.parseKeyCombo(combo)

    const pressedKey = event.key.toLowerCase()
    const pressedModifiers = {
      meta: event.metaKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey
    }

    // Disable double meta ctrl key
    if (!isMac() && pressedModifiers.meta && pressedModifiers.ctrl) pressedModifiers.meta = false

    // Check if the main key matches
    if (pressedKey !== key) return false

    // Check that all required modifiers are pressed
    for (const mod of modifiers) {
      if (!pressedModifiers[mod as keyof typeof pressedModifiers]) return false
    }

    // Check that no extra modifiers are pressed
    const activeModifiers = Object.entries(pressedModifiers)
      .filter(([mod, pressed]) => {
        // On macOS, ignore ctrl when meta (cmd) is pressed
        if (isMac() && mod === 'ctrl' && pressedModifiers.meta) {
          return false
        }
        return pressed
      })
      .map(([mod]) => mod)

    return activeModifiers.length === modifiers.length
  }

  handleKeyDown = (event: KeyboardEvent): void => {
    // Sort shortcuts by priority (highest first)
    const sortedShortcuts = [...this.shortcuts].sort((a, b) => b.priority - a.priority)

    for (const shortcut of sortedShortcuts) {
      if (this.matchesCombo(event, shortcut.combo)) {
        const wasHandled = shortcut.handler()
        if (wasHandled) {
          event.preventDefault()
          event.stopPropagation()
          break
        }
      }
    }
  }

  register(
    combo: string,
    handler: () => boolean,
    priority: ShortcutPriority = ShortcutPriority.Normal
  ): () => void {
    const id = this.generateId()
    const shortcut: KeyboardShortcut = {
      id,
      combo,
      handler,
      priority
    }

    this.shortcuts.push(shortcut)

    // Return unregister function
    return () => {
      this.shortcuts = this.shortcuts.filter((s) => s.id !== id)
    }
  }
}

// Singleton instance
let instance: KeyboardManager | null = null

export function createKeyboardManager(): KeyboardManager {
  if (!instance) {
    instance = new KeyboardManager()
  }
  return instance
}

// Hook for use in Svelte components
export function useKeyboardManager(): KeyboardManager {
  if (!instance) {
    throw new Error('KeyboardManager has not been initialized. Call createKeyboardManager first.')
  }
  return instance
}
