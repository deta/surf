import { isWindows } from '@deta/utils'
import { spawn, type ChildProcess, execSync } from 'child_process'

import EventEmitter from 'events'
import { basename } from 'path'

export class SurfBackendServerManager extends EventEmitter {
  private process: ChildProcess | null = null
  private isShuttingDown = false
  private lastKnownHealth = false
  private restartAttempts = 0
  private readonly maxRestartAttempts = 5
  private readonly restartDelay = 1000

  private readonly startTimeout = 5000
  private startPromise: Promise<void> | null = null
  private startResolve: (() => void) | null = null
  private startReject: ((reason: Error) => void) | null = null

  constructor(
    private readonly serverPath: string,
    private readonly args: string[],
    private readonly options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
  ) {
    super()
  }

  public get isHealthy(): boolean {
    return this.lastKnownHealth
  }

  start(): void {
    if (this.process) {
      this.emit('warn', 'surf backend server is already running')
      return
    }

    this.killExistingProcess()
    this.initializeStartPromise()
    this.spawnProcess()
    this.isShuttingDown = false
  }

  waitForStart(): Promise<void> {
    if (!this.startPromise) throw new Error('server has not been started')
    return this.startPromise
  }

  private initializeStartPromise(): void {
    this.startPromise = new Promise((resolve, reject) => {
      this.startResolve = resolve
      this.startReject = reject

      setTimeout(() => {
        if (this.startReject) {
          this.startReject(new Error('server startup timed out'))
          this.startResolve = null
          this.startReject = null
        }
      }, this.startTimeout)
    })
  }

  stop(): void {
    if (!this.process) {
      this.emit('warn', 'surf backend server is not running')
      return
    }

    this.isShuttingDown = true
    this.process.kill()
    this.process = null
    this.startPromise = null
    this.startResolve = null
    this.startReject = null
  }

  restart(): void {
    this.stop()
    this.start()
  }

  private spawnProcess(): void {
    this.process = spawn(this.serverPath, this.args, {
      ...this.options
    })

    this.process.stdout?.on('data', (data: string) => {
      const lines = data.toString().trimEnd().split('\n')

      lines.forEach((line) => {
        if (line.includes('healthy')) {
          this.restartAttempts = 0
          this.lastKnownHealth = true
          this.emit('ready')
          if (this.startResolve) {
            this.startResolve()
            this.startResolve = null
            this.startReject = null
          }
        }
        this.emit('stdout', line)
      })
    })

    this.process.stderr?.on('data', (data: string) => {
      data
        .toString()
        .trimEnd()
        .split('\n')
        .forEach((line) => this.emit('stderr', line))
    })

    this.process.on('exit', (exit, signal) => {
      this.process = null
      this.lastKnownHealth = false

      this.emit('close', exit)
      if (exit) this.emit('exit', exit)
      if (signal) this.emit('signal', signal)

      if (!this.isShuttingDown) {
        if (this.startReject) {
          this.startReject(new Error('server process exited before becoming ready'))
          this.startResolve = null
          this.startReject = null
        }
        this.handleUnexpectedExit()
      }
    })

    this.process.on('error', (error) => {
      if (this.startReject) {
        this.startReject(error)
        this.startResolve = null
        this.startReject = null
      }
      this.emit('error', error)
    })

    this.emit('start')
  }

  private handleUnexpectedExit(): void {
    if (this.restartAttempts < this.maxRestartAttempts) {
      this.restartAttempts++
      this.emit(
        'warn',
        `surf backend server exited. restarting in ${this.restartDelay / 1000} seconds`
      )
      setTimeout(() => this.start(), this.restartDelay)
    } else {
      this.emit(
        'error',
        'max restart attempts reached. surf backend server will not restart automatically'
      )
    }
  }

  private killExistingProcess(): void {
    try {
      const processName = basename(this.serverPath)
      if (isWindows()) {
        execSync(`taskkill /F /IM ${processName} /T`)
      } else {
        execSync(`pkill -x ${processName}`)
      }
      this.emit('info', 'killed existing surf backend server process')
    } catch (error) {
      this.emit('info', 'no existing surf backend server process found')
    }
  }
}
