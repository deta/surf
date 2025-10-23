import fs from 'fs'
import path from 'path'

interface FileWatcherOptions {
  debounceDelay?: number
  renameTimeout?: number
  useInodeTracking?: boolean // Use inode for rename detection (Unix only)
}

interface CreateEvent {
  filename: string
  path: string
}

interface DeleteEvent {
  filename: string
  path: string
}

interface RenameEvent {
  oldName: string
  newName: string
  oldPath: string
  newPath: string
}

type EventCallback<T> = (data: T) => void

interface PendingEvent {
  type: string
  filename: string
  timestamp: number
}

export class FileWatcher {
  private directory: string
  private debounceDelay: number
  private renameTimeout: number
  private listeners: {
    create: EventCallback<CreateEvent>[]
    delete: EventCallback<DeleteEvent>[]
    rename: EventCallback<RenameEvent>[]
  }

  private files: Map<string, { mtime: number; size: number; ino?: number }>
  private pendingEvents: PendingEvent[]
  private debounceTimer: NodeJS.Timeout | null
  private watcher: fs.FSWatcher | null
  private isProcessing: boolean
  private useInodeTracking: boolean
  private inodeToFilename: Map<number, string>

  constructor(directory: string, options: FileWatcherOptions = {}) {
    this.directory = path.resolve(directory)
    this.debounceDelay = options.debounceDelay || 100
    this.renameTimeout = options.renameTimeout || 50
    this.useInodeTracking = options.useInodeTracking !== false // Default true
    this.listeners = {
      create: [],
      delete: [],
      rename: []
    }

    this.files = new Map()
    this.inodeToFilename = new Map()
    this.pendingEvents = []
    this.debounceTimer = null
    this.watcher = null
    this.isProcessing = false

    this.initialize()
  }

