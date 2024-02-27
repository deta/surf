import { promises as fs, createReadStream, createWriteStream, ReadStream, WriteStream } from 'fs'
import path from 'path'

export class ResourceHandle {
  private fd: fs.FileHandle
  private filePath: string
  private resourceId: string

  private constructor(fd: fs.FileHandle, filePath: string, resourceId: string) {
    this.fd = fd
    this.filePath = filePath
    this.resourceId = resourceId
  }

  static async open(
    rootPath: string,
    filePath: string,
    resourceId: string,
    flags: string = 'r'
  ): Promise<ResourceHandle> {
    // TODO: make the root path a global variable
    const resolvedRootPath = path.resolve(rootPath)
    const resolvedFilePath = path.resolve(resolvedRootPath, filePath)

    if (!resolvedFilePath.startsWith(resolvedRootPath)) {
      throw new Error('invalid file read access')
    }

    const fd = await fs.open(resolvedFilePath, flags)
    return new ResourceHandle(fd, resolvedFilePath, resourceId)
  }

  async readAll(): Promise<Buffer> {
    const stats = await this.fd.stat()
    const buffer = Buffer.alloc(stats.size)
    await this.fd.read(buffer, 0, stats.size, 0)
    return buffer
  }

  createReadStream(
    options: {
      flags?: string
      encoding?: BufferEncoding
      mode?: number
      autoClose?: boolean
      emitClose?: boolean
      start?: number
      end?: number
      highWaterMark?: number
    } = {}
  ): ReadStream {
    return createReadStream(this.filePath, {
      ...options,
      fd: this.fd.fd,
      autoClose: false
    })
  }

  async write(data: string | Buffer): Promise<void> {
    if (typeof data === 'string') {
      await this.fd.write(data, null, 'utf-8')
    } else if (Buffer.isBuffer(data)) {
      await this.fd.write(data)
    } else {
      throw new Error('invalid data type, only strings and buffers are supported')
    }
  }

  createWriteStream(
    options: {
      flags?: string
      encoding?: BufferEncoding
      mode?: number
      autoClose?: boolean
      emitClose?: boolean
      start?: number
      highWaterMark?: number
    } = {}
  ): WriteStream {
    return createWriteStream(this.filePath, {
      ...options,
      fd: this.fd.fd,
      autoClose: false
    })
  }

  async flush(): Promise<void> {
    console.log(this.resourceId, 'flushd')
    await this.fd.sync()
  }

  async close(): Promise<void> {
    console.log(this.resourceId, 'closed')
    await this.fd.close()
  }
}

module.exports = { ResourceHandle }
