import { ShortcutPriority } from './shortcuts'

export enum ModifierKey {
  Meta = 'Meta',
  Ctrl = 'Control',
  Shift = 'Shift',
  Alt = 'Alt',
  Opt = 'Alt' // Opt is same as Alt on macOS
}

// Common special keys that need specific handling
export enum SpecialKey {
  Escape = 'Escape',
  Enter = 'Enter',
  Tab = 'Tab',
  Space = 'Space',
  Backspace = 'Backspace',
  Delete = 'Delete',
  ArrowUp = 'ArrowUp',
  ArrowDown = 'ArrowDown',
  ArrowLeft = 'ArrowLeft',
  ArrowRight = 'ArrowRight',
  Home = 'Home',
  End = 'End',
  PageUp = 'PageUp',
  PageDown = 'PageDown'
}

// Type for valid key characters (A-Z)
type AlphaKey =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'

// Type for valid number keys (0-9)
type NumberKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

// Type for function keys (F1-F12)
type FunctionKey =
  | 'F1'
  | 'F2'
  | 'F3'
  | 'F4'
  | 'F5'
  | 'F6'
  | 'F7'
  | 'F8'
  | 'F9'
  | 'F10'
  | 'F11'
  | 'F12'

// Punctuation keys
type PunctuationKey = ',' | '.' | '/' | ';' | "'" | '[' | ']' | '\\' | '-' | '=' | '`'

// Valid key type is any of the above
type ValidKey = AlphaKey | NumberKey | FunctionKey | PunctuationKey | keyof typeof SpecialKey

const MODIFIER_MAP: Record<string, keyof typeof ModifierKey> = {
  meta: 'Meta',
  command: 'Meta',
  cmd: 'Meta',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt'
}

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

  private parseKeyCombo(combo: string): { key: string; modifiers: ModifierKey[] } {
    const parts = combo.split('+').map((part) => part.trim())
    const key = parts.pop()!

    // Convert modifiers to standardized format
    const modifiers = parts.map((mod) => {
      const standardMod = MODIFIER_MAP[mod.toLowerCase()]
      if (!standardMod) {
        throw new Error(`Invalid modifier key: ${mod}`)
      }
      return ModifierKey[standardMod]
    })

    // Validate the key
    if (key in SpecialKey) {
      return { key: SpecialKey[key as keyof typeof SpecialKey], modifiers }
    }

    // For regular keys, ensure it's uppercase for consistency
    const uppercaseKey = key.toUpperCase()

    // Validate if it's a valid key
    const punctuation = [',', '.', '/', ';', "'", '[', ']', '\\', '-', '=', '`']

    if (
      !/^[A-Z0-9]$/.test(uppercaseKey) &&
      !Object.keys(SpecialKey).includes(key) &&
      !/^F(?:1[0-2]|[1-9])$/.test(key) &&
      !punctuation.includes(key)
    ) {
      throw new Error(`Invalid key: ${key}`)
    }

    return { key: uppercaseKey, modifiers }
  }

  private matchesCombo(event: KeyboardEvent, combo: string): boolean {
    const { key, modifiers } = this.parseKeyCombo(combo)

    // Normalize the pressed key
    let pressedKey = event.key
    if (pressedKey.length === 1) {
      pressedKey = pressedKey.toUpperCase()
    }

    // Check for special key mappings
    if (pressedKey === 'Esc') pressedKey = 'Escape'
    if (pressedKey === ' ') pressedKey = 'Space'

    // Get active modifiers
    const activeModifiers = new Set<ModifierKey>()
    if (event.metaKey) activeModifiers.add(ModifierKey.Meta)
    if (event.ctrlKey) activeModifiers.add(ModifierKey.Ctrl)
    if (event.shiftKey) activeModifiers.add(ModifierKey.Shift)
    if (event.altKey) activeModifiers.add(ModifierKey.Alt)

    // Check if the key matches
    if (pressedKey !== key) return false

    // Check that all required modifiers are pressed
    for (const mod of modifiers) {
      if (!activeModifiers.has(mod)) return false
    }

    // Check that no extra modifiers are pressed
    return activeModifiers.size === modifiers.length
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

// Helper function to create valid key combinations
export function createKeyCombo(key: ValidKey | SpecialKey, modifiers: ModifierKey[] = []): string {
  return [...modifiers, key].join('+')
}
