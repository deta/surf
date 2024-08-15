import { spawn, type ChildProcess, execSync } from 'child_process'
import EventEmitter from 'events'
import { basename } from 'path'

export class SurfBackendServerManager extends EventEmitter {
  private process: ChildProcess | null = null
  private isShuttingDown = false
  private restartAttempts = 0
  private readonly maxRestartAttempts = 5
  private readonly restartDelay = 1000

  constructor(
    private readonly serverPath: string,
    private readonly args: string[],
    private readonly options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
  ) {
    super()
  }

  start(): void {
    if (this.process) {
      this.emit('warn', 'surf backend server is already running')
      return
    }

    this.killExistingProcess()
    this.spawnProcess()

    this.isShuttingDown = false
    this.restartAttempts = 0
  }

  stop(): void {
    if (!this.process) {
      this.emit('warn', 'surf backend server is not running')
      return
    }

    this.isShuttingDown = true
    this.process.kill()
    this.process = null
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
      data
        .toString()
        .trimEnd()
        .split('\n')
        .forEach((line) => this.emit('stdout', line))
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

      if (exit) this.emit('exit', exit)
      if (signal) this.emit('signal', signal)

      if (!this.isShuttingDown) {
        this.handleUnexpectedExit()
      }
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
      if (process.platform === 'win32') {
        execSync(`taskkill /F /IM ${processName} /T`)
      } else {
        execSync(`pkill -f ${processName}`)
      }
      this.emit('info', 'killed existing surf backend server process')
    } catch (error) {
      this.emit('info', 'no existing surf backend server process found')
    }
  }
}
