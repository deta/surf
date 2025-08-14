import { ShortcutPriority } from './shortcutsManager'

interface KeyboardShortcut {
  id: string
  combo: string
  handler: () => boolean
  priority: ShortcutPriority
}

export class KeyboardManager {
  private shortcuts: KeyboardShortcut[] = []
  private idCounter = 0

  private generateId(): string {
    return `shortcut_${this.idCounter++}`
  }

  private parseKeyCombo(combo: string): { key: string; modifiers: string[] } {
    const parts = combo.split('+')
    const key = parts.pop()!.toLowerCase()
    const modifiers = parts.map((mod) => mod.toLowerCase())
    return { key, modifiers }
  }

  private matchesCombo(event: KeyboardEvent, combo: string): boolean {
    const { key, modifiers } = this.parseKeyCombo(combo)

    console.log('Parsed key:', key, 'modifiers:', modifiers)

    const pressedKey = event.key.toLowerCase()
    const pressedModifiers = {
      meta: event.metaKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey
    }

    console.log('Pressed key:', pressedKey, 'pressed modifiers:', pressedModifiers)

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
        if (navigator.platform.includes('Mac') && mod === 'ctrl' && pressedModifiers.meta) {
          return false
        }
        return pressed
      })
      .map(([mod]) => mod)

    return activeModifiers.length === modifiers.length
  }

  handleKeyDown = (event: KeyboardEvent): void => {
    console.log(
      'KeyboardManager handling key down:',
      event.key,
      event.code,
      event.metaKey,
      event.ctrlKey,
      event.altKey,
      event.shiftKey
    )
    // Sort shortcuts by priority (highest first)
    const sortedShortcuts = [...this.shortcuts].sort((a, b) => b.priority - a.priority)

    for (const shortcut of sortedShortcuts) {
      console.log('Checking shortcut:', shortcut.combo)
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