  private initialize(): void {
    // Validate directory exists
    if (!fs.existsSync(this.directory)) {
      throw new Error(`Directory does not exist: ${this.directory}`)
    }

    if (!fs.statSync(this.directory).isDirectory()) {
      throw new Error(`Path is not a directory: ${this.directory}`)
    }

    // Build initial file list with metadata
    this.scanDirectory()

    // Start watching
    try {
      this.watcher = fs.watch(this.directory, (eventType, filename) => {
        if (!filename) return

        this.pendingEvents.push({
          type: eventType,
          filename,
          timestamp: Date.now()
        })

        // Debounce event processing
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer)
        }

        this.debounceTimer = setTimeout(() => {
          this.processEvents()
        }, this.debounceDelay)
      })
    } catch (err) {
      throw new Error(`Failed to watch directory: ${err}`)
    }
  }

  private scanDirectory(): void {
    try {
      const entries = fs.readdirSync(this.directory)

      for (const file of entries) {
        const fullPath = path.join(this.directory, file)
        try {
          const stats = fs.statSync(fullPath)
          if (stats.isFile()) {
            const metadata = {
              mtime: stats.mtimeMs,
              size: stats.size,
              ...(this.useInodeTracking && { ino: stats.ino })
            }
            this.files.set(file, metadata)

            if (this.useInodeTracking && stats.ino !== undefined) {
              this.inodeToFilename.set(stats.ino, file)
            }
          }
        } catch (err) {
          // File might have been deleted during scan, skip it
          continue
        }
      }
    } catch (err) {
      throw new Error(`Error scanning directory: ${err}`)
    }
  }

  private async processEvents(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return
    }

    this.isProcessing = true

    try {
      const events = [...this.pendingEvents]
      this.pendingEvents = []

      // Small delay to catch related events (e.g., rename operations)
      await new Promise((resolve) => setTimeout(resolve, this.renameTimeout))

      // Get current directory state
      const currentFiles = new Map<string, { mtime: number; size: number; ino?: number }>()
      const currentInodeToFilename = new Map<number, string>()

      try {
        const entries = fs.readdirSync(this.directory)

        for (const file of entries) {
          const fullPath = path.join(this.directory, file)
          try {
            const stats = fs.statSync(fullPath)
            if (stats.isFile()) {
              const metadata = {
                mtime: stats.mtimeMs,
                size: stats.size,
                ...(this.useInodeTracking && { ino: stats.ino })
              }
              currentFiles.set(file, metadata)

              if (this.useInodeTracking && stats.ino !== undefined) {
                currentInodeToFilename.set(stats.ino, file)
              }
            }
          } catch (err) {
            // File might have been deleted during scan
            continue
          }
        }
      } catch (err) {
        console.error('Error reading directory:', err)
        this.isProcessing = false
        return
      }

      // Detect changes
      const created: string[] = []
      const deleted: string[] = []
      const renamed: Array<{ oldName: string; newName: string }> = []

      // Use inode tracking for accurate rename detection (Unix systems)
      if (this.useInodeTracking) {
        // Find files that changed names but kept same inode (renames)
        for (const [oldFilename, oldMetadata] of this.files.entries()) {
          if (oldMetadata.ino !== undefined) {
            const newFilename = currentInodeToFilename.get(oldMetadata.ino)

            if (newFilename && newFilename !== oldFilename) {
              // Same inode, different name = rename
              renamed.push({ oldName: oldFilename, newName: newFilename })
            } else if (!newFilename) {
              // Inode disappeared = delete
              deleted.push(oldFilename)
            }
            // else: same filename, same inode = no change (not a create/delete)
          } else if (!currentFiles.has(oldFilename)) {
            // No inode info but file gone = delete
            deleted.push(oldFilename)
          }
        }

        // Find truly new files (new inodes)
        for (const [newFilename, newMetadata] of currentFiles.entries()) {
          if (newMetadata.ino !== undefined) {
            const wasRenamed = renamed.some((r) => r.newName === newFilename)
            if (!this.inodeToFilename.has(newMetadata.ino) && !wasRenamed) {
              // New inode = new file
              created.push(newFilename)
            }
          } else if (!this.files.has(newFilename)) {
            // No inode info but new name = create
            created.push(newFilename)
          }
        }
      } else {
        // Fallback: name-based detection with size heuristic
        // Find created files
        for (const [filename, metadata] of currentFiles.entries()) {
          if (!this.files.has(filename)) {
            created.push(filename)
          }
        }

        // Find deleted files
        for (const filename of this.files.keys()) {
          if (!currentFiles.has(filename)) {
            deleted.push(filename)
          }
        }

        // Try to match renames by size (less reliable)
        if (created.length > 0 && deleted.length > 0) {
          const pairs = this.matchRenames(deleted, created, currentFiles)
          renamed.push(...pairs)

          // Remove matched pairs from created/deleted lists
          const renamedOld = new Set(pairs.map((p) => p.oldName))
          const renamedNew = new Set(pairs.map((p) => p.newName))

          created.splice(0, created.length, ...created.filter((f) => !renamedNew.has(f)))
          deleted.splice(0, deleted.length, ...deleted.filter((f) => !renamedOld.has(f)))
        }
      }

      // Emit events
      for (const { oldName, newName } of renamed) {
        this.emit('rename', {
          oldName,
          newName,
          oldPath: path.join(this.directory, oldName),
          newPath: path.join(this.directory, newName)
        })
      }

      for (const filename of created) {
        this.emitCreate(filename, currentFiles.get(filename)!)
      }

      for (const filename of deleted) {
        this.emitDelete(filename)
      }

      // Update tracked files and inodes
      this.files = currentFiles
      this.inodeToFilename = currentInodeToFilename
    } finally {
      this.isProcessing = false
    }
  }

  private matchRenames(
    deleted: string[],
    created: string[],
    currentFiles: Map<string, { mtime: number; size: number; ino?: number }>
  ): Array<{ oldName: string; newName: string }> {
    const pairs: Array<{ oldName: string; newName: string }> = []
    const usedDeleted = new Set<string>()
    const usedCreated = new Set<string>()

    // Try to match by size (fallback when inode tracking unavailable)
    // Note: This is unreliable and can produce false positives
    for (const oldName of deleted) {
      const oldMetadata = this.files.get(oldName)
      if (!oldMetadata) continue

      for (const newName of created) {
        if (usedCreated.has(newName)) continue

        const newMetadata = currentFiles.get(newName)
        if (!newMetadata) continue

        // Match by size (weak indicator for renames)
        // This can fail when:
        // 1. Different files have same size
        // 2. File is renamed AND content changes
        if (oldMetadata.size === newMetadata.size) {
          pairs.push({ oldName, newName })
          usedDeleted.add(oldName)
          usedCreated.add(newName)
          break
        }
      }
    }

    return pairs
  }

  private emitCreate(filename: string, metadata: { mtime: number; size: number }): void {
    this.emit('create', {
      filename,
      path: path.join(this.directory, filename)
    })
  }

  private emitDelete(filename: string): void {
    this.emit('delete', {
      filename,
      path: path.join(this.directory, filename)
    })
  }

  public on(event: 'create', callback: EventCallback<CreateEvent>): this
  public on(event: 'delete', callback: EventCallback<DeleteEvent>): this
  public on(event: 'rename', callback: EventCallback<RenameEvent>): this
  public on(event: string, callback: EventCallback<any>): this {
    if (this.listeners[event as keyof typeof this.listeners]) {
      this.listeners[event as keyof typeof this.listeners].push(callback)
    }
    return this
  }

  private emit<T>(event: keyof typeof this.listeners, data: T): void {
    const callbacks = this.listeners[event]
    for (const callback of callbacks) {
      try {
        callback(data as any)
      } catch (err) {
        console.error(`Error in ${event} listener:`, err)
      }
    }
  }

  public close(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    this.listeners.create = []
    this.listeners.delete = []
    this.listeners.rename = []
  }
}
